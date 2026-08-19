// Data access layer for the live (Supabase) mode.
//
// The React components are built around one flat `state` object. Rather than
// rewrite all eight of them, this module reads the normalized tables and
// reassembles exactly that shape on the way in, and translates each mutation
// into a single-row write on the way out.
//
// That is the whole point of the move: the old code upserted the entire state as
// one JSON blob on every change, so two people recording payments at the same
// time meant one of them silently lost everything they had done. Writing one row
// per payment lets both land.
//
// Every function here assumes RLS is doing the real enforcement. A denied write
// comes back as a Postgres error, which is surfaced rather than swallowed — if a
// member's access lapsed mid-session, they should be told, not left thinking the
// payment was recorded.

import { supabase, isSupabaseConfigured } from './supabaseClient';

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// PostgREST reports RLS denials as an ordinary error; make them legible.
const explain = (error, action) => {
  if (!error) return null;
  const msg = error.message || String(error);
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error(`You do not have permission to ${action}.`);
  }
  return new Error(`Could not ${action}: ${msg}`);
};

const run = async (promise, action) => {
  const { data, error } = await promise;
  const err = explain(error, action);
  if (err) throw err;
  return data;
};

// =============================================================================
// Authentication
// =============================================================================

// An anonymous session carries no identity: current_member_id() is NULL, so RLS
// denies everything until an OTP is redeemed. It exists only so the redeem call
// has a JWT to bind to.
export const ensureAnonymousSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(`Could not start a session: ${error.message}`);
  return data.session;
};

// Sign in with first name or phone plus the OTP the super admin handed over.
// Returns the member id the session is now bound to.
export const redeemOtp = async (identifier, code) => {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('redeem_access_code', {
    p_identifier: identifier,
    p_code: code
  });
  if (error) throw new Error(error.message);
  return data;
};

// --- Super admin password ----------------------------------------------------

// Sign in as the super admin with name-or-phone plus their password. They are the
// one account that cannot be issued an OTP, since they are the only one who can
// issue them.
//
// The password is only ever compared inside Postgres against a bcrypt hash; it is
// not stored anywhere in the browser.
export const signInAsAdmin = async (identifier, password) => {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('sign_in_super_admin', {
    p_identifier: identifier,
    p_password: password
  });
  if (error) throw new Error(error.message);
  return data;
};

// Rotate the password. Only meaningful for a signed-in super admin; the database
// enforces that regardless of what the UI allows.
export const setAdminPassword = async (newPassword) => {
  const { error } = await supabase.rpc('set_admin_password', {
    p_new_password: newPassword
  });
  if (error) throw new Error(error.message);
};

// Whether a password has been set at all — used to warn on first run rather than
// leaving the account quietly unreachable. Returns a boolean and nothing more.
export const adminPasswordIsSet = async () => {
  await ensureAnonymousSession();
  const { data, error } = await supabase.rpc('admin_password_is_set');
  if (error) return null;  // not worth blocking the login screen over
  return Boolean(data);
};

// The member row bound to the current session, or null if this device has not
// redeemed an OTP yet.
export const getSessionMember = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (error || !data) return null;
  return mapMember(data);
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

// Super admin only; returns the plaintext OTP once, for reading out to the member.
export const issueOtp = async (memberId, validHours = 24) => {
  const { data, error } = await supabase.rpc('issue_access_code', {
    p_member_id: memberId,
    p_valid_hours: validHours
  });
  if (error) throw new Error(error.message);
  return data;
};

export const resetMemberDevice = async (memberId) => {
  const { error } = await supabase.rpc('reset_member_device', { p_member_id: memberId });
  if (error) throw new Error(error.message);
};

// What the database says this session may do. The browser computes the same
// thing for rendering, but this is the copy that matters.
export const fetchMyAccess = async () => {
  const rows = await run(supabase.rpc('my_access'), 'read your permissions');
  const map = {};
  (rows || []).forEach((r) => { map[r.feature] = r.level; });
  return map;
};

// =============================================================================
// Read: assemble the state shape
// =============================================================================

const mapMember = (r) => ({
  id: r.id,
  name: r.name,
  phone: r.phone || '',
  upiId: r.upi_id || '',
  avatarColor: r.avatar_color || '#6366f1',
  hasDevice: Boolean(r.auth_user_id)
});

const mapLoan = (r) => ({
  id: r.id,
  memberId: r.member_id,
  nickname: r.nickname || '',
  requestedAmount: num(r.requested_amount),
  disbursedAmount: num(r.disbursed_amount),
  upfrontFee: num(r.upfront_fee),
  startWeekNum: r.start_week_num,
  termWeeks: r.term_weeks,
  weeklyInstallment: num(r.weekly_installment),
  repaidAmount: num(r.repaid_amount),
  status: r.status,
  isFullyRepaid: r.status === 'REPAID',
  createdAt: r.created_at
});

const mapExpense = (r) => ({
  id: r.id,
  description: r.description,
  amount: num(r.amount),
  weekNum: r.week_num,
  date: r.spent_on,
  paymentMethod: r.method,
  createdAt: r.created_at
});

const emptyCollection = (weeklyAmount) => ({
  paid: false,
  amount: weeklyAmount,
  paymentMethod: 'UPI',
  paidAt: null,
  loanInstallmentPaid: false,
  loanInstallmentAmount: 0,
  loanInstallmentPaidAt: null
});

export const fetchAppState = async () => {
  const [
    settings, members, weeks, contributions, installments, loans, expenses,
    roles, overrides, grants
  ] = await Promise.all([
    run(supabase.from('group_settings').select('*').eq('id', 1).maybeSingle(), 'load group settings'),
    run(supabase.from('members').select('*').eq('is_active', true).order('name'), 'load members'),
    run(supabase.from('weeks').select('*').order('week_num'), 'load weeks'),
    run(supabase.from('contributions').select('*'), 'load contributions'),
    run(supabase.from('loan_installments').select('*'), 'load loan installments'),
    run(supabase.from('loans').select('*').order('created_at', { ascending: false }), 'load loans'),
    run(supabase.from('expenses').select('*').order('created_at', { ascending: false }), 'load expenses'),
    run(supabase.from('access_roles').select('*'), 'load roles'),
    run(supabase.from('access_overrides').select('*'), 'load access overrides'),
    run(supabase.from('access_grants').select('*'), 'load access grants')
  ]);

  const weeklyAmount = num(settings?.weekly_amount, 1000);

  // Weeks, with an empty collection slot per member so the UI never meets an
  // undefined record — the same guarantee getInitialState() gave locally.
  const memberList = (members || []).map(mapMember);
  const weekMap = {};
  (weeks || []).forEach((w) => {
    const collections = {};
    memberList.forEach((m) => { collections[m.id] = emptyCollection(weeklyAmount); });
    weekMap[w.week_num] = {
      weekNum: w.week_num,
      date: w.week_date,
      displayDate: w.display_date,
      ceased: w.ceased,
      ceaseDate: w.cease_date,
      collections
    };
  });

  (contributions || []).forEach((c) => {
    const week = weekMap[c.week_num];
    if (!week || !week.collections[c.member_id]) return;
    Object.assign(week.collections[c.member_id], {
      paid: c.paid,
      amount: num(c.amount, weeklyAmount),
      paymentMethod: c.method,
      paidAt: c.paid_at
    });
  });

  // The UI still shows one loan-installment figure per member per week, while the
  // table keys by loan so a member repaying two loans is representable. Fold them
  // back together: paid if any is paid, amount summed, latest date wins.
  (installments || []).forEach((li) => {
    const week = weekMap[li.week_num];
    if (!week || !week.collections[li.member_id]) return;
    const slot = week.collections[li.member_id];
    if (!li.paid) return;
    slot.loanInstallmentPaid = true;
    slot.loanInstallmentAmount += num(li.amount);
    if (!slot.loanInstallmentPaidAt || (li.paid_at && li.paid_at > slot.loanInstallmentPaidAt)) {
      slot.loanInstallmentPaidAt = li.paid_at;
    }
  });

  const roleMap = {};
  (roles || []).forEach((r) => { roleMap[r.member_id] = r.role; });

  const overrideMap = {};
  (overrides || []).forEach((o) => {
    overrideMap[o.member_id] = { ...(overrideMap[o.member_id] || {}), [o.feature]: o.level };
  });

  return {
    groupName: settings?.group_name || 'Isthooi Savings Group',
    weeklyAmount,
    currentWeekNum: settings?.current_week_num || 1,
    startDate: settings?.start_date || '2026-01-04',
    totalWeeks: settings?.total_weeks || 52,
    groupUpiVpa: settings?.group_upi_vpa || '',
    groupNotes: settings?.group_notes || '',
    editLocked: Boolean(settings?.edit_locked),
    members: memberList,
    weeks: weekMap,
    loans: (loans || []).map(mapLoan),
    expenses: (expenses || []).map(mapExpense),
    access: {
      superAdminId: settings?.super_admin_member_id || null,
      roles: roleMap,
      overrides: overrideMap,
      grants: (grants || []).map((g) => ({
        id: g.id,
        memberId: g.member_id,
        feature: g.feature,
        level: g.level,
        from: g.valid_from,
        until: g.valid_until,
        note: g.note || '',
        grantedBy: g.granted_by,
        createdAt: g.created_at
      }))
    }
  };
};

// =============================================================================
// Write: one row per change
// =============================================================================

export const setContribution = (weekNum, memberId, fields) =>
  run(
    supabase.from('contributions').upsert({
      week_num: weekNum,
      member_id: memberId,
      paid: fields.paid,
      amount: fields.amount,
      method: fields.paymentMethod || 'UPI',
      paid_at: fields.paidAt
      // updated_at / updated_by are stamped by a trigger, not sent from here.
    }, { onConflict: 'week_num,member_id' }),
    'record this contribution'
  );

export const setLoanInstallment = (weekNum, memberId, loanId, fields) =>
  run(
    supabase.from('loan_installments').upsert({
      week_num: weekNum,
      member_id: memberId,
      loan_id: loanId,
      paid: fields.paid,
      amount: fields.amount,
      paid_at: fields.paidAt
      // The loan's repaid_amount is recomputed by a trigger from these rows,
      // so it is never sent by a client and cannot be raced.
    }, { onConflict: 'week_num,member_id,loan_id' }),
    'record this loan installment'
  );

export const createLoan = (loan) =>
  run(
    supabase.from('loans').insert({
      id: loan.id,
      member_id: loan.memberId,
      nickname: loan.nickname,
      requested_amount: loan.requestedAmount,
      disbursed_amount: loan.disbursedAmount,
      upfront_fee: loan.upfrontFee,
      start_week_num: loan.startWeekNum,
      term_weeks: loan.termWeeks,
      weekly_installment: loan.weeklyInstallment
      // repaid_amount and status are derived; the trigger owns them.
    }),
    'create this loan'
  );

export const addExpense = (e) =>
  run(
    supabase.from('expenses').insert({
      id: e.id,
      description: e.description,
      amount: e.amount,
      week_num: e.weekNum,
      spent_on: e.date,
      method: e.paymentMethod
    }),
    'record this expense'
  );

export const updateExpense = (id, e) =>
  run(
    supabase.from('expenses').update({
      description: e.description,
      amount: e.amount,
      week_num: e.weekNum,
      spent_on: e.date,
      method: e.paymentMethod
    }).eq('id', id),
    'update this expense'
  );

export const deleteExpense = (id) =>
  run(supabase.from('expenses').delete().eq('id', id), 'delete this expense');

export const updateSettings = (s) =>
  run(
    supabase.from('group_settings').update({
      group_name: s.groupName,
      weekly_amount: s.weeklyAmount,
      current_week_num: s.currentWeekNum,
      start_date: s.startDate,
      total_weeks: s.totalWeeks,
      group_upi_vpa: s.groupUpiVpa,
      group_notes: s.groupNotes,
      updated_at: new Date().toISOString()
    }).eq('id', 1),
    'save group settings'
  );

export const setEditLock = (locked) =>
  run(
    supabase.from('group_settings').update({ edit_locked: locked }).eq('id', 1),
    'change the edit lock'
  );

export const ceaseWeek = (weekNum) =>
  run(
    supabase.from('weeks').update({
      ceased: true,
      cease_date: new Date().toISOString().slice(0, 10)
    }).eq('week_num', weekNum),
    'cease this week'
  );

export const upsertMember = (m) =>
  run(
    supabase.from('members').upsert({
      id: m.id,
      name: m.name,
      phone: m.phone,
      upi_id: m.upiId,
      avatar_color: m.avatarColor
    }, { onConflict: 'id' }),
    'save this member'
  );

export const deactivateMember = (id) =>
  run(
    supabase.from('members').update({ is_active: false }).eq('id', id),
    'remove this member'
  );

// --- Access control ----------------------------------------------------------

export const setMemberRole = (memberId, role) =>
  run(
    supabase.from('access_roles').upsert(
      { member_id: memberId, role, updated_at: new Date().toISOString() },
      { onConflict: 'member_id' }
    ),
    'change this role'
  );

export const setFeatureOverride = (memberId, feature, level) =>
  level === null || level === undefined
    ? run(
        supabase.from('access_overrides').delete()
          .eq('member_id', memberId).eq('feature', feature),
        'clear this permission'
      )
    : run(
        supabase.from('access_overrides').upsert(
          { member_id: memberId, feature, level, updated_at: new Date().toISOString() },
          { onConflict: 'member_id,feature' }
        ),
        'change this permission'
      );

export const addGrant = (g) =>
  run(
    supabase.from('access_grants').insert({
      id: g.id,
      member_id: g.memberId,
      feature: g.feature,
      level: g.level,
      valid_from: g.from,
      valid_until: g.until,
      note: g.note,
      granted_by: g.grantedBy
    }),
    'create this grant'
  );

export const revokeGrant = (id) =>
  run(supabase.from('access_grants').delete().eq('id', id), 'revoke this grant');

export const transferSuperAdmin = (memberId) =>
  run(
    // A trigger demotes the outgoing holder and promotes the new one, so the
    // group can never end up with two super admins or none.
    supabase.from('group_settings')
      .update({ super_admin_member_id: memberId }).eq('id', 1),
    'transfer the super admin role'
  );

// =============================================================================
// Realtime
// =============================================================================

// A payment recorded on one phone should appear on another without a refresh.
// Realtime respects RLS, so a subscriber is only sent rows it could have read.
export const subscribeToChanges = (onChange) => {
  if (!isSupabaseConfigured) return () => {};

  const channel = supabase.channel('isthooi-live');
  [
    'contributions', 'loan_installments', 'loans',
    'expenses', 'group_settings', 'access_grants'
  ].forEach((table) => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  });
  channel.subscribe();

  return () => { supabase.removeChannel(channel); };
};
