import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Eye, LogOut, ShieldAlert } from 'lucide-react';
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

export default function App() {
  const [state, setState] = useState(() => loadState());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loggedInMember, setLoggedInMember] = useState(() => {
    const saved = localStorage.getItem('ISTHOOI_LOGGED_IN_MEMBER');
    return saved ? JSON.parse(saved) : null;
  });

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

  // Save logged-in member to localStorage
  useEffect(() => {
    if (loggedInMember) {
      localStorage.setItem('ISTHOOI_LOGGED_IN_MEMBER', JSON.stringify(loggedInMember));
    } else {
      localStorage.removeItem('ISTHOOI_LOGGED_IN_MEMBER');
    }
  }, [loggedInMember]);

  // Login handler
  const handleLogin = (member) => {
    setLoggedInMember(member);
    setActiveTab('dashboard');
  };

  // Logout handler
  const handleLogout = () => {
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

  // Toggle regular Sunday contribution payment
  const handleTogglePayment = (weekNum, memberId) => {
    if (blocked('contributions')) return;
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const currentWeekData = nextWeeks[weekNum] || { collections: {} };
      const memberColl = currentWeekData.collections[memberId] || {
        paid: false,
        amount: prevState.weeklyAmount || 1000,
        paymentMethod: 'UPI',
        paidAt: null,
        loanInstallmentPaid: false,
        loanInstallmentAmount: 0,
        loanInstallmentPaidAt: null
      };

      const newPaid = !memberColl.paid;

      nextWeeks[weekNum] = {
        ...currentWeekData,
        collections: {
          ...currentWeekData.collections,
          [memberId]: {
            ...memberColl,
            paid: newPaid,
            paidAt: newPaid ? new Date().toISOString().slice(0, 10) : null
          }
        }
      };

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Toggle loan installment payment for a member on a specific Sunday
  const handleToggleLoanInstallment = (weekNum, memberId, loanId) => {
    if (blocked('loan-collections')) return;
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const currentWeekData = nextWeeks[weekNum] || { collections: {} };
      const memberColl = currentWeekData.collections[memberId] || {};

      const currentLoanPaid = memberColl.loanInstallmentPaid || false;
      const newLoanPaid = !currentLoanPaid;

      // Find loan
      const targetLoan = prevState.loans.find((l) => l.id === loanId);
      const installmentAmt = targetLoan ? targetLoan.weeklyInstallment : 1000;

      // Update loan repaidAmount
      const nextLoans = prevState.loans.map((loan) => {
        if (loan.id === loanId) {
          const delta = newLoanPaid ? installmentAmt : -installmentAmt;
          const newRepaid = Math.max(0, loan.repaidAmount + delta);
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

      nextWeeks[weekNum] = {
        ...currentWeekData,
        collections: {
          ...currentWeekData.collections,
          [memberId]: {
            ...memberColl,
            loanInstallmentPaid: newLoanPaid,
            loanInstallmentAmount: newLoanPaid ? installmentAmt : 0,
            loanInstallmentPaidAt: newLoanPaid ? new Date().toISOString().slice(0, 10) : null
          }
        }
      };

      return {
        ...prevState,
        weeks: nextWeeks,
        loans: nextLoans
      };
    });
  };

  // Change payment method (UPI, Cash, Bank)
  const handleChangePaymentMethod = (weekNum, memberId, method) => {
    if (blocked('contributions')) return;
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const weekData = nextWeeks[weekNum] || { collections: {} };
      const memberColl = weekData.collections[memberId] || {
        paid: false,
        amount: prevState.weeklyAmount || 1000,
        paymentMethod: 'UPI',
        paidAt: null,
        loanInstallmentPaid: false,
        loanInstallmentAmount: 0,
        loanInstallmentPaidAt: null
      };

      nextWeeks[weekNum] = {
        ...weekData,
        collections: {
          ...weekData.collections,
          [memberId]: {
            ...memberColl,
            paymentMethod: method
          }
        }
      };

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Advance payment for Sunday contributions (custom amount distributed across weeks)
  const handleAdvancePayment = (startWeek, memberId, totalAmount, method = 'UPI') => {
    if (blocked('contributions')) return;
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const weeklyAmount = prevState.weeklyAmount || 1000;
      let remainingAmount = totalAmount;
      let currentWeek = startWeek;

      while (remainingAmount > 0 && currentWeek <= 52) {
        const weekData = nextWeeks[currentWeek] || { collections: {} };
        const memberColl = weekData.collections[memberId] || {
          paid: false,
          amount: weeklyAmount,
          paymentMethod: 'UPI',
          paidAt: null,
          loanInstallmentPaid: false,
          loanInstallmentAmount: 0,
          loanInstallmentPaidAt: null
        };
        const amountForThisWeek = Math.min(remainingAmount, weeklyAmount);

        nextWeeks[currentWeek] = {
          ...weekData,
          collections: {
            ...weekData.collections,
            [memberId]: {
              ...memberColl,
              paid: true,
              amount: amountForThisWeek,
              paidAt: new Date().toISOString().slice(0, 10),
              paymentMethod: method
            }
          }
        };

        remainingAmount -= amountForThisWeek;
        currentWeek++;
      }

      return {
        ...prevState,
        weeks: nextWeeks
      };
    });
  };

  // Advance payment for loan installments (custom amount distributed across weeks)
  const handleAdvanceLoanInstallment = (startWeek, memberId, loanId, totalAmount) => {
    if (blocked('loan-collections')) return;
    setState((prevState) => {
      const nextWeeks = { ...prevState.weeks };
      const targetLoan = prevState.loans.find((l) => l.id === loanId);
      const installmentAmt = targetLoan ? targetLoan.weeklyInstallment : 1000;
      let remainingAmount = totalAmount;
      let currentWeek = startWeek;
      let totalAdvancePayment = 0;

      while (remainingAmount > 0 && currentWeek <= 52) {
        const weekData = nextWeeks[currentWeek] || { collections: {} };
        const memberColl = weekData.collections[memberId] || {};
        const amountForThisWeek = Math.min(remainingAmount, installmentAmt);

        nextWeeks[currentWeek] = {
          ...weekData,
          collections: {
            ...weekData.collections,
            [memberId]: {
              ...memberColl,
              loanInstallmentPaid: true,
              loanInstallmentAmount: amountForThisWeek,
              loanInstallmentPaidAt: new Date().toISOString().slice(0, 10)
            }
          }
        };

        totalAdvancePayment += amountForThisWeek;
        remainingAmount -= amountForThisWeek;
        currentWeek++;
      }

      // Update loan repaidAmount
      const nextLoans = prevState.loans.map((loan) => {
        if (loan.id === loanId) {
          const newRepaid = Math.min(loan.requestedAmount, loan.repaidAmount + totalAdvancePayment);
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
        weeks: nextWeeks,
        loans: nextLoans
      };
    });
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
    setState((prevState) => {
      const weekNum = Number(expense.weekNum) || prevState.currentWeekNum || 1;
      const newExpense = {
        id: `exp-${Date.now()}`,
        description: (expense.description || '').trim() || 'Miscellaneous expense',
        amount: Number(expense.amount) || 0,
        weekNum,
        // Default to the week's Sunday so the expense sorts with that week's activity
        date: expense.date || prevState.weeks[weekNum]?.date || new Date().toISOString().slice(0, 10),
        paymentMethod: expense.paymentMethod || 'Cash',
        createdAt: new Date().toISOString().slice(0, 10)
      };

      return {
        ...prevState,
        expenses: [newExpense, ...(prevState.expenses || [])]
      };
    });
  };

  // Edit an existing miscellaneous expense
  const handleUpdateExpense = (expenseId, updates) => {
    if (blocked('settings')) return;
    setState((prevState) => {
      const nextExpenses = (prevState.expenses || []).map((e) => {
        if (e.id !== expenseId) return e;
        const weekNum = Number(updates.weekNum) || e.weekNum;
        return {
          ...e,
          description: (updates.description || '').trim() || e.description,
          amount: Number(updates.amount) || 0,
          weekNum,
          date: updates.date || prevState.weeks[weekNum]?.date || e.date,
          paymentMethod: updates.paymentMethod || e.paymentMethod
        };
      });

      return {
        ...prevState,
        expenses: nextExpenses
      };
    });
  };

  // Remove a miscellaneous expense; the amount returns to treasury cash
  const handleDeleteExpense = (expenseId) => {
    if (blocked('settings')) return;
    setState((prevState) => ({
      ...prevState,
      expenses: (prevState.expenses || []).filter((e) => e.id !== expenseId)
    }));
  };

  // Import JSON backup
  const handleImportState = (importedData) => {
    if (blocked('settings')) return;
    // A backup may predate access control, or carry a roster that no longer matches
    // its access block — rebuild it so an import can never leave the group locked out.
    setState({ ...importedData, access: normalizeAccess(importedData) });
  };

  // Reset to initial demo state
  const handleResetState = () => {
    if (blocked('settings')) return;
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
          ceaseDate: new Date().toISOString().slice(0, 10)
        }
      }
    }));
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
  };

  // Toggle global edit lock
  const handleToggleEditLock = () => {
    if (blocked('settings')) return;
    setState((prevState) => ({
      ...prevState,
      editLocked: !prevState.editLocked
    }));
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
  };

  // Time-boxed elevation: valid between `from` and `until` inclusive, then it lapses.
  const handleAddGrant = (grantInput) => {
    updateAccess((current) => ({
      ...current,
      grants: [
        createGrant({ ...grantInput, grantedBy: currentMember?.id }),
        ...current.grants
      ]
    }));
  };

  const handleRevokeGrant = (grantId) => {
    updateAccess((current) => ({
      ...current,
      grants: current.grants.filter((g) => g.id !== grantId)
    }));
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
  };

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
            onSetMemberRole={handleSetMemberRole}
            onSetFeatureOverride={handleSetFeatureOverride}
            onAddGrant={handleAddGrant}
            onRevokeGrant={handleRevokeGrant}
            onTransferSuperAdmin={handleTransferSuperAdmin}
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
