// Storage, Supabase Sync and State Management for "Isthooi" App

import { isSupabaseConfigured, fetchSupabaseState, syncStateToSupabase } from './supabaseClient';

const STORAGE_KEY = 'ISTHOOI_APP_STATE_V2';

// Sample 10 initial members
export const INITIAL_MEMBERS = [
  { id: 'm1', name: 'Rajesh Kumar', phone: '+91 9876543210', upiId: 'rajesh@upi', avatarColor: '#10b981' },
  { id: 'm2', name: 'Amit Sharma', phone: '+91 9876543211', upiId: 'amit@upi', avatarColor: '#6366f1' },
  { id: 'm3', name: 'Priya Patel', phone: '+91 9876543212', upiId: 'priya@upi', avatarColor: '#ec4899' },
  { id: 'm4', name: 'Suresh Raina', phone: '+91 9876543213', upiId: 'suresh@upi', avatarColor: '#f59e0b' },
  { id: 'm5', name: 'Vikram Singh', phone: '+91 9876543214', upiId: 'vikram@upi', avatarColor: '#3b82f6' },
  { id: 'm6', name: 'Ananya Roy', phone: '+91 9876543215', upiId: 'ananya@upi', avatarColor: '#8b5cf6' },
  { id: 'm7', name: 'Deepak Verma', phone: '+91 9876543216', upiId: 'deepak@upi', avatarColor: '#14b8a6' },
  { id: 'm8', name: 'Neha Gupta', phone: '+91 9876543217', upiId: 'neha@upi', avatarColor: '#f43f5e' },
  { id: 'm9', name: 'Rohan Mehta', phone: '+91 9876543218', upiId: 'rohan@upi', avatarColor: '#84cc16' },
  { id: 'm10', name: 'Kavita Reddy', phone: '+91 9876543219', upiId: 'kavita@upi', avatarColor: '#06b6d4' }
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
        loanInstallmentAmount: 0
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
    return parsed;
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
  let totalGroupProfitsEarned = 0;
  let totalLoanPrincipalRepaid = 0;
  let totalActiveLoansBalance = 0;

  loans.forEach((l) => {
    totalDisbursedLoans += l.disbursedAmount;
    totalGroupProfitsEarned += l.upfrontFee;
    totalLoanPrincipalRepaid += l.repaidAmount;
    if (l.status === 'ACTIVE') {
      totalActiveLoansBalance += (l.requestedAmount - l.repaidAmount);
    }
  });

  const treasuryCash =
    totalRegularCollectedAllTime +
    totalGroupProfitsEarned +
    totalLoanPrincipalRepaid -
    totalDisbursedLoans;

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
    totalGroupProfitsEarned,
    totalLoanPrincipalRepaid,
    totalActiveLoansBalance,
    treasuryCash,
    totalOverdueMembersCount,
    totalBlockedMembersCount,
    totalAnnualBaseTarget,
    estimatedProfitDividendPerMember,
    estimatedAnnualPayoutPerMember
  };
};
