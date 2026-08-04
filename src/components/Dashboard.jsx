import React from 'react';
import { IndianRupee, ShieldAlert, ArrowUpRight, CheckCircle2, Clock, HandCoins, AlertCircle, Award } from 'lucide-react';
import { getMemberStats } from '../utils/storage';

export default function Dashboard({ state, groupStats, setActiveTab, onTogglePayment }) {
  const currentWeekNum = state.currentWeekNum || 1;
  const currentWeekData = state.weeks[currentWeekNum] || { collections: {} };

  // Calculate 52-week year progress percentage
  const yearProgressPct = Math.round((currentWeekNum / 52) * 100);
  const sundayCollectionPct = Math.round(
    (groupStats.currentWeekPaidCount / (groupStats.totalMembers || 10)) * 100
  );

  // Check for critical defaulters (>= 3 weeks)
  const criticalDefaulters = state.members.filter((m) => {
    const stats = getMemberStats(state, m.id);
    return stats.unpaidPastWeeks >= 3;
  });

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
            Open Full Ledger <ArrowUpRight size={16} />
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

      {/* Critical Defaulters Alert Banner */}
      {criticalDefaulters.length > 0 && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15), #131b2e)',
            border: '1px solid #f43f5e'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#f43f5e', padding: '10px', borderRadius: '50%', color: 'white' }}>
              <ShieldAlert size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: '#f43f5e', fontWeight: '800' }}>
                🚨 {criticalDefaulters.length} Member(s) Exceeding 3-Week Default Limit!
              </h4>
              <p style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                Rule Policy: Members with &gt;= 3 unpaid weeks are blocked from taking new loans until dues are cleared.
              </p>
            </div>
            <button
              className="btn btn-rose btn-sm"
              onClick={() => setActiveTab('defaulters')}
            >
              View Alerts
            </button>
          </div>
        </div>
      )}

      {/* Key Financial Metrics */}
      <div className="metrics-grid">
        <div className="metric-card emerald">
          <div className="metric-label">
            <IndianRupee size={14} /> Total Treasury Cash
          </div>
          <div className="metric-value">₹{groupStats.treasuryCash.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Cash available in hand</div>
        </div>

        <div className="metric-card gold">
          <div className="metric-label">
            <Award size={14} /> 10% Profit Pool
          </div>
          <div className="metric-value">₹{groupStats.totalGroupProfitsEarned.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Accumulated upfront fees</div>
        </div>

        <div className="metric-card indigo">
          <div className="metric-label">
            <HandCoins size={14} /> Active Loans Out
          </div>
          <div className="metric-value">₹{groupStats.totalActiveLoansBalance.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Principal being remitted</div>
        </div>

        <div className="metric-card rose">
          <div className="metric-label">
            <AlertCircle size={14} /> Overdue Members
          </div>
          <div className="metric-value">{groupStats.totalOverdueMembersCount}</div>
          <div className="metric-subtext">{groupStats.totalBlockedMembersCount} blocked (&gt;3 wks)</div>
        </div>
      </div>

      {/* 52-Week Year Progress */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Clock size={18} color="#6366f1" /> 1-Year Financial Progress (52 Sundays)
          </span>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: '600' }}>
            Week {currentWeekNum} / 52 ({yearProgressPct}%)
          </span>
        </div>
        <div className="progress-bar-bg" style={{ height: '10px' }}>
          <div
            className="progress-bar-fill"
            style={{
              width: `${yearProgressPct}%`,
              background: 'linear-gradient(90deg, #6366f1, #10b981)'
            }}
          ></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#64748b', marginTop: '8px' }}>
          <span>Week 1 (Start)</span>
          <span>Target Annual Base: ₹{(520000).toLocaleString('en-IN')}</span>
          <span>Week 52 (Settlement)</span>
        </div>
      </div>

      {/* Quick Collection List for Current Sunday */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <CheckCircle2 size={18} color="#10b981" /> Today's Quick Payment Toggles (Week {currentWeekNum})
          </span>
          <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('ledger')}>
            View Full Screen
          </button>
        </div>

        <div className="members-collection-list">
          {state.members.slice(0, 5).map((member) => {
            const mStats = getMemberStats(state, member.id);
            const isPaid = currentWeekData.collections[member.id]?.paid || false;

            return (
              <div
                key={member.id}
                className={`member-card ${isPaid ? 'paid' : ''} ${mStats.isBlocked ? 'blocked' : ''}`}
              >
                <div className="member-info">
                  <div className="avatar" style={{ backgroundColor: member.avatarColor || '#10b981' }}>
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="member-name">
                      {member.name}
                      {mStats.status !== 'CLEAN' && (
                        <span className={`status-badge ${mStats.status.toLowerCase()}`}>
                          {mStats.unpaidPastWeeks} Wks Unpaid
                        </span>
                      )}
                    </div>
                    <div className="member-phone">{member.phone}</div>
                  </div>
                </div>

                <div className="action-group">
                  <div style={{ textAlign: 'right', marginRight: '8px' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sunday Regular</div>
                    <div style={{ fontWeight: '700', fontSize: '0.95rem' }}>₹1,000</div>
                  </div>

                  <button
                    className={`btn btn-toggle-paid ${isPaid ? 'paid' : 'unpaid'}`}
                    onClick={() => onTogglePayment(currentWeekNum, member.id)}
                  >
                    {isPaid ? <CheckCircle2 size={16} /> : null}
                    {isPaid ? 'PAID' : 'MARK PAID'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {state.members.length > 5 && (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('ledger')}>
              Show All 10 Members in Sunday Ledger →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
