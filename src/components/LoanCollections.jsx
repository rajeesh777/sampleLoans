import React, { useState } from 'react';
import { Calendar, CheckCircle2, CheckSquare, Clock, Filter, Tag, Lock } from 'lucide-react';
import { getMemberStats, formatDateDDMMYY } from '../utils/storage';

export default function LoanCollections({
  state,
  editLocked,
  onToggleLoanInstallment,
  onMarkAllPaid,
  onAdvanceLoanInstallment,
  onCeaseWeek
}) {
  const [selectedWeek, setSelectedWeek] = useState(state.currentWeekNum || 1);
  const [filterMode, setFilterMode] = useState('ALL');
  const [loanPaymentModal, setLoanPaymentModal] = useState(null);
  const [loanPaymentAmount, setLoanPaymentAmount] = useState(0);
  const [showCeaseConfirm, setShowCeaseConfirm] = useState(false);
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'closed'

  const weekData = state.weeks[selectedWeek] || { collections: {} };

  const weekPills = [];
  for (let i = 1; i <= 52; i++) {
    weekPills.push(i);
  }

  const filteredMembers = state.members.filter((m) => {
    const mStats = getMemberStats(state, m.id);
    const hasActiveLoan = mStats.activeLoans.length > 0;
    if (!hasActiveLoan) return false;

    const rec = weekData.collections[m.id] || {};
    const isPaid = rec.loanInstallmentPaid || false;
    if (filterMode === 'UNPAID') return !isPaid;
    if (filterMode === 'PAID') return isPaid;
    return true;
  });

  return (
    <div className="sunday-ledger-container">
      {/* Week Selector Ribbon */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={18} color="#f59e0b" /> Select Sunday (Week 1 to 52)
          </span>
          <span style={{ fontSize: '0.85rem', color: '#fbbf24', fontWeight: '600' }}>
            {weekData.displayDate}
          </span>
        </div>

        <div className="week-selector-container">
          {weekPills.map((wNum) => (
            <button
              key={wNum}
              className={`week-pill ${selectedWeek === wNum ? 'active' : ''}`}
              onClick={() => setSelectedWeek(wNum)}
            >
              Wk {wNum}
            </button>
          ))}
        </div>
      </div>

      {/* Header Actions & Filter */}
      <div
        className="card"
        style={{
          background: weekData.ceased
            ? 'linear-gradient(135deg, #1f2937 0%, #111827 100%)'
            : 'linear-gradient(135deg, #7c2d12 0%, #92400e 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          border: weekData.ceased ? '2px solid #6b7280' : 'none'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            {viewMode === 'active' ? 'Loan Collections' : 'Closed Loans'} — Week {selectedWeek} ({formatDateDDMMYY(weekData.date)})
            {weekData.ceased && (
              <span className="status-badge" style={{ background: '#6b7280', color: '#f3f4f6', fontSize: '0.75rem' }}>
                🔒 CEASED
              </span>
            )}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#fcd34d' }}>
            {viewMode === 'active' ? 'Track loan installment payments' : 'View completed and repaid loans'}
            {weekData.ceased && <span style={{ marginLeft: '12px', color: '#9ca3af' }}>Ceased on {weekData.ceaseDate}</span>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={() => setViewMode(viewMode === 'active' ? 'closed' : 'active')}
            style={{
              background: viewMode === 'active' ? '#f59e0b' : '#6b7280',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {viewMode === 'active' ? '📋 View Closed Loans' : '⏳ View Active Loans'}
          </button>

          {viewMode === 'active' && (
            <>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setFilterMode(filterMode === 'ALL' ? 'UNPAID' : 'ALL')}
                disabled={weekData.ceased || editLocked}
              >
                <Filter size={14} /> Filter: {filterMode}
              </button>

              <button
                className="btn btn-primary btn-sm"
                onClick={() => onMarkAllPaid(selectedWeek)}
                disabled={weekData.ceased || editLocked}
              >
                <CheckSquare size={16} /> Mark All Paid
              </button>
            </>
          )}

          {editLocked && (
            <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> Editing Locked
            </span>
          )}
        </div>
      </div>

      {/* Members with Active/Closed Loans */}
      <div className="members-collection-list">
        {viewMode === 'active' ? (
          // ACTIVE LOANS VIEW
          filteredMembers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem', marginBottom: '8px' }}>No active loans this week</p>
              <p style={{ fontSize: '0.85rem' }}>Members with active loans will appear here</p>
            </div>
          ) : (
            filteredMembers.map((member) => {
              const mStats = getMemberStats(state, member.id);
              const activeLoan = mStats.activeLoans[0];
              const rec = weekData.collections[member.id] || {};

              if (!activeLoan) return null;

            const loanNickname = activeLoan.nickname || 'Loan';
            const remainingBalance = activeLoan.requestedAmount - activeLoan.repaidAmount;
            const weeksRemaining = activeLoan.startWeekNum + activeLoan.termWeeks - selectedWeek;
            const isUrgent = weeksRemaining <= 2;

            return (
              <div
                key={member.id}
                className={`member-card ${remainingBalance === 0 ? 'paid' : ''}`}
                style={isUrgent && remainingBalance > 0 ? { borderColor: '#ef4444', borderWidth: '2px' } : {}}
              >
                <div className="member-info">
                  <div className="avatar" style={{ backgroundColor: member.avatarColor || '#f59e0b' }}>
                    {member.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="member-name">
                      {member.name}
                      <span className="status-badge gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Tag size={10} /> {loanNickname}
                      </span>
                    </div>
                    <div className="member-phone">{member.phone} • UPI: {member.upiId}</div>
                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                      Outstanding: ₹{remainingBalance.toLocaleString('en-IN')} •
                      Repaid: ₹{activeLoan.repaidAmount.toLocaleString('en-IN')}/₹{activeLoan.requestedAmount.toLocaleString('en-IN')}
                      {weeksRemaining > 0 && ` • ${weeksRemaining} wk${weeksRemaining !== 1 ? 's' : ''} left`}
                    </div>
                  </div>
                </div>

                {/* Loan Repayment Status */}
                <div className="due-breakdown">
                  <div className="due-item">
                    <span className="due-item-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Tag size={10} color="#fbbf24" /> Repayment Status
                    </span>
                    <span className="due-item-val" style={{ color: remainingBalance === 0 ? '#10b981' : isUrgent ? '#ef4444' : '#f59e0b' }}>
                      {remainingBalance === 0 ? '✓ CLOSED' : isUrgent ? `🚨 ${weeksRemaining} WK${weeksRemaining !== 1 ? 'S' : ''} LEFT` : `₹${remainingBalance.toLocaleString('en-IN')} DUE`}
                    </span>
                  </div>
                </div>

                {/* Payment Actions */}
                <div className="action-group">
                  <button
                    className="btn btn-sm btn-gold"
                    style={{ flex: 1, background: remainingBalance === 0 ? '#10b981' : isUrgent ? '#ef4444' : '#f59e0b' }}
                    onClick={() => {
                      setLoanPaymentModal({ memberId: member.id, loanId: activeLoan.id, loan: activeLoan });
                      setLoanPaymentAmount(Math.min(5000, remainingBalance));
                    }}
                    disabled={weekData.ceased || editLocked || remainingBalance === 0}
                    title={editLocked ? '🔒 Editing is locked' : weekData.ceased ? 'Week is ceased' : 'Make loan payment'}
                  >
                    {remainingBalance === 0 ? '✓ Loan Closed' : `Pay Loan`}
                  </button>
                </div>
              </div>
            );
          })
          )
        ) : (
          // CLOSED LOANS VIEW
          state.loans.filter(l => l.status === 'REPAID').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem', marginBottom: '8px' }}>✓ No closed loans yet</p>
              <p style={{ fontSize: '0.85rem' }}>All loans will appear here once they are fully repaid</p>
            </div>
          ) : (
            state.loans.filter(l => l.status === 'REPAID').map((loan) => {
              const borrower = state.members.find(m => m.id === loan.memberId) || { name: 'Unknown' };
              const totalPaid = loan.repaidAmount;
              const progressPct = 100;

              return (
                <div
                  key={loan.id}
                  style={{
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '2px solid #10b981',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {borrower.name}
                        <span className="status-badge" style={{ background: '#10b981', color: '#ffffff', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ✓ {loan.nickname || 'Loan'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        Requested: ₹{loan.requestedAmount.toLocaleString('en-IN')} • Disbursed (90%): ₹{loan.disbursedAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="status-badge" style={{ fontSize: '0.8rem', background: '#10b981' }}>
                        ✓ FULLY REPAID
                      </span>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#10b981', marginTop: '4px' }}>
                        Repaid: ₹{totalPaid.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Repayment Progress Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8' }}>
                      <span>Repayment Completed</span>
                      <span>100%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: '100%', background: '#10b981' }}></div>
                    </div>
                  </div>

                  {/* Loan Details */}
                  <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#cbd5e1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Weekly Installment:</span>
                      <div style={{ fontWeight: '600', color: '#10b981' }}>₹{loan.weeklyInstallment.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Term:</span>
                      <div style={{ fontWeight: '600', color: '#10b981' }}>{loan.termWeeks} weeks</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Group Profit (Fee):</span>
                      <div style={{ fontWeight: '600', color: '#fbbf24' }}>₹{loan.upfrontFee.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <span style={{ color: '#94a3b8' }}>Completed:</span>
                      <div style={{ fontWeight: '600', color: '#10b981' }}>{loan.createdAt}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* Flexible Loan Payment Modal */}
      {loanPaymentModal && (() => {
        const member = state.members.find(m => m.id === loanPaymentModal.memberId);
        const loan = loanPaymentModal.loan;
        const remainingBalance = loan.requestedAmount - loan.repaidAmount;
        const weeksRemaining = loan.startWeekNum + loan.termWeeks - selectedWeek;
        const isUrgent = weeksRemaining <= 2;

        return (
          <div className="modal-overlay" onClick={() => {
            setLoanPaymentModal(null);
            setLoanPaymentAmount(0);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color={isUrgent ? '#ef4444' : '#f59e0b'} />
                  Pay Loan - {member?.name} ({loan.nickname})
                </h3>
                <button className="modal-close" onClick={() => {
                  setLoanPaymentModal(null);
                  setLoanPaymentAmount(0);
                }}>×</button>
              </div>

              <div style={{ background: isUrgent ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)', border: isUrgent ? '1px solid #ef4444' : '1px solid #f59e0b', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: isUrgent ? '#fca5a5' : '#fcd34d' }}>Outstanding Balance</span>
                  <span style={{ fontSize: '1rem', fontWeight: '700', color: isUrgent ? '#fca5a5' : '#fbbf24' }}>₹{remainingBalance.toLocaleString('en-IN')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.85rem', color: isUrgent ? '#fca5a5' : '#fcd34d' }}>Term Remaining</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: isUrgent ? '#ef4444' : '#f59e0b' }}>
                    {weeksRemaining > 0 ? `${weeksRemaining} week${weeksRemaining !== 1 ? 's' : ''}` : 'EXPIRED'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', color: isUrgent ? '#fca5a5' : '#fcd34d' }}>Already Repaid</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: '600', color: '#10b981' }}>₹{loan.repaidAmount.toLocaleString('en-IN')}</span>
                </div>
                {isUrgent && weeksRemaining > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#fca5a5', paddingTop: '8px', borderTop: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    ⚠️ Must be repaid within {weeksRemaining} week{weeksRemaining !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Amount to Pay (₹)</label>
                <input
                  type="number"
                  min="0"
                  max={remainingBalance}
                  value={loanPaymentAmount}
                  onChange={(e) => {
                    const val = Math.min(parseInt(e.target.value) || 0, remainingBalance);
                    setLoanPaymentAmount(val);
                  }}
                  className="form-input"
                  placeholder="Enter amount"
                />
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                {loanPaymentAmount > 0 ? (
                  <>
                    <div style={{ fontSize: '0.9rem', color: '#fcd34d', marginBottom: '8px' }}>
                      <strong>After Payment:</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fcd34d', paddingBottom: '8px', borderBottom: '1px solid rgba(245, 158, 11, 0.3)' }}>
                      <span>Remaining Balance</span>
                      <span style={{ fontWeight: '600', color: '#fbbf24' }}>₹{(remainingBalance - loanPaymentAmount).toLocaleString('en-IN')}</span>
                    </div>
                    {(remainingBalance - loanPaymentAmount) === 0 && (
                      <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#10b981', fontWeight: '600' }}>
                        ✓ Loan will be fully closed!
                      </div>
                    )}
                    {loanPaymentAmount > remainingBalance && (
                      <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#fbbf24' }}>
                        💡 Amount exceeds remaining balance
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#fcd34d', fontSize: '0.85rem' }}>Enter an amount to see remaining balance after payment</div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setLoanPaymentModal(null);
                    setLoanPaymentAmount(0);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  onClick={() => {
                    onAdvanceLoanInstallment(selectedWeek, loanPaymentModal.memberId, loanPaymentModal.loanId, loanPaymentAmount);
                    setLoanPaymentModal(null);
                    setLoanPaymentAmount(0);
                  }}
                  disabled={loanPaymentAmount <= 0}
                >
                  Pay ₹{loanPaymentAmount.toLocaleString('en-IN')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
