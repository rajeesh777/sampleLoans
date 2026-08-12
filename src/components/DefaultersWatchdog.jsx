import React from 'react';
import { AlertTriangle, ShieldAlert, MessageCircle, CheckCircle2, Lock } from 'lucide-react';
import { getMemberStats } from '../utils/storage';

export default function DefaultersWatchdog({ state }) {
  const currentWeek = state.currentWeekNum || 1;

  // Gather stats for all members
  const memberListWithStats = state.members.map((m) => {
    const stats = getMemberStats(state, m.id);
    return {
      member: m,
      stats
    };
  });

  // Filter members with pending weeks
  const pendingMembers = memberListWithStats.filter((item) => item.stats.unpaidPastWeeks > 0);
  const cleanMembers = memberListWithStats.filter((item) => item.stats.unpaidPastWeeks === 0);

  const handleSendWhatsAppAlert = (mItem) => {
    const { member, stats } = mItem;
    const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
    const totalDue = stats.unpaidPastWeeks * (state.weeklyAmount || 1000) + stats.totalLoanLiability;

    let msg = `🚨 *URGENT PAYMENT ALERT — ${state.groupName || 'Sunday Savings Group'}*\n\n`;
    msg += `Hi ${member.name},\n`;
    msg += `You have *${stats.unpaidPastWeeks} unpaid Sunday contribution(s)* (Weeks: ${stats.missedWeeksList.join(', ')}).\n`;

    if (stats.unpaidPastWeeks >= 3) {
      msg += `⚠️ *CRITICAL:* You have reached/exceeded the maximum 3-week unpaid limit. Your loan privileges are currently locked until dues are cleared!\n`;
    }

    msg += `\n👉 *Total Outstanding Dues: ₹${totalDue.toLocaleString('en-IN')}*\n`;
    msg += `Please pay via UPI to *${state.groupUpiVpa || 'sundayfund@upi'}* immediately. Thank you!`;

    const encodedMsg = encodeURIComponent(msg);
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="defaulters-container">
      {/* Policy Header Card */}
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
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Standard Reminder</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge overdue_2">2 Wks Overdue</span>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Warning Notice</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge critical_3">3 Wks Critical</span>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Max Limit Reached</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span className="status-badge blocked">⛔ BLOCKED (&gt;3 Wks)</span>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>Loans Locked</div>
          </div>
        </div>
      </div>

      {/* Defaulter / Overdue List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <AlertTriangle size={18} color="#f43f5e" /> Members With Outstanding Dues ({pendingMembers.length})
          </span>
        </div>

        {pendingMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <CheckCircle2 size={40} color="#10b981" style={{ marginBottom: '8px' }} />
            <h4 style={{ color: '#34d399' }}>100% Clean Record!</h4>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>All {state.members.length} members are completely up-to-date with their Sunday contributions.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingMembers.map((mItem) => {
              const { member, stats } = mItem;
              const regularDues = stats.unpaidPastWeeks * (state.weeklyAmount || 1000);
              const totalOwed = regularDues + stats.totalLoanLiability;

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
                      onClick={() => handleSendWhatsAppAlert(mItem)}
                    >
                      <MessageCircle size={16} /> Send Urgent WA Alert
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Up to Date Members */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <CheckCircle2 size={18} color="#10b981" /> Members In Good Standing ({cleanMembers.length})
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {cleanMembers.map((mItem) => (
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
          ))}
        </div>
      </div>
    </div>
  );
}
