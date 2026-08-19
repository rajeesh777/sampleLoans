import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Clock, Eye, LogOut, ShieldAlert, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import SundayLedger from './components/SundayLedger';
import DefaultersWatchdog from './components/DefaultersWatchdog';
import SundayContributions from './components/SundayContributions';
import LoanCollections from './components/LoanCollections';
import AnnualSettlement from './components/AnnualSettlement';
import MemberRoster from './components/MemberRoster';
import Settings from './components/Settings';

import {
  loadState,
  saveState,
  getGroupStats,
  getInitialState,
  generate52Sundays
} from './utils/storage';

import {
  FEATURES,
  can,
  createGrant,
  daysRemaining,
  describeWindow,
  featureForTab,
  getActiveGrants,
  getMemberAccess,
  getRole,
  isSuperAdmin as checkSuperAdmin,
  normalizeAccess,
  todayStr
} from './utils/permissions';

import { isSupabaseConfigured } from './utils/supabaseClient';
import * as db from './utils/db';

// Live mode means the group's data lives in Postgres and is shared between
// members' devices. Without Supabase credentials the app still runs exactly as
// before, entirely from localStorage, which keeps local development possible.
const LIVE = isSupabaseConfigured;

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loggedInMember, setLoggedInMember] = useState(() => {
    if (LIVE) return null;  // live sessions are resolved from the JWT, not localStorage
    const saved = localStorage.getItem('ISTHOOI_LOGGED_IN_MEMBER');
    return saved ? JSON.parse(saved) : null;
  });

  // Live-mode connection state. `booting` covers the first round trip, so the
  // login screen does not flash before an existing session is recognised.
  const [booting, setBooting] = useState(LIVE);
  const [syncError, setSyncError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Pull the authoritative state from the database.
  const reload = useCallback(async () => {
    const fresh = await db.fetchAppState();
    setState(fresh);
    return fresh;
  }, []);

  // Apply a change locally at once, then write the single affected row. If the
  // database refuses — an access grant lapsed, the week was ceased from another
  // phone — say so and re-read, rather than leaving the screen showing a payment
  // that was never recorded.
  const persist = useCallback((write) => {
    if (!LIVE) return;
    Promise.resolve()
      .then(write)
      .catch(async (err) => {
        setSyncError(err.message || 'That change could not be saved.');
        try { await reload(); } catch { /* keep the error already shown */ }
      });
  }, [reload]);

  // Resume an existing session on load: this device may already be bound to a
  // member from a previous visit.
  useEffect(() => {
    if (!LIVE) return;
    let cancelled = false;

    (async () => {
      try {
        const member = await db.getSessionMember();
        if (cancelled) return;
        if (member) {
          await reload();
          if (!cancelled) setLoggedInMember(member);
        }
      } catch (err) {
        if (!cancelled) setSyncError(err.message || 'Could not reach the database.');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [reload]);

  // A payment recorded on one phone should appear on another without a refresh.
  useEffect(() => {
    if (!LIVE || !loggedInMember) return;
    return db.subscribeToChanges(() => {
      reload().catch(() => { /* a dropped refresh is not worth interrupting for */ });
    });
  }, [loggedInMember, reload]);

  // Today's date, re-read on a timer so a timed grant starts and lapses on its own
  // without anyone reloading the page.
  const [today, setToday] = useState(() => todayStr());

  useEffect(() => {
    const timer = setInterval(() => {
      const now = todayStr();
      setToday((prev) => (prev === now ? prev : now));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Sync state changes to localStorage
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Save logged-in member to localStorage.
  // Demo mode only: in live mode the session lives in the JWT, and trusting a
  // localStorage copy would let anyone hand themselves an identity by editing it.
  useEffect(() => {
    if (LIVE) return;
    if (loggedInMember) {
      localStorage.setItem('ISTHOOI_LOGGED_IN_MEMBER', JSON.stringify(loggedInMember));
    } else {
      localStorage.removeItem('ISTHOOI_LOGGED_IN_MEMBER');
    }
  }, [loggedInMember]);

  // Login handler. Live mode hands back the member id the OTP was bound to;
  // demo mode hands back the member object it matched locally.
  const handleLogin = async (memberOrId) => {
    if (LIVE) {
      const fresh = await reload();
      setLoggedInMember(fresh.members.find((m) => m.id === memberOrId) || null);
    } else {
      setLoggedInMember(memberOrId);
    }
    setActiveTab('dashboard');
  };

  // Logout handler
  const handleLogout = async () => {
    if (LIVE) {
      // Ends the JWT session. The device stays bound to the member, so signing
      // back in needs a fresh OTP from the super admin.
      await db.signOut().catch(() => {});
    }
    setLoggedInMember(null);
  };

  const groupStats = getGroupStats(state);

  // The logged-in copy is a snapshot taken at sign-in. Read the live record so a
  // rename or a role change lands without forcing a re-login.
  const currentMember =
    state.members.find((m) => m.id === loggedInMember?.id) || null;

  // Access is derived, never stored on the session — revoking it takes effect at once.
  // Memoised so it stays referentially stable between renders; the redirect effect
  // below keys off it and would otherwise re-run on every render.
  const access = useMemo(
    () => getMemberAccess(state, currentMember?.id, today),
    [state, currentMember?.id, today]
  );
  const isAdmin = checkSuperAdmin(state, currentMember?.id);
  const canView = (feature) => can(access, feature, 'view');
  const canEdit = (feature) => can(access, feature, 'edit');

  // The UI hides controls a member may not use, but every mutation re-checks: a stale
  // render, or a grant that lapsed with a dialog still open, must not slip a write past.
  const blocked = (feature) => {
    if (canEdit(feature)) return false;
    console.warn(
      `Access denied: ${currentMember?.name || 'unknown user'} cannot edit "${feature}"`
    );
    return true;
  };

  // A member dropped from the roster loses their session at the next render.
  useEffect(() => {
    if (loggedInMember && !currentMember) setLoggedInMember(null);
  }, [loggedInMember, currentMember]);

  // If the super admin takes a tab away while the member is sitting on it, move them
  // to the first tab they can still open rather than leaving a blank content area.
  useEffect(() => {
    if (!currentMember) return;
    if (can(access, featureForTab(activeTab), 'view')) return;
    const fallback = FEATURES.find((f) => can(access, f.key, 'view'));
    if (fallback && fallback.key !== activeTab) setActiveTab(fallback.key);
  }, [access, activeTab, currentMember]);

  // Merge one member's collection record for a week, leaving everything else alone.
  const patchCollection = (weekNum, memberId, patch) => {
    setState((prevState) => {
      const weekData = prevState.weeks[weekNum] || { collections: {} };
      const existing = weekData.collections[memberId] || {
        paid: false,
        amount: prevState.weeklyAmount || 1000,
        paymentMethod: 'UPI',
        paidAt: null,
        loanInstallmentPaid: false,
        loanInstallmentAmount: 0,
        loanInstallmentPaidAt: null
      };

      return {
        ...prevState,
        weeks: {
          ...prevState.weeks,
          [weekNum]: {
            ...weekData,
            collections: {
              ...weekData.collections,
              [memberId]: { ...existing, ...patch }
            }
          }
        }
      };
    });
  };

  // Toggle regular Sunday contribution payment
  const handleTogglePayment = (weekNum, memberId) => {
    if (blocked('contributions')) return;

    // Computed from the rendered state rather than inside the setState callback,
    // because the same values have to be sent to the database.
    const existing = state.weeks[weekNum]?.collections?.[memberId] || {};
    const record = {
      paid: !existing.paid,
      amount: existing.amount ?? (state.weeklyAmount || 1000),
      paymentMethod: existing.paymentMethod || 'UPI',
      paidAt: !existing.paid ? today : null
    };

    patchCollection(weekNum, memberId, record);
    persist(() => db.setContribution(weekNum, memberId, record));
  };

  // Toggle loan installment payment for a member on a specific Sunday
  const handleToggleLoanInstallment = (weekNum, memberId, loanId) => {
    if (blocked('loan-collections')) return;

    const existing = state.weeks[weekNum]?.collections?.[memberId] || {};
    const targetLoan = state.loans.find((l) => l.id === loanId);
    const installmentAmt = targetLoan ? targetLoan.weeklyInstallment : 1000;
    const nowPaid = !existing.loanInstallmentPaid;

    const record = {
      paid: nowPaid,
      amount: nowPaid ? installmentAmt : 0,
      paidAt: nowPaid ? today : null
    };

    patchCollection(weekNum, memberId, {
      loanInstallmentPaid: record.paid,
      loanInstallmentAmount: record.amount,
      loanInstallmentPaidAt: record.paidAt
    });

    // Optimistic local balance only. In live mode the authoritative figure is
    // recomputed by a database trigger from the installment rows, so two people
    // recording payments at once cannot overwrite each other's total.
    setState((prevState) => ({
      ...prevState,
      loans: prevState.loans.map((loan) => {
        if (loan.id !== loanId) return loan;
        const delta = nowPaid ? installmentAmt : -installmentAmt;
        const newRepaid = Math.min(
          loan.requestedAmount,
          Math.max(0, loan.repaidAmount + delta)
        );
        return {
          ...loan,
          repaidAmount: newRepaid,
          isFullyRepaid: newRepaid >= loan.requestedAmount,
          status: newRepaid >= loan.requestedAmount ? 'REPAID' : 'ACTIVE'
        };
      })
    }));

    persist(() => db.setLoanInstallment(weekNum, memberId, loanId, record));
  };

  // Change payment method (UPI, Cash, Bank)
  const handleChangePaymentMethod = (weekNum, memberId, method) => {
    if (blocked('contributions')) return;

    const existing = state.weeks[weekNum]?.collections?.[memberId] || {};
    const record = {
      paid: existing.paid || false,
      amount: existing.amount ?? (state.weeklyAmount || 1000),
      paymentMethod: method,
      paidAt: existing.paidAt || null
    };

    patchCollection(weekNum, memberId, { paymentMethod: method });
    persist(() => db.setContribution(weekNum, memberId, record));
  };

  // Spread a lump sum across consecutive weeks, filling one weekly amount at a
  // time. Returns the per-week records so the caller can write each one.
  const spreadAcrossWeeks = (startWeek, totalAmount, perWeek, lastWeek) => {
    const slices = [];
    let remaining = totalAmount;
    let week = startWeek;

    while (remaining > 0 && week <= lastWeek) {
      const amount = Math.min(remaining, perWeek);
      slices.push({ weekNum: week, amount });
      remaining -= amount;
      week++;
    }
    return slices;
  };

  // Advance payment for Sunday contributions (custom amount distributed across weeks)
  const handleAdvancePayment = (startWeek, memberId, totalAmount, method = 'UPI') => {
    if (blocked('contributions')) return;

    const weeklyAmount = state.weeklyAmount || 1000;
    const lastWeek = state.totalWeeks || 52;
    const slices = spreadAcrossWeeks(startWeek, totalAmount, weeklyAmount, lastWeek);

    slices.forEach(({ weekNum, amount }) => {
      const record = { paid: true, amount, paymentMethod: method, paidAt: today };
      patchCollection(weekNum, memberId, record);
      persist(() => db.setContribution(weekNum, memberId, record));
    });
  };

  // Advance payment for loan installments (custom amount distributed across weeks)
  const handleAdvanceLoanInstallment = (startWeek, memberId, loanId, totalAmount) => {
    if (blocked('loan-collections')) return;

    const targetLoan = state.loans.find((l) => l.id === loanId);
    const installmentAmt = targetLoan ? targetLoan.weeklyInstallment : 1000;
    const lastWeek = state.totalWeeks || 52;
    const slices = spreadAcrossWeeks(startWeek, totalAmount, installmentAmt, lastWeek);
    const totalAdvance = slices.reduce((sum, s) => sum + s.amount, 0);

    slices.forEach(({ weekNum, amount }) => {
      patchCollection(weekNum, memberId, {
        loanInstallmentPaid: true,
        loanInstallmentAmount: amount,
        loanInstallmentPaidAt: today
      });
      persist(() =>
        db.setLoanInstallment(weekNum, memberId, loanId, {
          paid: true,
          amount,
          paidAt: today
        })
      );
    });

    // Optimistic only; the database recomputes the balance from the rows above.
    setState((prevState) => ({
      ...prevState,
      loans: prevState.loans.map((loan) => {
        if (loan.id !== loanId) return loan;
        const newRepaid = Math.min(loan.requestedAmount, loan.repaidAmount + totalAdvance);
        return {
          ...loan,
          repaidAmount: newRepaid,
          isFullyRepaid: newRepaid >= loan.requestedAmount,
          status: newRepaid >= loan.requestedAmount ? 'REPAID' : 'ACTIVE'
        };
      })
    }));
  };

  // Create new loan (10% upfront fee deduction)
  const handleCreateLoan = (loanData) => {
    if (blocked('loan-collections')) return;
    const newLoan = {
      id: `loan-${Date.now()}`,
      memberId: loanData.memberId,
      nickname: loanData.nickname || 'General Advance',
      requestedAmount: loanData.requestedAmount,
      disbursedAmount: loanData.disbursedAmount,
      upfrontFee: loanData.upfrontFee,
      startWeekNum: loanData.startWeekNum,
      termWeeks: loanData.termWeeks || 10,
      weeklyInstallment: loanData.weeklyInstallment,
      repaidAmount: 0,
      status: 'ACTIVE',
      createdAt: new Date().toISOString().slice(0, 10)
    };

    setState((prevState) => ({
      ...prevState,
      loans: [newLoan, ...prevState.loans]
    }));
    persist(() => db.createLoan(newLoan));
  };

  // Record extra loan repayment installment
  const handleRepayLoanExtra = (loanId, amount) => {
    if (blocked('loan-collections')) return;
    setState((prevState) => {
      const nextLoans = prevState.loans.map((loan) => {
        if (loan.id === loanId) {
          const newRepaid = Math.min(loan.requestedAmount, loan.repaidAmount + amount);
          const isFullyRepaid = newRepaid >= loan.requestedAmount;
          return {
            ...loan,
            repaidAmount: newRepaid,
            isFullyRepaid,
            status: isFullyRepaid ? 'REPAID' : 'ACTIVE'
          };
        }
        return loan;
      });

      return {
        ...prevState,
        loans: nextLoans
      };
    });
  };

  // Record a miscellaneous group expense against a week; deducted from treasury cash
  const handleAddExpense = (expense) => {
    if (blocked('settings')) return;

    const weekNum = Number(expense.weekNum) || state.currentWeekNum || 1;
    const newExpense = {
      id: `exp-${Date.now()}`,
      description: (expense.description || '').trim() || 'Miscellaneous expense',
      amount: Number(expense.amount) || 0,
      weekNum,
      // Default to the week's Sunday so the expense sorts with that week's activity
      date: expense.date || state.weeks[weekNum]?.date || today,
      paymentMethod: expense.paymentMethod || 'Cash',
      createdAt: today
    };

    setState((prevState) => ({
      ...prevState,
      expenses: [newExpense, ...(prevState.expenses || [])]
    }));
    persist(() => db.addExpense(newExpense));
  };

  // Edit an existing miscellaneous expense
  const handleUpdateExpense = (expenseId, updates) => {
    if (blocked('settings')) return;

    const existing = (state.expenses || []).find((e) => e.id === expenseId);
    if (!existing) return;

    const weekNum = Number(updates.weekNum) || existing.weekNum;
    const merged = {
      ...existing,
      description: (updates.description || '').trim() || existing.description,
      amount: Number(updates.amount) || 0,
      weekNum,
      date: updates.date || state.weeks[weekNum]?.date || existing.date,
      paymentMethod: updates.paymentMethod || existing.paymentMethod
    };

    setState((prevState) => ({
      ...prevState,
      expenses: (prevState.expenses || []).map((e) => (e.id === expenseId ? merged : e))
    }));
    persist(() => db.updateExpense(expenseId, merged));
  };

  // Remove a miscellaneous expense; the amount returns to treasury cash
  const handleDeleteExpense = (expenseId) => {
    if (blocked('settings')) return;
    setState((prevState) => ({
      ...prevState,
      expenses: (prevState.expenses || []).filter((e) => e.id !== expenseId)
    }));
    persist(() => db.deleteExpense(expenseId));
  };

  // Import JSON backup
  const handleImportState = (importedData) => {
    if (blocked('settings')) return;
    if (LIVE) {
      setSyncError(
        'Importing a backup is disabled in live mode — it would overwrite shared ' +
        'group data. Restore from a database backup instead.'
      );
      return;
    }
    // A backup may predate access control, or carry a roster that no longer matches
    // its access block — rebuild it so an import can never leave the group locked out.
    setState({ ...importedData, access: normalizeAccess(importedData) });
  };

  // Reset to initial demo state
  const handleResetState = () => {
    if (blocked('settings')) return;
    if (LIVE) {
      setSyncError('Reset is disabled in live mode — it would wipe the group ledger.');
      return;
    }
    const fresh = getInitialState();
    setState(fresh);
  };

  // Cease a week (lock it from further edits). Reachable from Settings and from the
  // two collection screens, so either kind of edit right is enough.
  const handleCeaseWeek = (weekNum) => {
    if (!canEdit('contributions') && blocked('settings')) return;
    setState((prevState) => ({
      ...prevState,
      weeks: {
        ...prevState.weeks,
        [weekNum]: {
          ...prevState.weeks[weekNum],
          ceased: true,
          ceaseDate: today
        }
      }
    }));
    persist(() => db.ceaseWeek(weekNum));
  };

  // Update settings and regenerate weeks if needed
  const handleUpdateSettings = (settings) => {
    if (blocked('settings')) return;
    setState((prevState) => {
      const sundays = generate52Sundays(settings.startDate);
      let newWeeks = {};
      const membersToUse = settings.members || prevState.members;

      // Generate weeks based on totalWeeks setting
      for (let i = 0; i < settings.totalWeeks; i++) {
        const sunday = sundays[i % sundays.length];
        const weekNum = i + 1;
        const weekDate = new Date(settings.startDate);
        weekDate.setDate(weekDate.getDate() + (i * 7));
        const yyyy = weekDate.getFullYear();
        const mm = String(weekDate.getMonth() + 1).padStart(2, '0');
        const dd = String(weekDate.getDate()).padStart(2, '0');
        const dateFormatted = `${yyyy}-${mm}-${dd}`;

        // Preserve existing collections data if week exists
        const existingWeek = prevState.weeks[weekNum];
        const collections = existingWeek?.collections || {};

        // Add entries for all members
        membersToUse.forEach((m) => {
          if (!collections[m.id]) {
            collections[m.id] = {
              paid: false,
              amount: settings.weeklyAmount,
              paymentMethod: 'UPI',
              paidAt: null,
              loanInstallmentPaid: false,
              loanInstallmentAmount: 0,
              loanInstallmentPaidAt: null
            };
          }
        });

        newWeeks[weekNum] = {
          weekNum: weekNum,
          date: dateFormatted,
          displayDate: weekDate.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }),
          collections,
          ceased: existingWeek?.ceased || false,
          ceaseDate: existingWeek?.ceaseDate || null
        };
      }

      const nextState = {
        ...prevState,
        startDate: settings.startDate,
        totalWeeks: settings.totalWeeks,
        groupName: settings.groupName,
        groupUpiVpa: settings.groupUpiVpa,
        weeklyAmount: settings.weeklyAmount,
        groupNotes: settings.groupNotes,
        members: membersToUse,
        weeks: newWeeks
      };

      // The roster may have gained or lost members here; re-derive access so newcomers
      // get a role and departed members leave no dangling grants behind.
      return { ...nextState, access: normalizeAccess(nextState) };
    });

    persist(async () => {
      await db.updateSettings({
        groupName: settings.groupName,
        weeklyAmount: settings.weeklyAmount,
        currentWeekNum: state.currentWeekNum,
        startDate: settings.startDate,
        totalWeeks: settings.totalWeeks,
        groupUpiVpa: settings.groupUpiVpa,
        groupNotes: settings.groupNotes
      });

      // Roster edits arrive through the same form, so push them too. Members are
      // deactivated rather than deleted: their contribution history must survive.
      if (settings.members) {
        const keptIds = new Set(settings.members.map((m) => m.id));
        await Promise.all(settings.members.map((m) => db.upsertMember(m)));
        await Promise.all(
          state.members
            .filter((m) => !keptIds.has(m.id))
            .map((m) => db.deactivateMember(m.id))
        );
      }
    });
  };

  // Toggle global edit lock
  const handleToggleEditLock = () => {
    if (blocked('settings')) return;
    const next = !state.editLocked;
    setState((prevState) => ({ ...prevState, editLocked: next }));
    persist(() => db.setEditLock(next));
  };

  // --- Access control (super admin only) ---------------------------------------

  // Every access mutation runs through here so the block is re-normalized on write:
  // the super admin can never be demoted, and no grant can outlive its member.
  const updateAccess = (mutator) => {
    if (!isAdmin) {
      console.warn('Access denied: only the super admin can change feature access');
      return;
    }
    setState((prevState) => {
      const currentAccess = normalizeAccess(prevState);
      const nextAccess = mutator(currentAccess, prevState);
      return {
        ...prevState,
        access: normalizeAccess({ ...prevState, access: nextAccess })
      };
    });
  };

  // Assign a role. The super admin's own role is fixed and normalizeAccess re-pins it.
  const handleSetMemberRole = (memberId, roleKey) => {
    updateAccess((current) => ({
      ...current,
      roles: { ...current.roles, [memberId]: roleKey }
    }));
    persist(() => db.setMemberRole(memberId, roleKey));
  };

  // Standing per-member policy for one feature. `null` clears it back to the role default.
  const handleSetFeatureOverride = (memberId, feature, level) => {
    updateAccess((current) => {
      const forMember = { ...(current.overrides[memberId] || {}) };
      if (level === null || level === undefined) {
        delete forMember[feature];
      } else {
        forMember[feature] = level;
      }
      const overrides = { ...current.overrides };
      if (Object.keys(forMember).length) {
        overrides[memberId] = forMember;
      } else {
        delete overrides[memberId];
      }
      return { ...current, overrides };
    });
    persist(() => db.setFeatureOverride(memberId, feature, level));
  };

  // Time-boxed elevation: valid between `from` and `until` inclusive, then it lapses.
  const handleAddGrant = (grantInput) => {
    // Built once, outside the state updater, so the same id reaches the database.
    const grant = createGrant({ ...grantInput, grantedBy: currentMember?.id });
    updateAccess((current) => ({
      ...current,
      grants: [grant, ...current.grants]
    }));
    persist(() => db.addGrant(grant));
  };

  const handleRevokeGrant = (grantId) => {
    updateAccess((current) => ({
      ...current,
      grants: current.grants.filter((g) => g.id !== grantId)
    }));
    persist(() => db.revokeGrant(grantId));
  };

  // Hand the super admin role to someone else. The outgoing admin drops to Collector
  // rather than to Member, so they keep day-to-day duties.
  const handleTransferSuperAdmin = (memberId) => {
    updateAccess((current) => ({
      ...current,
      superAdminId: memberId,
      roles: {
        ...current.roles,
        [current.superAdminId]: 'collector',
        [memberId]: 'superadmin'
      }
    }));
    // A database trigger demotes the outgoing holder, so only this one write is
    // needed and the group can never end up with two super admins or none.
    persist(() => db.transferSuperAdmin(memberId));
  };

  // Issue a sign-in OTP for a member. Returns the plaintext for the super admin to
  // pass on; it is never stored in the browser and cannot be read back later.
  const handleIssueOtp = async (memberId, validHours) => {
    if (!isAdmin) throw new Error('Only the super admin can issue an OTP');
    if (!LIVE) throw new Error('OTPs need the live database. This is demo mode.');
    return db.issueOtp(memberId, validHours);
  };

  const handleResetDevice = async (memberId) => {
    if (!isAdmin) throw new Error('Only the super admin can reset a device');
    if (!LIVE) throw new Error('Device resets need the live database.');
    await db.resetMemberDevice(memberId);
    await reload();
  };

  // Rotate the super admin's own password. The length and authority checks live in
  // the database too — this is only so the UI can report a problem straight away.
  const handleSetAdminPassword = async (newPassword) => {
    if (!isAdmin) throw new Error('Only the super admin can change this password');
    if (!LIVE) throw new Error('The admin password needs the live database.');
    if (!newPassword || newPassword.length < 12) {
      throw new Error('The password must be at least 12 characters');
    }
    await db.setAdminPassword(newPassword);
  };

  // First paint in live mode: an existing session may already be signed in, so
  // wait for that check rather than flashing the login screen.
  if (booting) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '14px',
        color: 'var(--text-muted)'
      }}>
        <Loader2 size={28} className="spin" />
        <span style={{ fontSize: '0.9rem' }}>Connecting…</span>
      </div>
    );
  }

  // Show login screen if not logged in
  if (!loggedInMember || !currentMember) {
    return <Login members={state.members} onLogin={handleLogin} />;
  }

  // A member the super admin has shut out of every feature.
  if (!FEATURES.some((f) => canView(f.key))) {
    return (
      <NoAccessScreen memberName={currentMember.name} onLogout={handleLogout} />
    );
  }

  return (
    <div className="app-container">
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        groupStats={groupStats}
        loggedInMember={currentMember}
        onLogout={handleLogout}
        memberCount={state.members.length}
        weeklyAmount={state.weeklyAmount}
        access={access}
        role={getRole(state, currentMember.id)}
      />

      {/* Main Content Area */}
      <main className="content-area">
        {/* A write the database refused — a lapsed grant, a ceased week, a dropped
            connection. Shown rather than swallowed, because the member would
            otherwise believe a payment had been recorded when it had not. */}
        {syncError && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              marginBottom: '16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid #f43f5e',
              color: '#fca5a5'
            }}
          >
            <CloudOff size={16} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{syncError}</span>
            <button
              className="btn btn-sm btn-secondary"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await reload();
                  setSyncError('');
                } catch (err) {
                  setSyncError(err.message || 'Still cannot reach the database.');
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} /> Retry
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setSyncError('')}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tells a member why the screen looks read-only, and when their temporary
            edit access runs out, instead of leaving greyed-out buttons unexplained. */}
        <AccessBanner
          state={state}
          memberId={currentMember.id}
          today={today}
          activeTab={activeTab}
          access={access}
        />

        {activeTab === 'dashboard' && canView('dashboard') && (
          <Dashboard
            state={state}
            groupStats={groupStats}
            setActiveTab={setActiveTab}
            onTogglePayment={handleTogglePayment}
            loggedInMember={currentMember}
          />
        )}

        {activeTab === 'contributions' && canView('contributions') && (
          <SundayContributions
            state={state}
            editLocked={state.editLocked || !canEdit('contributions')}
            onTogglePayment={handleTogglePayment}
            onChangePaymentMethod={handleChangePaymentMethod}
            onAdvancePayment={handleAdvancePayment}
            onCeaseWeek={handleCeaseWeek}
          />
        )}

        {activeTab === 'loan-collections' && canView('loan-collections') && (
          <LoanCollections
            state={state}
            groupStats={groupStats}
            editLocked={state.editLocked || !canEdit('loan-collections')}
            onToggleLoanInstallment={handleToggleLoanInstallment}
            onAdvanceLoanInstallment={handleAdvanceLoanInstallment}
            onCeaseWeek={handleCeaseWeek}
            onCreateLoan={handleCreateLoan}
          />
        )}

        {activeTab === 'ledger' && canView('loan-collections') && (
          <SundayLedger
            state={state}
            onToggleLoanInstallment={handleToggleLoanInstallment}
            onAdvanceLoanInstallment={handleAdvanceLoanInstallment}
          />
        )}

        {/* Reached from the Dashboard dues summary and the header Overdue badge.
            Both already pointed here, but no case rendered it, so the content
            area came up blank. */}
        {activeTab === 'defaulters' && canView('defaulters') && (
          <DefaultersWatchdog state={state} />
        )}

        {activeTab === 'settlement' && canView('settlement') && (
          <AnnualSettlement
            state={state}
            groupStats={groupStats}
          />
        )}

        {activeTab === 'members' && canView('members') && (
          <MemberRoster state={state} />
        )}

        {activeTab === 'settings' && canView('settings') && (
          <Settings
            state={state}
            onUpdateSettings={handleUpdateSettings}
            onCeaseWeek={handleCeaseWeek}
            onToggleEditLock={handleToggleEditLock}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onImportState={handleImportState}
            onResetState={handleResetState}
            isSuperAdmin={isAdmin}
            today={today}
            liveMode={LIVE}
            onSetMemberRole={handleSetMemberRole}
            onSetFeatureOverride={handleSetFeatureOverride}
            onAddGrant={handleAddGrant}
            onRevokeGrant={handleRevokeGrant}
            onTransferSuperAdmin={handleTransferSuperAdmin}
            onIssueOtp={handleIssueOtp}
            onResetDevice={handleResetDevice}
            onSetAdminPassword={handleSetAdminPassword}
          />
        )}
      </main>
    </div>
  );
}

// Shown when a member has been shut out of every feature, so the app still explains
// itself rather than rendering an empty shell.
function NoAccessScreen({ memberName, onLogout }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        textAlign: 'center'
      }}
    >
      <div className="card" style={{ maxWidth: '420px' }}>
        <ShieldAlert size={40} color="#f59e0b" />
        <h2 style={{ margin: '16px 0 8px' }}>No access yet</h2>
        <p style={{ color: 'var(--text-muted, #94a3b8)', marginBottom: '20px' }}>
          {memberName}, the group's super admin has not opened any section of the app
          for you. Ask them to grant access from Settings → Access Control.
        </p>
        <button className="btn btn-secondary" onClick={onLogout}>
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );
}

// One-line status strip: what the current member may do here, and when a temporary
// grant expires. Silent for the super admin, who always has everything.
function AccessBanner({ state, memberId, today, activeTab, access }) {
  const feature = featureForTab(activeTab);
  const activeGrants = getActiveGrants(state, memberId, today).filter(
    (g) => g.feature === feature
  );
  const readOnly =
    !can(access, feature, 'edit') &&
    FEATURES.find((f) => f.key === feature)?.editable;

  if (!activeGrants.length && !readOnly) return null;

  const grant = activeGrants[0];
  const days = grant ? daysRemaining(grant, today) : null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 14px',
        marginBottom: '16px',
        borderRadius: '8px',
        fontSize: '0.85rem',
        background: grant ? 'rgba(16, 185, 129, 0.12)' : 'rgba(148, 163, 184, 0.12)',
        border: `1px solid ${grant ? '#10b981' : '#475569'}`,
        color: grant ? '#6ee7b7' : '#cbd5e1'
      }}
    >
      {grant ? <Clock size={16} /> : <Eye size={16} />}
      <span>
        {grant ? (
          <>
            Temporary <strong>{grant.level}</strong> access &mdash;{' '}
            {describeWindow(grant)}
            {days !== null && (
              <> ({days === 0 ? 'ends today' : `${days} day${days === 1 ? '' : 's'} left`})</>
            )}
          </>
        ) : (
          <>View only &mdash; you do not have edit rights for this section.</>
        )}
      </span>
    </div>
  );
}
