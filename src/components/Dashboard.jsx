import React from 'react';
import { IndianRupee, ShieldAlert, ArrowUpRight, CheckCircle2, Clock, HandCoins, AlertCircle, Award, AlertTriangle, MessageCircle } from 'lucide-react';
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

      {/* 3-Week Default Rule Enforcement */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #131b2e 0%, #1c2742 100%)',
          border: '1px solid rgba(244, 63, 94, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: '#f43f5e', padding: '12px', borderRadius: 'var(--radius-md)', color: 'white' }}>
            <ShieldAlert size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>3-Week Default Rule Enforcement</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Rule Policy: A member cannot fail for more than 3 consecutive weeks to pay their weekly contribution.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginTop: '16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge pending_1">1 Wk Pending</span>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Standard Reminder</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge overdue_2">2 Wks Overdue</span>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Warning Notice</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge critical_3">3 Wks Critical</span>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Max Limit Reached</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge blocked">⛔ BLOCKED (&gt;3 Wks)</span>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>Loans Locked</div>
          </div>
        </div>
      </div>

      {/* Loan Summary Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1c3a1c 0%, #1e293b 100%)',
          border: '1px solid rgba(16, 185, 129, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ background: '#10b981', padding: '12px', borderRadius: 'var(--radius-md)', color: 'white' }}>
            <HandCoins size={26} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: '800' }}>Loan Portfolio Summary</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Active loans and repayment tracking (10-week term)
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Active Loans</span>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
              {state.loans.filter(l => l.status === 'ACTIVE').length}
            </div>
          </div>
          <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Outstanding</span>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#3b82f6', marginTop: '4px' }}>
              ₹{groupStats.totalActiveLoansBalance.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ background: 'rgba(251, 146, 60, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(251, 146, 60, 0.3)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Group Profits</span>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#fbbf24', marginTop: '4px' }}>
              ₹{groupStats.totalGroupProfitsEarned.toLocaleString('en-IN')}
            </div>
          </div>
          <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '600' }}>Closed Loans</span>
            <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#22c55e', marginTop: '4px' }}>
              {state.loans.filter(l => l.status === 'REPAID').length}
            </div>
          </div>
        </div>

        {(() => {
          const urgentLoans = state.loans.filter(l => {
            if (l.status !== 'ACTIVE') return false;
            const weeksRemaining = l.startWeekNum + l.termWeeks - currentWeekNum;
            return weeksRemaining <= 2 && weeksRemaining > 0;
          });

          if (urgentLoans.length > 0) {
            return (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#fca5a5', marginBottom: '8px' }}>
                  ⚠️ {urgentLoans.length} Loan(s) closing soon ({urgentLoans.map((l, idx) => idx === 0 ? `${l.startWeekNum + l.termWeeks - currentWeekNum} wk${l.startWeekNum + l.termWeeks - currentWeekNum !== 1 ? 's' : ''}` : '').filter(Boolean)})
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Members with Outstanding Dues */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <AlertTriangle size={18} color="#f43f5e" /> Members With Outstanding Dues ({(() => {
              const memberListWithStats = state.members.map((m) => {
                const stats = getMemberStats(state, m.id);
                return { member: m, stats };
              });
              return memberListWithStats.filter((item) => item.stats.unpaidPastWeeks > 0).length;
            })()})
          </span>
        </div>

        {(() => {
          const memberListWithStats = state.members.map((m) => {
            const stats = getMemberStats(state, m.id);
            return { member: m, stats };
          });
          const pendingMembers = memberListWithStats.filter((item) => item.stats.unpaidPastWeeks > 0);
          const cleanMembers = memberListWithStats.filter((item) => item.stats.unpaidPastWeeks === 0);

          if (pendingMembers.length === 0) {
            return (
              <div style={{ textAlign: 'center', padding: '30px 0' }}>
                <CheckCircle2 size={40} color="#10b981" style={{ marginBottom: '8px' }} />
                <h4 style={{ color: '#34d399' }}>100% Clean Record!</h4>
                <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>All {state.members.length} members are completely up-to-date with their Sunday contributions.</p>
              </div>
            );
          }

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingMembers.map((mItem) => {
                const { member, stats } = mItem;
                const regularDues = stats.unpaidPastWeeks * (state.weeklyAmount || 1000);
                const totalOwed = regularDues + stats.totalLoanLiability;

                const handleSendWhatsAppAlert = () => {
                  const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
                  let msg = `🚨 *URGENT PAYMENT ALERT — ${state.groupName || 'Sunday Savings Group'}*\n\n`;
                  msg += `Hi ${member.name},\n`;
                  msg += `You have *${stats.unpaidPastWeeks} unpaid Sunday contribution(s)* (Weeks: ${stats.missedWeeksList.join(', ')}).\n`;
                  if (stats.unpaidPastWeeks >= 3) {
                    msg += `⚠️ *CRITICAL:* You have reached/exceeded the maximum 3-week unpaid limit. Your loan privileges are currently locked until dues are cleared!\n`;
                  }
                  msg += `\n👉 *Total Outstanding Dues: ₹${totalOwed.toLocaleString('en-IN')}*\n`;
                  msg += `Please pay via UPI to *${state.groupUpiVpa || 'sundayfund@upi'}* immediately. Thank you!`;
                  const encodedMsg = encodeURIComponent(msg);
                  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
                  window.open(waUrl, '_blank');
                };

                return (
                  <div
                    key={member.id}
                    className={`member-card ${stats.isBlocked ? 'blocked' : 'overdue'}`}
                    style={{ padding: '16px' }}
                  >
                    <div className="member-info">
                      <div className="avatar" style={{ backgroundColor: member.avatarColor || '#f43f5e' }}>
                        {member.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="member-name">
                          {member.name}
                          {stats.status === 'PENDING_1' && <span className="status-badge pending_1">1 Wk Pending</span>}
                          {stats.status === 'OVERDUE_2' && <span className="status-badge overdue_2">2 Wks Overdue</span>}
                          {stats.status === 'CRITICAL_3' && <span className="status-badge critical_3">🚨 3 Wks Max Limit</span>}
                          {stats.status === 'BLOCKED' && <span className="status-badge blocked">⛔ BLOCKED DEFAULTER</span>}
                        </div>
                        <div className="member-phone">{member.phone} • UPI: {member.upiId}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.85rem' }}>
                      <div style={{ color: '#f87171', fontWeight: '700' }}>
                        {stats.unpaidPastWeeks} Unpaid Sunday(s): Weeks {stats.missedWeeksList.join(', ')}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                        Sunday Dues: ₹{regularDues.toLocaleString('en-IN')} {stats.totalLoanLiability > 0 ? `+ Loan Owed: ₹${stats.totalLoanLiability.toLocaleString('en-IN')}` : ''}
                      </div>
                    </div>

                    <div className="action-group">
                      <button
                        className="btn btn-whatsapp"
                        onClick={handleSendWhatsAppAlert}
                      >
                        <MessageCircle size={16} /> Send Urgent WA Alert
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* Clean Members */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <CheckCircle2 size={18} color="#10b981" /> Members In Good Standing ({(() => {
              const memberListWithStats = state.members.map((m) => {
                const stats = getMemberStats(state, m.id);
                return { member: m, stats };
              });
              return memberListWithStats.filter((item) => item.stats.unpaidPastWeeks === 0).length;
            })()})
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {(() => {
            const memberListWithStats = state.members.map((m) => {
              const stats = getMemberStats(state, m.id);
              return { member: m, stats };
            });
            const cleanMembers = memberListWithStats.filter((item) => item.stats.unpaidPastWeeks === 0);
            return cleanMembers.map((mItem) => (
              <div
                key={mItem.member.id}
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  padding: '8px 14px',
                  borderRadius: '9999px',
                  fontSize: '0.825rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#34d399'
                }}
              >
                <CheckCircle2 size={14} /> {mItem.member.name}
              </div>
            ));
          })()}
        </div>
      </div>

    </div>
  );
}
