import React from 'react';
import { Award, IndianRupee, Sparkles, CheckCircle2, TrendingUp, Users, ShieldAlert } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getMemberStats } from '../utils/storage';

export default function AnnualSettlement({ state, groupStats }) {
  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const currentWeek = state.currentWeekNum || 1;
  const isWeek52 = currentWeek >= 52;
  const totalMembersCount = state.members.length || 10;

  // Calculate annual settlement statement for each member
  const memberStatements = state.members.map((m) => {
    const mStats = getMemberStats(state, m.id);
    const regularInvested = mStats.totalRegularPaid;
    const profitDividend = groupStats.estimatedProfitDividendPerMember;
    const pendingLoanLiability = mStats.totalLoanLiability;
    const netPayout = regularInvested + profitDividend - pendingLoanLiability;

    return {
      member: m,
      stats: mStats,
      regularInvested,
      profitDividend,
      pendingLoanLiability,
      netPayout
    };
  });

  return (
    <div className="settlement-container">
      {/* Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #131b2e 100%)',
          border: '1px solid rgba(245, 158, 11, 0.4)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-badge gold">
                <Sparkles size={12} /> Week 52 Annual Dividend Settlement
              </span>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>1-Year Financial Closure</span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Year-End Annual Settlement Calculator</h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Every member gets back their base contributions (₹52,000 max) PLUS an equal 1/10th share of all 10% loan profits earned!
            </p>
          </div>

          <button
            className="btn btn-gold"
            onClick={triggerConfetti}
          >
            <Sparkles size={18} /> Celebrate Year-End 🎉
          </button>
        </div>
      </div>

      {/* Group Summary Metrics */}
      <div className="metrics-grid">
        <div className="metric-card emerald">
          <div className="metric-label">
            <IndianRupee size={14} /> Total Base Pool Target
          </div>
          <div className="metric-value">₹{(52 * state.members.length * (state.weeklyAmount || 1000)).toLocaleString('en-IN')}</div>
          <div className="metric-subtext">52 Wks × {state.members.length} Members × ₹{state.weeklyAmount || 1000}</div>
        </div>

        <div className="metric-card gold">
          <div className="metric-label">
            <Award size={14} /> Total Group Profit Pool
          </div>
          <div className="metric-value">₹{groupStats.totalGroupProfitsEarned.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Earned from 10% loan fees</div>
        </div>

        <div className="metric-card indigo">
          <div className="metric-label">
            <TrendingUp size={14} /> Profit Dividend / Member
          </div>
          <div className="metric-value">₹{groupStats.estimatedProfitDividendPerMember.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Equal 1/10th profit share</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-label">
            <Users size={14} /> Est. Final Payout / Member
          </div>
          <div className="metric-value">₹{groupStats.estimatedAnnualPayoutPerMember.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Base ₹52k + Profit Dividend</div>
        </div>
      </div>

      {/* Member Annual Settlement Statement Matrix */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <Award size={18} color="#f59e0b" /> Individual Member Closing Statements (Week 52)
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {memberStatements.map((stmt) => {
            const { member, regularInvested, profitDividend, pendingLoanLiability, netPayout } = stmt;

            return (
              <div
                key={member.id}
                style={{
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className="avatar" style={{ backgroundColor: member.avatarColor || '#10b981' }}>
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1rem', color: '#ffffff' }}>
                        {member.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        UPI: {member.upiId}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Net Final Annual Payout</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#34d399' }}>
                      ₹{netPayout.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Calculation breakdown line */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '10px',
                    marginTop: '12px',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    fontSize: '0.8rem'
                  }}
                >
                  <div>
                    <span style={{ color: '#94a3b8' }}>Base Invested:</span>
                    <div style={{ fontWeight: '700', color: '#ffffff' }}>₹{regularInvested.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span style={{ color: '#fbbf24' }}>+ 10% Profit Dividend:</span>
                    <div style={{ fontWeight: '700', color: '#fbbf24' }}>+ ₹{profitDividend.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span style={{ color: '#f87171' }}>- Unpaid Loans:</span>
                    <div style={{ fontWeight: '700', color: '#f87171' }}>- ₹{pendingLoanLiability.toLocaleString('en-IN')}</div>
                  </div>
                  <div>
                    <span style={{ color: '#34d399' }}>= Disbursable Cash:</span>
                    <div style={{ fontWeight: '800', color: '#34d399' }}>₹{netPayout.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
