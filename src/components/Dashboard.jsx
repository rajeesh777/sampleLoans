import React from 'react';
import { IndianRupee, ShieldAlert, ArrowUpRight, CheckCircle2, HandCoins, AlertCircle, Award, AlertTriangle } from 'lucide-react';
import { getMemberStats } from '../utils/storage';
import WeekSummary from './WeekSummary';

export default function Dashboard({ state, groupStats, setActiveTab, onTogglePayment, loggedInMember }) {
  const currentWeekNum = state.currentWeekNum || 1;
  const currentWeekData = state.weeks[currentWeekNum] || { collections: {} };

  // Calculate 52-week year progress percentage
  const yearProgressPct = Math.round((currentWeekNum / 52) * 100);
  const sundayCollectionPct = Math.round(
    (groupStats.currentWeekPaidCount / (groupStats.totalMembers || 10)) * 100
  );

  // Compute member stats once — this used to be recalculated for every member
  // five separate times further down the page.
  const memberStats = state.members.map((m) => ({ member: m, stats: getMemberStats(state, m.id) }));
  const criticalDefaulters = memberStats.filter(({ stats }) => stats.unpaidPastWeeks >= 3);
  const pendingMembers = memberStats.filter(({ stats }) => stats.unpaidPastWeeks > 0);
  const cleanCount = memberStats.length - pendingMembers.length;

  const weeklyAmount = state.weeklyAmount || 1000;
  const unpaidContributions = pendingMembers.reduce(
    (sum, { stats }) => sum + stats.unpaidPastWeeks * weeklyAmount,
    0
  );

  const activeLoanCount = state.loans.filter((l) => l.status === 'ACTIVE').length;
  const closedLoanCount = state.loans.filter((l) => l.status === 'REPAID').length;

  // Loans with 2 weeks or less left to run
  const urgentLoans = state.loans.filter((l) => {
    if (l.status !== 'ACTIVE') return false;
    const weeksRemaining = l.startWeekNum + l.termWeeks - currentWeekNum;
    return weeksRemaining <= 2 && weeksRemaining > 0;
  });

  const money = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  return (
    <div className="dashboard-container">
      {/* 8 PM Sunday Collection Quick Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #131b2e 0%, #1e293b 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-badge clean">⚡ 8:00 PM Collection Mode</span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                {currentWeekData.displayDate || `Sunday (Week ${currentWeekNum})`}
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginTop: '4px' }}>
              Week {currentWeekNum} Sunday Collection
            </h2>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setActiveTab('ledger')}
          >
            Open Fund Book <ArrowUpRight size={16} />
          </button>
        </div>

        {/* Collection Progress */}
        <div style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: '600', marginBottom: '4px' }}>
            <span>Collection Status ({groupStats.currentWeekPaidCount}/{groupStats.totalMembers} Paid)</span>
            <span style={{ color: '#10b981' }}>₹{groupStats.currentWeekCollected.toLocaleString('en-IN')} / ₹{groupStats.currentWeekTarget.toLocaleString('en-IN')}</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${sundayCollectionPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* Week Summary */}
      <WeekSummary state={state} loggedInMember={loggedInMember} />

      {/* Critical Defaulters Alert Banner */}
      {criticalDefaulters.length > 0 && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), #131b2e)',
            border: '1px solid #f43f5e'
          }}
        >
          {/* One line. The full rule text is stated in the defaulters view this
              links to, so repeating it here only added height. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <ShieldAlert size={20} color="#f43f5e" />
            <span style={{ flex: 1, minWidth: '150px', fontSize: '0.9rem', fontWeight: '700', color: '#f43f5e' }}>
              {criticalDefaulters.length} member{criticalDefaulters.length !== 1 ? 's' : ''} blocked — 3+ weeks unpaid
            </span>
            <button
              className="btn btn-rose btn-sm"
              onClick={() => setActiveTab('defaulters')}
            >
              View
            </button>
          </div>
        </div>
      )}

      {/* At-a-glance figures. Replaces eight tiles across two gradient cards,
          two of which showed identical values (Active Loans Out == Outstanding,
          10% Profit Pool == Group Profits). */}
      <div className="card">
        <div className="metrics-grid" style={{ marginBottom: 0 }}>
          <div className="metric-card emerald">
            <div className="metric-label"><IndianRupee size={14} /> In Hand</div>
            <div className="metric-value">{money(groupStats.treasuryCash)}</div>
          </div>
          <div className="metric-card indigo">
            <div className="metric-label"><HandCoins size={14} /> Loans Out</div>
            <div className="metric-value">{money(groupStats.totalActiveLoansBalance)}</div>
          </div>
          <div className="metric-card gold">
            <div className="metric-label"><Award size={14} /> Profit Pool</div>
            <div className="metric-value">{money(groupStats.totalGroupProfitsEarned)}</div>
          </div>
          <div className="metric-card rose">
            <div className="metric-label"><AlertCircle size={14} /> Overdue</div>
            <div className="metric-value">{groupStats.totalOverdueMembersCount}</div>
          </div>
        </div>

        {/* Loan counts and year progress, one line each */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.85rem' }}>
            <span style={{ color: '#94a3b8' }}>
              <strong style={{ color: '#e5e7eb' }}>{activeLoanCount}</strong> active loan{activeLoanCount !== 1 ? 's' : ''}
              {closedLoanCount > 0 && <> · <strong style={{ color: '#e5e7eb' }}>{closedLoanCount}</strong> closed</>}
            </span>
            <span style={{ color: '#94a3b8' }}>
              Week <strong style={{ color: '#e5e7eb' }}>{currentWeekNum}</strong> of 52 ({yearProgressPct}%)
            </span>
          </div>

          <div className="progress-bar-bg" style={{ height: '4px', marginTop: '8px' }}>
            <div
              className="progress-bar-fill"
              style={{ width: `${yearProgressPct}%`, background: 'linear-gradient(90deg, #6366f1, #10b981)' }}
            ></div>
          </div>

          {urgentLoans.length > 0 && (
            <div style={{ fontSize: '0.82rem', color: '#fca5a5', marginTop: '10px' }}>
              ⚠️ {urgentLoans.length} loan{urgentLoans.length !== 1 ? 's' : ''} closing within 2 weeks
            </div>
          )}
        </div>
      </div>

      {/* Dues summary. The full per-member list with WhatsApp alerts lives in the
          defaulters view, reached from here and from the header Overdue badge. */}
      {pendingMembers.length === 0 ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <CheckCircle2 size={20} color="#10b981" />
          <span style={{ fontSize: '0.9rem', color: '#34d399', fontWeight: '600' }}>
            All {state.members.length} members are up to date
          </span>
        </div>
      ) : (
        <button
          onClick={() => setActiveTab('defaulters')}
          className="card"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: '12px', width: '100%', textAlign: 'left', cursor: 'pointer',
            font: 'inherit', color: 'inherit'
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <AlertTriangle size={20} color="#f43f5e" />
            <span style={{ fontSize: '0.9rem' }}>
              <strong style={{ color: '#f87171' }}>{pendingMembers.length}</strong> member{pendingMembers.length !== 1 ? 's' : ''} owe{pendingMembers.length === 1 ? 's' : ''}{' '}
              <strong style={{ color: '#f87171' }}>{money(unpaidContributions)}</strong>
              {cleanCount > 0 && (
                <span style={{ color: '#94a3b8' }}> · {cleanCount} up to date</span>
              )}
            </span>
          </span>
          <ArrowUpRight size={18} color="#94a3b8" />
        </button>
      )}

    </div>
  );
}
