import React, { useState } from 'react';
import { Calendar, CheckCircle2, MessageCircle, CheckSquare, Clock, Filter, Tag } from 'lucide-react';
import { getMemberStats, formatDateDDMMYY } from '../utils/storage';

export default function SundayLedger({
  state,
  onTogglePayment,
  onToggleLoanInstallment,
  onMarkAllPaid,
  onChangePaymentMethod,
  onAdvancePayment,
  onAdvanceLoanInstallment,
  onCeaseWeek
}) {
  const [selectedWeek, setSelectedWeek] = useState(state.currentWeekNum || 1);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PAID'
  const [advancePaymentModal, setAdvancePaymentModal] = useState(null); // { memberId, type: 'regular'|'loan', loanId?, method? }
  const [advanceAmount, setAdvanceAmount] = useState(5000);
  const [advanceDistribution, setAdvanceDistribution] = useState({});
  const [showCeaseConfirm, setShowCeaseConfirm] = useState(false);

  const weekData = state.weeks[selectedWeek] || { collections: {} };

  const weekPills = [];
  for (let i = 1; i <= 52; i++) {
    weekPills.push(i);
  }

  // Handle WhatsApp Reminder Link
  const handleSendWhatsApp = (member, regularAmount, loanInstallment, loanNickname, totalDue, unpaidWeeksCount) => {
    const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
    let msg = `Hi ${member.name}! 👋\nSunday Collection Reminder for *${state.groupName || 'Isthooi Savings Group'}* (Week ${selectedWeek}):\n`;
    msg += `• Regular Contribution: ₹${regularAmount}\n`;
    if (loanInstallment > 0) {
      msg += `• Loan Installment (${loanNickname || 'Loan'}): ₹${loanInstallment}\n`;
    }
    msg += `👉 *Total Due Today: ₹${totalDue}*\n`;
    if (unpaidWeeksCount > 1) {
      msg += `⚠️ Note: You have ${unpaidWeeksCount} unpaid weeks. Please clear dues to avoid exceeding 3-week limit!\n`;
    }
    msg += `\nPlease pay via UPI to *${state.groupUpiVpa || 'isthooi@upi'}* or Cash. Thank you!`;

    const encodedMsg = encodeURIComponent(msg);
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  };

  // Filter members list
  const filteredMembers = state.members.filter((m) => {
    const isPaid = weekData.collections[m.id]?.paid || false;
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
            <Calendar size={18} color="#10b981" /> Select Sunday (Week 1 to 52)
          </span>
          <span style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: '600' }}>
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
            : 'linear-gradient(135deg, #131b2e 0%, #1c2742 100%)',
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
            Sunday Ledger — Week {selectedWeek} ({formatDateDDMMYY(weekData.date)})
            {weekData.ceased && (
              <span className="status-badge" style={{ background: '#6b7280', color: '#f3f4f6', fontSize: '0.75rem' }}>
                🔒 CEASED
              </span>
            )}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Date: {weekData.displayDate} • Target Pool: ₹10,000
            {weekData.ceased && <span style={{ marginLeft: '12px', color: '#9ca3af' }}>Ceased on {weekData.ceaseDate}</span>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setFilterMode(filterMode === 'ALL' ? 'UNPAID' : 'ALL')}
            disabled={weekData.ceased}
          >
            <Filter size={14} /> Filter: {filterMode}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onMarkAllPaid(selectedWeek)}
            disabled={weekData.ceased}
          >
            <CheckSquare size={16} /> Mark All Paid
          </button>

          {!weekData.ceased ? (
            <button
              className="btn btn-sm"
              style={{ background: '#dc2626', color: 'white' }}
              onClick={() => setShowCeaseConfirm(true)}
              title="Lock this week from further edits"
            >
              🔒 Cease Week
            </button>
          ) : (
            <button
              className="btn btn-sm"
              style={{ background: '#6b7280', color: 'white', cursor: 'not-allowed' }}
              disabled
            >
              ✓ Week Ceased
            </button>
          )}
        </div>
      </div>

      {/* Members Collection Cards */}
      <div className="members-collection-list">
        {filteredMembers.map((member) => {
          const rec = weekData.collections[member.id] || { paid: false, paymentMethod: 'UPI' };
          const mStats = getMemberStats(state, member.id);

          const activeLoan = mStats.activeLoans[0];
          const hasActiveLoan = !!activeLoan;
          const loanInstallment = hasActiveLoan ? activeLoan.weeklyInstallment : 0;
          const loanNickname = hasActiveLoan ? (activeLoan.nickname || 'Loan') : '';
          const regularAmount = rec.amount || state.weeklyAmount || 1000;
          const totalDueToday = (rec.paid ? 0 : regularAmount) + (rec.loanInstallmentPaid ? 0 : loanInstallment);

          return (
            <div
              key={member.id}
              className={`member-card ${rec.paid ? 'paid' : ''} ${mStats.isBlocked ? 'blocked' : mStats.unpaidPastWeeks >= 2 ? 'overdue' : ''}`}
            >
              <div className="member-info">
                <div className="avatar" style={{ backgroundColor: member.avatarColor || '#10b981' }}>
                  {member.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="member-name">
                    {member.name}
                    {mStats.status === 'PENDING_1' && <span className="status-badge pending_1">1 Wk Pending</span>}
                    {mStats.status === 'OVERDUE_2' && <span className="status-badge overdue_2">2 Wks Overdue</span>}
                    {mStats.status === 'CRITICAL_3' && <span className="status-badge critical_3">🚨 3 Wks Max Limit</span>}
                    {mStats.status === 'BLOCKED' && <span className="status-badge blocked">⛔ BLOCKED DEFAULTER</span>}
                  </div>
                  <div className="member-phone">{member.phone} • UPI: {member.upiId}</div>
                </div>
              </div>

              {/* Dues Breakdown */}
              <div className="due-breakdown">
                <div className="due-item">
                  <span className="due-item-label">Sunday Contribution</span>
                  <span className="due-item-val" style={{ color: rec.paid ? '#10b981' : '#f87171' }}>
                    ₹{regularAmount} ({rec.paid ? 'PAID' : 'DUE'})
                  </span>
                </div>

                {hasActiveLoan && (
                  <div className="due-item" style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '8px' }}>
                    <span className="due-item-label" style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Tag size={10} color="#fbbf24" /> {loanNickname} (Inst.)
                    </span>
                    <span className="due-item-val" style={{ color: rec.loanInstallmentPaid ? '#10b981' : '#f59e0b' }}>
                      ₹{loanInstallment} ({rec.loanInstallmentPaid ? 'PAID' : 'DUE'})
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Actions & WhatsApp */}
              <div className="action-group">
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
                  value={rec.paymentMethod || 'UPI'}
                  onChange={(e) => onChangePaymentMethod(selectedWeek, member.id, e.target.value)}
                  disabled={weekData.ceased}
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>

                <button
                  className={`btn btn-toggle-paid ${rec.paid ? 'paid' : 'unpaid'}`}
                  onClick={() => onTogglePayment(selectedWeek, member.id)}
                  disabled={weekData.ceased}
                  style={weekData.ceased ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {rec.paid ? <CheckCircle2 size={16} /> : null}
                  {rec.paid ? 'PAID ₹1,000' : 'MARK ₹1k PAID'}
                </button>

                <button
                  className="btn btn-sm"
                  style={{ background: '#8b5cf6', color: 'white', opacity: weekData.ceased ? 0.5 : 1, cursor: weekData.ceased ? 'not-allowed' : 'pointer' }}
                  onClick={() => setAdvancePaymentModal({ memberId: member.id, type: 'regular', method: rec.paymentMethod || 'UPI' })}
                  disabled={weekData.ceased}
                  title={weekData.ceased ? "Week is ceased - no edits allowed" : "Pay multiple weeks in advance with custom amount"}
                >
                  <Clock size={14} /> Advance Pay
                </button>

                {hasActiveLoan && (
                  <>
                    <button
                      className={`btn btn-sm ${rec.loanInstallmentPaid ? 'btn-primary' : 'btn-gold'}`}
                      onClick={() => onToggleLoanInstallment(selectedWeek, member.id, activeLoan.id)}
                      disabled={weekData.ceased}
                      style={weekData.ceased ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                    >
                      {rec.loanInstallmentPaid ? 'Loan Inst. Paid' : `Pay ${loanNickname} ₹${loanInstallment}`}
                    </button>

                    <button
                      className="btn btn-sm"
                      style={{ background: '#8b5cf6', color: 'white', opacity: weekData.ceased ? 0.5 : 1, cursor: weekData.ceased ? 'not-allowed' : 'pointer' }}
                      onClick={() => setAdvancePaymentModal({ memberId: member.id, type: 'loan', loanId: activeLoan.id })}
                      disabled={weekData.ceased}
                      title={weekData.ceased ? "Week is ceased - no edits allowed" : "Pay multiple weeks of loan in advance"}
                    >
                      <Clock size={14} /> Loan Advance
                    </button>
                  </>
                )}

                <button
                  className="btn btn-whatsapp"
                  onClick={() => handleSendWhatsApp(member, regularAmount, loanInstallment, loanNickname, totalDueToday, mStats.unpaidPastWeeks)}
                  title={weekData.ceased ? "Week is ceased" : "Send WhatsApp Reminder"}
                  disabled={weekData.ceased}
                  style={weekData.ceased ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Cease Week Confirmation Modal */}
      {showCeaseConfirm && (
        <div className="modal-overlay" onClick={() => setShowCeaseConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🔒 Cease Week {selectedWeek}?
              </h3>
              <button className="modal-close" onClick={() => setShowCeaseConfirm(false)}>×</button>
            </div>

            <div style={{ marginBottom: '16px', fontSize: '0.95rem', color: '#e5e7eb', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '12px' }}>
                Once a week is ceased, <strong>all payment records become locked</strong> and cannot be edited.
              </p>
              <p style={{ marginBottom: '12px' }}>
                <strong>Week {selectedWeek}</strong> ({weekData.displayDate}) will be marked as finalized.
              </p>
              <p style={{ color: '#fca5a5' }}>
                ⚠️ This action cannot be undone. Make sure all payments and amounts are correct before proceeding.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowCeaseConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn"
                style={{ background: '#dc2626', color: 'white' }}
                onClick={() => {
                  onCeaseWeek(selectedWeek);
                  setShowCeaseConfirm(false);
                }}
              >
                🔒 Confirm & Cease Week
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Payment Modal */}
      {advancePaymentModal && (() => {
        const member = state.members.find(m => m.id === advancePaymentModal.memberId);
        const mStats = getMemberStats(state, advancePaymentModal.memberId);
        const weeklyAmount = advancePaymentModal.type === 'regular'
          ? (state.weeklyAmount || 1000)
          : (mStats.activeLoans[0]?.weeklyInstallment || 1000);

        const weeksToFill = Math.floor(advanceAmount / weeklyAmount);
        const remainderAmount = advanceAmount % weeklyAmount;

        return (
          <div className="modal-overlay" onClick={() => setAdvancePaymentModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="#8b5cf6" />
                  {advancePaymentModal.type === 'regular' ? 'Advance Sunday Contribution' : 'Advance Loan Installment'} - {member?.name}
                </h3>
                <button className="modal-close" onClick={() => setAdvancePaymentModal(null)}>×</button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Amount to Pay in Advance (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={advanceAmount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setAdvanceAmount(val);
                    setAdvanceDistribution({});
                  }}
                  className="form-input"
                  placeholder="Enter amount"
                />
              </div>

              <div style={{ background: 'rgba(139, 92, 246, 0.1)', border: '1px solid #8b5cf6', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.9rem', color: '#c4b5fd', marginBottom: '8px' }}>
                  <strong>Calculation:</strong> ₹{advanceAmount} ÷ ₹{weeklyAmount}/week = <strong>{weeksToFill} weeks</strong>
                  {remainderAmount > 0 && ` + ₹${remainderAmount} remainder`}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#a78bfa' }}>
                  Starting from Week {selectedWeek}, the amount will be distributed across the following weeks:
                </div>
              </div>

              {/* Week Distribution Preview */}
              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Coverage (Weeks {selectedWeek} onwards):</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Array.from({ length: Math.min(weeksToFill + (remainderAmount > 0 ? 1 : 0), 10) }).map((_, idx) => {
                    const weekNum = selectedWeek + idx;
                    if (weekNum > 52) return null;
                    const amount = idx < weeksToFill ? weeklyAmount : remainderAmount;
                    const weekInfo = state.weeks[weekNum];
                    return (
                      <div key={weekNum} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', background: 'var(--bg-dark)', borderRadius: '6px', fontSize: '0.9rem' }}>
                        <span>Week {weekNum} ({weekInfo?.displayDate || 'N/A'})</span>
                        <span style={{ color: '#10b981', fontWeight: '600' }}>₹{amount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setAdvancePaymentModal(null);
                    setAdvanceAmount(5000);
                    setAdvanceDistribution({});
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    if (advancePaymentModal.type === 'regular') {
                      onAdvancePayment(selectedWeek, advancePaymentModal.memberId, advanceAmount, advancePaymentModal.method);
                    } else {
                      onAdvanceLoanInstallment(selectedWeek, advancePaymentModal.memberId, advancePaymentModal.loanId, advanceAmount);
                    }
                    setAdvancePaymentModal(null);
                    setAdvanceAmount(5000);
                    setAdvanceDistribution({});
                  }}
                  disabled={advanceAmount <= 0}
                >
                  Confirm & Record ₹{advanceAmount}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
