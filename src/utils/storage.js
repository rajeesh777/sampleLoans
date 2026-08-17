// Storage, Supabase Sync and State Management for "Isthooi" App

import { isSupabaseConfigured, fetchSupabaseState, syncStateToSupabase } from './supabaseClient';
import { normalizeAccess } from './permissions';

// Bumped to V3 when the member roster was replaced — member-keyed collections and
// loans from a V2 state no longer match the current members, so V2 state is not
// migrated. Old V2 data is left in localStorage untouched rather than deleted.
const STORAGE_KEY = 'ISTHOOI_APP_STATE_V3';

// Format date as DD/MM/YY
export const formatDateDDMMYY = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
};

// 9 initial members, listed in alphabetical order by name
export const INITIAL_MEMBERS = [
  { id: 'm1', name: 'Krishnadas', phone: '+91 9876543210', upiId: 'krishnadas@upi', avatarColor: '#10b981' },
  { id: 'm2', name: 'Murali', phone: '+91 9876543211', upiId: 'murali@upi', avatarColor: '#6366f1' },
  { id: 'm3', name: 'Rajan', phone: '+91 9876543212', upiId: 'rajan@upi', avatarColor: '#ec4899' },
  { id: 'm4', name: 'Rajeesh', phone: '+91 9876543213', upiId: 'rajeesh@upi', avatarColor: '#f59e0b' },
  { id: 'm5', name: 'Sajeev', phone: '+91 9876543214', upiId: 'sajeev@upi', avatarColor: '#3b82f6' },
  { id: 'm6', name: 'Sathyaprakasan', phone: '+91 9876543215', upiId: 'sathyaprakasan@upi', avatarColor: '#8b5cf6' },
  { id: 'm7', name: 'Udayan', phone: '+91 9876543216', upiId: 'udayan@upi', avatarColor: '#14b8a6' },
  { id: 'm8', name: 'Ullas', phone: '+91 9876543217', upiId: 'ullas@upi', avatarColor: '#f43f5e' },
  { id: 'm9', name: 'Vidyadas', phone: '+91 9876543218', upiId: 'vidyadas@upi', avatarColor: '#84cc16' }
];

// Helper to generate 52 Sundays starting from a given date
export const generate52Sundays = (startDateStr = '2026-01-04') => {
  const sundays = [];
  let currentDate = new Date(startDateStr);

  while (currentDate.getDay() !== 0) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (let i = 1; i <= 52; i++) {
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const dateFormatted = `${yyyy}-${mm}-${dd}`;

    sundays.push({
      weekNum: i,
      date: dateFormatted,
      displayDate: currentDate.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    });

    currentDate.setDate(currentDate.getDate() + 7);
  }
  return sundays;
};

// Seed initial state if none exists
export const getInitialState = () => {
  const startDate = '2026-01-04';
  const totalWeeks = 52;
  const sundays = generate52Sundays(startDate);

  const weeks = {};
  for (let i = 0; i < totalWeeks; i++) {
    const s = sundays[i];
    const collections = {};
    INITIAL_MEMBERS.forEach((m) => {
      collections[m.id] = {
        paid: false,
        amount: 1000,
        paymentMethod: 'UPI',
        paidAt: null,
        loanInstallmentPaid: false,
        loanInstallmentAmount: 0,
        loanInstallmentPaidAt: null
      };
    });

    weeks[s.weekNum] = {
      weekNum: s.weekNum,
      date: s.date,
      displayDate: s.displayDate,
      collections
    };
  }

  const sampleState = {
    groupName: 'Isthooi Savings Group',
    weeklyAmount: 1000,
    currentWeekNum: 3,
    startDate: startDate,
    totalWeeks: totalWeeks,
    members: INITIAL_MEMBERS,
    weeks,
    loans: [
      {
        id: 'loan-1',
        memberId: 'm2',
        nickname: 'Festival Advance',
        requestedAmount: 10000,
        disbursedAmount: 9000,
        upfrontFee: 1000,
        startWeekNum: 1,
        termWeeks: 10,
        weeklyInstallment: 1000,
        repaidAmount: 2000,
        status: 'ACTIVE',
        createdAt: '2026-01-04'
      }
    ],
    expenses: [
      {
        id: 'exp-1',
        description: 'Ledger register & stationery',
        amount: 250,
        weekNum: 1,
        date: '2026-01-04',
        paymentMethod: 'Cash',
        createdAt: '2026-01-04'
      },
      {
        id: 'exp-2',
        description: 'Tea & snacks at collection',
        amount: 450,
        weekNum: 2,
        date: '2026-01-11',
        paymentMethod: 'Cash',
        createdAt: '2026-01-11'
      }
    ],
    groupUpiVpa: 'isthooi@upi',
    groupNotes: 'Collection every Sunday around 8:00 PM.'
  };

  [1, 2].forEach((wNum) => {
    INITIAL_MEMBERS.forEach((m) => {
      sampleState.weeks[wNum].collections[m.id].paid = true;
      sampleState.weeks[wNum].collections[m.id].paidAt = sampleState.weeks[wNum].date;

      if (m.id === 'm2') {
        sampleState.weeks[wNum].collections[m.id].loanInstallmentPaid = true;
        sampleState.weeks[wNum].collections[m.id].loanInstallmentAmount = 1000;
      }
    });
  });

  // Test scenario: Mark Rajan (m3) as having unpaid weeks 1 and 2 to demo the dues feature
  sampleState.weeks[1].collections['m3'].paid = false;
  sampleState.weeks[1].collections['m3'].paidAt = null;
  sampleState.weeks[2].collections['m3'].paid = false;
  sampleState.weeks[2].collections['m3'].paidAt = null;

  // Rajeesh (m4) is picked up as super admin by name; Krishnadas starts as the
  // Collector so the role split is visible out of the box. Everyone else is read-only.
  sampleState.access = normalizeAccess({
    ...sampleState,
    access: { roles: { m1: 'collector' } }
  });

  return sampleState;
};

// Sync state to local storage & cloud database
export const saveState = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }

  // Also sync asynchronously to Supabase cloud database if configured
  if (isSupabaseConfigured) {
    syncStateToSupabase(state);
  }
};

// Load state from local storage or cloud
export const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const init = getInitialState();
      saveState(init);
      return init;
    }
    const parsed = JSON.parse(raw);
    // States saved before access control existed carry no `access` block, and members
    // may have been added or removed since the last save. Rebuilding it on every load
    // keeps roles, overrides and grants in step with the current roster.
    return { ...parsed, access: normalizeAccess(parsed) };
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return getInitialState();
  }
};

// Calculate member stats
export const getMemberStats = (state, memberId) => {
  const currentWeek = state.currentWeekNum || 1;
  let totalRegularPaid = 0;
  let unpaidPastWeeks = 0;
  let missedWeeksList = [];

  for (let w = 1; w <= currentWeek; w++) {
    const weekData = state.weeks[w];
    if (weekData && weekData.collections && weekData.collections[memberId]) {
      const rec = weekData.collections[memberId];
      if (rec.paid) {
        totalRegularPaid += (rec.amount || state.weeklyAmount || 1000);
      } else {
        unpaidPastWeeks++;
        missedWeeksList.push(w);
      }
    }
  }

  const memberLoans = (state.loans || []).filter((l) => l.memberId === memberId);
  const activeLoans = memberLoans.filter((l) => l.status === 'ACTIVE');
  const totalLoanLiability = activeLoans.reduce(
    (sum, l) => sum + (l.requestedAmount - l.repaidAmount),
    0
  );

  let status = 'CLEAN';
  let isBlocked = false;
  let isEligibleForLoan = true;

  if (unpaidPastWeeks === 1) {
    status = 'PENDING_1';
  } else if (unpaidPastWeeks === 2) {
    status = 'OVERDUE_2';
  } else if (unpaidPastWeeks === 3) {
    status = 'CRITICAL_3';
  } else if (unpaidPastWeeks > 3) {
    status = 'BLOCKED';
    isBlocked = true;
    isEligibleForLoan = false;
  }

  if (unpaidPastWeeks > 2) {
    isEligibleForLoan = false;
  }

  return {
    totalRegularPaid,
    unpaidPastWeeks,
    missedWeeksList,
    status,
    isBlocked,
    isEligibleForLoan,
    activeLoans,
    totalLoansTaken: memberLoans.length,
    totalLoanLiability
  };
};

// Cash actually held by the group at the end of a given week, derived from the weekly
// collection records so the figure can be audited week by week. Returns 0 for weekNum < 1.
//
// Note this runs slightly lower than groupStats.treasuryCash. That figure adds each loan's
// upfrontFee as cash in *and* subtracts disbursedAmount (which is already requested minus
// fee), so the fee is counted twice in the group's favour. Here a loan costs exactly the
// cash handed over — disbursedAmount — which keeps every week's closing balance equal to
// the next week's opening balance.
export const getCashAsOfWeek = (state, weekNum) => {
  if (weekNum < 1) return 0;

  const weeklyAmount = state.weeklyAmount || 1000;
  let contributions = 0;
  let loanReturns = 0;

  for (let w = 1; w <= weekNum; w++) {
    const weekData = state.weeks[w];
    if (!weekData || !weekData.collections) continue;

    Object.keys(weekData.collections).forEach((mId) => {
      const rec = weekData.collections[mId];
      if (rec.paid) contributions += (rec.amount || weeklyAmount);
      if (rec.loanInstallmentPaid) loanReturns += (rec.loanInstallmentAmount || 0);
    });
  }

  // Only loans already handed out by this week affect the balance. The upfront fee
  // never leaves the group, so the disbursed portion is the whole cash outflow.
  let disbursed = 0;
  (state.loans || []).forEach((l) => {
    if (l.startWeekNum <= weekNum) disbursed += l.disbursedAmount;
  });

  // Miscellaneous expenses leave the box in the week they are booked against.
  let expenses = 0;
  (state.expenses || []).forEach((e) => {
    if (Number(e.weekNum) <= weekNum) expenses += (e.amount || 0);
  });

  return contributions + loanReturns - disbursed - expenses;
};

// Everything that happened in a single week, for the dashboard week summary.
export const getWeekSummary = (state, weekNum) => {
  const weeklyAmount = state.weeklyAmount || 1000;
  const weekData = state.weeks[weekNum] || { collections: {} };
  const collections = weekData.collections || {};
  const members = state.members || [];
  const loans = state.loans || [];

  const memberName = (id) => (members.find(m => m.id === id) || {}).name || 'Unknown';

  // --- 1. Contributions ---
  const contributions = [];
  const notPaid = [];

  members.forEach((m) => {
    const rec = collections[m.id];
    const amount = rec?.amount || weeklyAmount;

    if (rec?.paid) {
      // Compare when it was actually paid against the Sunday it was due for.
      let timing = 'ON_TIME';
      if (rec.paidAt && weekData.date) {
        if (rec.paidAt < weekData.date) timing = 'ADVANCE';
        else if (rec.paidAt > weekData.date) timing = 'LATE';
      }
      contributions.push({
        memberId: m.id,
        name: m.name,
        avatarColor: m.avatarColor,
        amount,
        paymentMethod: rec.paymentMethod || 'UPI',
        paidAt: rec.paidAt || null,
        timing
      });
    } else {
      notPaid.push({ memberId: m.id, name: m.name, avatarColor: m.avatarColor, amount });
    }
  });

  const totalContribution = contributions.reduce((sum, c) => sum + c.amount, 0);

  // --- 2. Loan returns ---
  const loanReturns = [];
  members.forEach((m) => {
    const rec = collections[m.id];
    if (!rec?.loanInstallmentPaid) return;

    // The collection record carries one loan-installment flag per member per week,
    // so fall back to the member's active-loan installments when no amount is stored.
    const activeLoans = loans.filter(l => l.memberId === m.id && l.status === 'ACTIVE');
    const fallback = activeLoans.reduce((sum, l) => sum + (l.weeklyInstallment || 0), 0);
    const amount = rec.loanInstallmentAmount || fallback;

    loanReturns.push({
      memberId: m.id,
      name: m.name,
      avatarColor: m.avatarColor,
      amount,
      paidAt: rec.loanInstallmentPaidAt || null,
      loanNicknames: activeLoans.map(l => l.nickname).filter(Boolean)
    });
  });

  const totalLoanReturn = loanReturns.reduce((sum, r) => sum + r.amount, 0);

  // --- 3. New loans issued this week ---
  const newLoans = loans
    .filter(l => l.startWeekNum === weekNum)
    .map(l => ({
      loanId: l.id,
      memberId: l.memberId,
      name: memberName(l.memberId),
      nickname: l.nickname || '',
      requestedAmount: l.requestedAmount,
      disbursedAmount: l.disbursedAmount,
      upfrontFee: l.upfrontFee,
      status: l.status
    }));

  const totalNewLoanRequested = newLoans.reduce((sum, l) => sum + l.requestedAmount, 0);
  const totalNewLoanDisbursed = newLoans.reduce((sum, l) => sum + l.disbursedAmount, 0);

  // --- 4. Miscellaneous expenses booked to this week ---
  const expenses = (state.expenses || [])
    .filter((e) => Number(e.weekNum) === Number(weekNum))
    .map((e) => ({
      id: e.id,
      description: e.description || 'Miscellaneous expense',
      amount: e.amount || 0,
      paymentMethod: e.paymentMethod || 'Cash',
      date: e.date || weekData.date || null
    }));

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // --- 5. Calculations ---
  const openingCash = getCashAsOfWeek(state, weekNum - 1);
  const closingCash =
    (totalContribution + totalLoanReturn) + openingCash - totalNewLoanDisbursed - totalExpenses;

  return {
    weekNum,
    date: weekData.date,
    displayDate: weekData.displayDate,
    contributions,
    notPaid,
    totalContribution,
    loanReturns,
    totalLoanReturn,
    newLoans,
    totalNewLoanRequested,
    totalNewLoanDisbursed,
    expenses,
    totalExpenses,
    openingCash,
    closingCash
  };
};

// Calculate summary calculations for group
export const getGroupStats = (state) => {
  const currentWeek = state.currentWeekNum || 1;
  const weeklyAmount = state.weeklyAmount || 1000;
  const totalMembers = state.members.length;

  let totalRegularCollectedAllTime = 0;
  let currentWeekCollected = 0;
  let currentWeekPaidCount = 0;
  let totalOverdueMembersCount = 0;
  let totalBlockedMembersCount = 0;

  for (let w = 1; w <= 52; w++) {
    const weekData = state.weeks[w];
    if (weekData && weekData.collections) {
      Object.keys(weekData.collections).forEach((mId) => {
        const rec = weekData.collections[mId];
        if (rec.paid) {
          totalRegularCollectedAllTime += (rec.amount || weeklyAmount);
          if (w === currentWeek) {
            currentWeekCollected += (rec.amount || weeklyAmount);
            currentWeekPaidCount++;
          }
        }
      });
    }
  }

  const loans = state.loans || [];
  let totalDisbursedLoans = 0;
  let totalUpfrontFeesEarned = 0;
  let totalLoanPrincipalRepaid = 0;
  let totalActiveLoansBalance = 0;

  loans.forEach((l) => {
    totalDisbursedLoans += l.disbursedAmount;
    totalUpfrontFeesEarned += l.upfrontFee;
    totalLoanPrincipalRepaid += l.repaidAmount;
    if (l.status === 'ACTIVE') {
      totalActiveLoansBalance += (l.requestedAmount - l.repaidAmount);
    }
  });

  // Miscellaneous group spending (stationery, refreshments, ...) is cash that has
  // already left the box. It is paid out of the group's own earnings, so it reduces
  // the distributable profit pool as well as the treasury — but only once: the
  // treasury line below adds the gross fees and subtracts expenses separately.
  const totalExpenses = (state.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalGroupProfitsEarned = totalUpfrontFeesEarned - totalExpenses;

  const treasuryCash =
    totalRegularCollectedAllTime +
    totalUpfrontFeesEarned +
    totalLoanPrincipalRepaid -
    totalDisbursedLoans -
    totalExpenses;

  state.members.forEach((m) => {
    const mStats = getMemberStats(state, m.id);
    if (mStats.unpaidPastWeeks >= 2) {
      totalOverdueMembersCount++;
    }
    if (mStats.isBlocked) {
      totalBlockedMembersCount++;
    }
  });

  const currentWeekTarget = totalMembers * weeklyAmount;
  const totalAnnualBaseTarget = 52 * totalMembers * weeklyAmount;
  const estimatedProfitDividendPerMember = Math.round(totalGroupProfitsEarned / (totalMembers || 10));
  const estimatedAnnualPayoutPerMember = (52 * weeklyAmount) + estimatedProfitDividendPerMember;

  return {
    currentWeek,
    totalMembers,
    currentWeekTarget,
    currentWeekCollected,
    currentWeekPaidCount,
    currentWeekPendingCount: totalMembers - currentWeekPaidCount,
    totalRegularCollectedAllTime,
    totalDisbursedLoans,
    totalUpfrontFeesEarned,
    totalGroupProfitsEarned,
    totalLoanPrincipalRepaid,
    totalActiveLoansBalance,
    totalExpenses,
    treasuryCash,
    totalOverdueMembersCount,
    totalBlockedMembersCount,
    totalAnnualBaseTarget,
    estimatedProfitDividendPerMember,
    estimatedAnnualPayoutPerMember
  };
};
