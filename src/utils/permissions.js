// Role- and grant-based feature access for "Isthooi".
//
// Three layers decide what a logged-in member may do, in increasing precedence:
//
//   1. Role default   — superadmin / collector / member (see ROLES below)
//   2. Standing override — the super admin pinning a feature open or shut for one
//                          member, indefinitely. This is the "who can see the data" knob.
//   3. Timed grant    — a temporary *elevation* valid over a calendar window. It can
//                       only raise the level, never lower it, and reverts on its own
//                       once the window passes. This is the "editing option for certain
//                       time intervals" knob.
//
// Grants deliberately cannot revoke: a lapsed grant must fall back to the standing
// policy, so mixing denials into the same list would make "what happens on expiry"
// ambiguous. To take something away, set the standing override to 'none'.

// Access levels, ordered. Comparisons go through RANK, never string equality.
export const LEVELS = { NONE: 'none', VIEW: 'view', EDIT: 'edit' };

const RANK = { none: 0, view: 1, edit: 2 };

export const rankOf = (level) => RANK[level] ?? 0;

// Every gateable area of the app. `key` matches the activeTab value in App.jsx.
export const FEATURES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Group overview, treasury and week summary',
    // Read-only surface: it reports figures, it does not record anything.
    editable: false
  },
  {
    key: 'contributions',
    label: 'Contributions',
    description: 'Mark weekly Sunday contributions paid, settle dues, advance payments',
    editable: true
  },
  {
    key: 'loan-collections',
    label: 'Loan Collections',
    description: 'Issue loans and record weekly loan installments',
    editable: true
  },
  {
    key: 'defaulters',
    label: 'Defaulters',
    description: 'Members with overdue contributions',
    editable: false
  },
  {
    key: 'settlement',
    label: 'Year-End (Wk 52)',
    description: 'Annual settlement, profit share and member payouts',
    editable: false
  },
  {
    key: 'members',
    label: 'Members',
    description: 'Member roster with phone, UPI and payment history',
    editable: false
  },
  {
    key: 'settings',
    label: 'Settings',
    description: 'Group settings, expenses, backups and access control',
    editable: true
  }
];

export const FEATURE_KEYS = FEATURES.map((f) => f.key);

// Some tabs are alternate views onto another feature's data rather than features in
// their own right — the Sunday Ledger records the same loan installments as Loan
// Collections, so it must be governed by the same permission, not a separate one.
const TAB_FEATURE_ALIASES = { ledger: 'loan-collections' };

export const featureForTab = (tab) => TAB_FEATURE_ALIASES[tab] || tab;

const allFeatures = (level) =>
  FEATURE_KEYS.reduce((acc, key) => ({ ...acc, [key]: level }), {});

export const ROLES = {
  superadmin: {
    key: 'superadmin',
    label: 'Super Admin',
    description: 'Full control over every feature, plus who else may see or edit what.',
    color: '#f59e0b',
    defaults: allFeatures(LEVELS.EDIT)
  },
  collector: {
    key: 'collector',
    label: 'Collector',
    description: 'Records money day to day — contributions and loan installments.',
    color: '#10b981',
    defaults: {
      ...allFeatures(LEVELS.VIEW),
      contributions: LEVELS.EDIT,
      'loan-collections': LEVELS.EDIT,
      settings: LEVELS.NONE
    }
  },
  member: {
    key: 'member',
    label: 'Member',
    description: 'Read-only access to the group books.',
    color: '#6366f1',
    defaults: {
      ...allFeatures(LEVELS.VIEW),
      settings: LEVELS.NONE
    }
  }
};

export const ROLE_KEYS = Object.keys(ROLES);

export const SUPER_ADMIN_ROLE = 'superadmin';

// The app stores dates as YYYY-MM-DD throughout, so plain string compare orders them.
export const todayStr = () => new Date().toISOString().slice(0, 10);

// Which member is super admin: an explicit setting wins, otherwise fall back to the
// member first-named Rajeesh, otherwise the first member. Never leaves a group with
// nobody able to hand out access.
export const resolveSuperAdminId = (members = [], storedId = null) => {
  if (storedId && members.some((m) => m.id === storedId)) return storedId;
  const byName = members.find(
    (m) => (m.name || '').trim().split(/\s+/)[0].toLowerCase() === 'rajeesh'
  );
  if (byName) return byName.id;
  return members[0]?.id || null;
};

// Fills in a complete, self-consistent access block. Safe to run on every load:
// members added since the last run get the default role, members that have left are
// dropped, and the super admin's own role is forced back to superadmin.
export const normalizeAccess = (state) => {
  const members = state.members || [];
  const existing = state.access || {};
  const superAdminId = resolveSuperAdminId(members, existing.superAdminId);

  const roles = {};
  members.forEach((m) => {
    const stored = existing.roles?.[m.id];
    roles[m.id] = ROLES[stored] ? stored : 'member';
  });
  if (superAdminId) roles[superAdminId] = SUPER_ADMIN_ROLE;

  // Anyone else holding superadmin (e.g. after the super admin was reassigned) is
  // demoted, so the role stays singular.
  Object.keys(roles).forEach((id) => {
    if (id !== superAdminId && roles[id] === SUPER_ADMIN_ROLE) roles[id] = 'member';
  });

  const overrides = {};
  members.forEach((m) => {
    const stored = existing.overrides?.[m.id];
    if (!stored) return;
    const kept = {};
    FEATURE_KEYS.forEach((key) => {
      if (RANK[stored[key]] !== undefined) kept[key] = stored[key];
    });
    if (Object.keys(kept).length) overrides[m.id] = kept;
  });

  const grants = (existing.grants || []).filter(
    (g) =>
      g &&
      members.some((m) => m.id === g.memberId) &&
      FEATURE_KEYS.includes(g.feature) &&
      rankOf(g.level) > 0
  );

  return { superAdminId, roles, overrides, grants };
};

export const isSuperAdmin = (state, memberId) =>
  !!memberId && normalizeAccess(state).superAdminId === memberId;

export const getRole = (state, memberId) => {
  const access = normalizeAccess(state);
  return ROLES[access.roles[memberId]] || ROLES.member;
};

// SCHEDULED (window not started) → ACTIVE (inside window) → EXPIRED (window passed).
// A null bound means open-ended on that side.
export const getGrantStatus = (grant, today = todayStr()) => {
  if (grant.from && today < grant.from) return 'SCHEDULED';
  if (grant.until && today > grant.until) return 'EXPIRED';
  return 'ACTIVE';
};

export const isGrantActive = (grant, today = todayStr()) =>
  getGrantStatus(grant, today) === 'ACTIVE';

export const getActiveGrants = (state, memberId, today = todayStr()) =>
  normalizeAccess(state).grants.filter(
    (g) => g.memberId === memberId && isGrantActive(g, today)
  );

// Whole-of-app access for one member: { featureKey: level }.
export const getMemberAccess = (state, memberId, today = todayStr()) => {
  const access = normalizeAccess(state);

  if (memberId && memberId === access.superAdminId) {
    return allFeatures(LEVELS.EDIT);
  }

  const role = ROLES[access.roles[memberId]] || ROLES.member;
  const standing = access.overrides[memberId] || {};

  const resolved = {};
  FEATURE_KEYS.forEach((key) => {
    // Standing override replaces the role default outright — including downward.
    resolved[key] = standing[key] !== undefined ? standing[key] : role.defaults[key];
  });

  // Timed grants elevate only, and only while their window holds.
  access.grants.forEach((g) => {
    if (g.memberId !== memberId) return;
    if (!isGrantActive(g, today)) return;
    if (rankOf(g.level) > rankOf(resolved[g.feature])) resolved[g.feature] = g.level;
  });

  // A feature nobody may look at cannot be edited either.
  FEATURE_KEYS.forEach((key) => {
    if (!FEATURES.find((f) => f.key === key)?.editable && resolved[key] === LEVELS.EDIT) {
      resolved[key] = LEVELS.VIEW;
    }
  });

  return resolved;
};

// capability: 'view' | 'edit'
export const can = (accessMap, feature, capability = 'view') =>
  rankOf(accessMap?.[feature]) >= rankOf(capability);

export const createGrant = ({ memberId, feature, level, from, until, note, grantedBy }) => ({
  id: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  memberId,
  feature,
  level: rankOf(level) > 0 ? level : LEVELS.EDIT,
  from: from || null,
  until: until || null,
  note: (note || '').trim(),
  grantedBy: grantedBy || null,
  createdAt: todayStr()
});

export const describeWindow = (grant) => {
  if (!grant.from && !grant.until) return 'No time limit';
  if (grant.from && grant.until) return `${grant.from} → ${grant.until}`;
  if (grant.from) return `From ${grant.from}`;
  return `Until ${grant.until}`;
};

// Whole days left before a grant lapses; null when open-ended or already gone.
export const daysRemaining = (grant, today = todayStr()) => {
  if (!grant.until) return null;
  const diff = Math.round(
    (new Date(`${grant.until}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000
  );
  return diff < 0 ? null : diff;
};
