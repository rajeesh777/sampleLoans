import React, { useState } from 'react';
import { Calendar, CheckCircle2, MessageCircle, Clock, Filter, Lock } from 'lucide-react';
import { getMemberStats, formatDateDDMMYY } from '../utils/storage';

export default function SundayContributions({
  state,
  editLocked,
  onTogglePayment,
  onChangePaymentMethod,
  onAdvancePayment,
  onCeaseWeek
}) {
  const [selectedWeek, setSelectedWeek] = useState(state.currentWeekNum || 1);
  const [filterMode, setFilterMode] = useState('ALL');
  const [advancePaymentModal, setAdvancePaymentModal] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState(5000);
  const [duesPaymentModal, setDuesPaymentModal] = useState(null);
  const [duesPaymentAmount, setDuesPaymentAmount] = useState(0);
  const [showCeaseConfirm, setShowCeaseConfirm] = useState(false);

  const weekData = state.weeks[selectedWeek] || { collections: {} };

  const weekPills = [];
  for (let i = 1; i <= 52; i++) {
    weekPills.push(i);
  }

  const handleSendWhatsApp = (member, regularAmount, unpaidWeeksCount) => {
    const cleanPhone = member.phone ? member.phone.replace(/[^0-9]/g, '') : '';
    let msg = `Hi ${member.name}! 👋\nSunday Contribution Reminder for *${state.groupName || 'Isthooi Savings Group'}* (Week ${selectedWeek}):\n`;
    msg += `• Regular Contribution: ₹${regularAmount}\n`;
    msg += `*Due Today: ₹${regularAmount}*\n`;
    if (unpaidWeeksCount > 1) {
      msg += `⚠️ Note: You have ${unpaidWeeksCount} unpaid weeks. Please clear dues to avoid exceeding 3-week limit!\n`;
    }
    msg += `\nPlease pay via UPI to *${state.groupUpiVpa || 'isthooi@upi'}* or Cash. Thank you!`;

    const encodedMsg = encodeURIComponent(msg);
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodedMsg}` : `https://wa.me/?text=${encodedMsg}`;
    window.open(waUrl, '_blank');
  };

  const filteredMembers = state.members.filter((m) => {
    const isPaid = weekData.collections[m.id]?.paid || false;
    if (filterMode === 'UNPAID') return !isPaid;
    if (filterMode === 'PAID') return isPaid;
    return true;
  });

  // Get unpaid weeks before the selected week for a member
  const getDueWeeks = (memberId) => {
    const dueWeeks = [];
    for (let w = 1; w < selectedWeek; w++) {
      const weekData = state.weeks[w];
      if (weekData && weekData.collections && weekData.collections[memberId]) {
        const rec = weekData.collections[memberId];
        if (!rec.paid) {
          dueWeeks.push({
            weekNum: w,
            date: weekData.date,
            displayDate: weekData.displayDate,
            amount: rec.amount || state.weeklyAmount || 1000
          });
        }
      }
    }
    return dueWeeks;
  };

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
              W{wNum}
            </button>
          ))}
        </div>
      </div>

      {/* Header Actions & Filter */}
      <div
        className="card"
        style={{
          background: weekData.ceased
            ? 'var(--bg-card)'
            : 'var(--bg-card)',
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
            Sunday Contributions — Week {selectedWeek} ({formatDateDDMMYY(weekData.date)})
            {weekData.ceased && (
              <span className="status-badge" style={{ background: '#6b7280', color: '#f3f4f6', fontSize: '0.8rem' }}>
                🔒 CEASED
              </span>
            )}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Date: {weekData.displayDate} • Target Pool: ₹10,000
            {weekData.ceased && <span style={{ marginLeft: '12px', color: '#9ca3af' }}>Ceased on {weekData.ceaseDate}</span>}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setFilterMode(filterMode === 'ALL' ? 'UNPAID' : 'ALL')}
            disabled={weekData.ceased || editLocked}
          >
            <Filter size={14} /> Filter: {filterMode}
          </button>

          {editLocked && (
            <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lock size={14} /> Editing Locked
            </span>
          )}
        </div>
      </div>

      {/* Members Collection Cards */}
      <div className="members-collection-list">
        {filteredMembers.map((member) => {
          const rec = weekData.collections[member.id] || { paid: false, paymentMethod: 'UPI' };
          const mStats = getMemberStats(state, member.id);
          const regularAmount = rec.amount || state.weeklyAmount || 1000;
          const dueWeeks = getDueWeeks(member.id);
          const totalDuesAmount = dueWeeks.reduce((sum, d) => sum + d.amount, 0);
          const hasDues = dueWeeks.length > 0;

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
                    {mStats.status === 'CRITICAL_3' && <span className="status-badge critical_3">3 Wks Max Limit</span>}
                    {mStats.status === 'BLOCKED' && <span className="status-badge blocked">⛔ BLOCKED DEFAULTER</span>}
                  </div>
                  <div className="member-phone">{member.phone} • UPI: {member.upiId}</div>
                </div>
              </div>

              {/* Show Dues Section First */}
              {hasDues && (
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#fca5a5', marginBottom: '8px' }}>
                    ⚠️ Pending Dues (₹{totalDuesAmount})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                    {dueWeeks.map((due) => (
                      <div key={due.weekNum} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fca5a5', paddingBottom: '6px', borderBottom: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span>W{due.weekNum} ({due.displayDate})</span>
                        <span style={{ fontWeight: '600' }}>₹{due.amount}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-sm"
                      style={{ background: '#ef4444', color: 'white', flex: 1, fontSize: '0.85rem' }}
                      onClick={() => {
                        setDuesPaymentModal({ memberId: member.id, dueWeeks });
                        setDuesPaymentAmount(totalDuesAmount);
                      }}
                      disabled={weekData.ceased || editLocked}
                      title={editLocked ? '🔒 Editing is locked' : 'Pay pending dues (full or partial)'}
                    >
                      <CheckCircle2 size={14} /> Pay Dues
                    </button>
                  </div>
                </div>
              )}

              {/* Dues Breakdown */}
              <div className="due-breakdown">
                <div className="due-item">
                  <span className="due-item-label">Week {selectedWeek} Contribution {hasDues && '(After Dues)'}</span>
                  <span className="due-item-val" style={{ color: rec.paid ? '#10b981' : '#f87171' }}>
                    ₹{regularAmount} ({rec.paid ? 'PAID' : 'DUE'})
                  </span>
                </div>
              </div>

              {/* Payment Actions */}
              <div className="action-group">
                <select
                  className="form-select"
                  style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }}
                  value={rec.paymentMethod || 'UPI'}
                  onChange={(e) => onChangePaymentMethod(selectedWeek, member.id, e.target.value)}
                  disabled={weekData.ceased || editLocked}
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>

                <button
                  className={`btn btn-toggle-paid ${rec.paid ? 'paid' : 'unpaid'}`}
                  onClick={() => onTogglePayment(selectedWeek, member.id)}
                  disabled={weekData.ceased || editLocked || hasDues}
                  style={(weekData.ceased || editLocked || hasDues) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  title={hasDues ? '⚠️ Pay pending dues first' : editLocked ? '🔒 Editing is locked' : weekData.ceased ? 'Week is ceased' : 'Mark payment'}
                >
                  {rec.paid ? <CheckCircle2 size={16} /> : null}
                  {rec.paid ? 'PAID ₹1,000' : 'MARK ₹1k PAID'}
                </button>

                <button
                  className="btn btn-sm"
                  style={{ background: '#8b5cf6', color: 'white', opacity: (weekData.ceased || editLocked || hasDues) ? 0.5 : 1, cursor: (weekData.ceased || editLocked || hasDues) ? 'not-allowed' : 'pointer' }}
                  onClick={() => setAdvancePaymentModal({ memberId: member.id })}
                  disabled={weekData.ceased || editLocked || hasDues}
                  title={hasDues ? '⚠️ Pay pending dues first' : editLocked ? '🔒 Editing is locked' : weekData.ceased ? "Week is ceased - no edits allowed" : "Pay multiple weeks in advance with custom amount"}
                >
                  <Clock size={14} /> Advance Pay
                </button>

                <button
                  className="btn btn-whatsapp"
                  onClick={() => handleSendWhatsApp(member, regularAmount, mStats.unpaidPastWeeks)}
                  title={editLocked ? '🔒 Editing is locked' : weekData.ceased ? "Week is ceased" : "Send WhatsApp Reminder"}
                  disabled={weekData.ceased || editLocked}
                  style={(weekData.ceased || editLocked) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dues Payment Modal */}
      {duesPaymentModal && (() => {
        const member = state.members.find(m => m.id === duesPaymentModal.memberId);
        const dueWeeks = duesPaymentModal.dueWeeks;
        const totalDuesAmount = dueWeeks.reduce((sum, d) => sum + d.amount, 0);
        const weeklyAmount = state.weeklyAmount || 1000;

        // Calculate which weeks will be paid with the entered amount
        let weeksBeingPaid = [];
        let remainingAmount = duesPaymentAmount;
        for (let i = 0; i < dueWeeks.length && remainingAmount > 0; i++) {
          const due = dueWeeks[i];
          const amountForThisWeek = Math.min(remainingAmount, due.amount);
          weeksBeingPaid.push({
            weekNum: due.weekNum,
            displayDate: due.displayDate,
            amount: amountForThisWeek,
            fullPayment: amountForThisWeek === due.amount
          });
          remainingAmount -= amountForThisWeek;
        }

        return (
          <div className="modal-overlay" onClick={() => {
            setDuesPaymentModal(null);
            setDuesPaymentAmount(0);
          }}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="#ef4444" />
                  Pay Pending Dues - {member?.name}
                </h3>
                <button className="modal-close" onClick={() => {
                  setDuesPaymentModal(null);
                  setDuesPaymentAmount(0);
                }}>×</button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label className="form-label">Amount to Pay (₹) — Total Due: ₹{totalDuesAmount}</label>
                <input
                  type="number"
                  min="0"
                  max={totalDuesAmount}
                  value={duesPaymentAmount}
                  onChange={(e) => {
                    const val = Math.min(parseInt(e.target.value) || 0, totalDuesAmount);
                    setDuesPaymentAmount(val);
                  }}
                  className="form-input"
                  placeholder="Enter amount"
                />
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.9rem', color: '#fca5a5', marginBottom: '8px' }}>
                  <strong>Payment will clear:</strong>
                </div>
                {weeksBeingPaid.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {weeksBeingPaid.map((wpay) => (
                      <div key={wpay.weekNum} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#fca5a5', paddingBottom: '6px', borderBottom: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        <span>
                          W{wpay.weekNum} ({wpay.displayDate})
                          {!wpay.fullPayment && <span style={{ color: '#fca5a5', fontSize: '0.8rem' }}> (partial)</span>}
                        </span>
                        <span style={{ fontWeight: '600' }}>₹{wpay.amount}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: '#fca5a5', fontSize: '0.85rem' }}>Enter an amount to see which weeks will be cleared</div>
                )}
              </div>

              {duesPaymentAmount < totalDuesAmount && duesPaymentAmount > 0 && (
                <div style={{ background: 'rgba(251, 146, 60, 0.1)', border: '1px solid #fb923c', borderRadius: '8px', padding: '10px', marginBottom: '16px', fontSize: '0.85rem', color: '#fca5a5' }}>
                  Remaining dues: ₹{totalDuesAmount - duesPaymentAmount}
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setDuesPaymentModal(null);
                    setDuesPaymentAmount(0);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    weeksBeingPaid.forEach((wpay) => {
                      onTogglePayment(wpay.weekNum, duesPaymentModal.memberId);
                    });
                    setDuesPaymentModal(null);
                    setDuesPaymentAmount(0);
                  }}
                  disabled={duesPaymentAmount <= 0}
                  style={{ background: '#ef4444' }}
                >
                  Pay ₹{duesPaymentAmount}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Advance Payment Modal */}
      {advancePaymentModal && (() => {
        const member = state.members.find(m => m.id === advancePaymentModal.memberId);
        const weeklyAmount = state.weeklyAmount || 1000;
        const weeksToFill = Math.floor(advanceAmount / weeklyAmount);
        const remainderAmount = advanceAmount % weeklyAmount;

        return (
          <div className="modal-overlay" onClick={() => setAdvancePaymentModal(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={20} color="#8b5cf6" />
                  Advance Sunday Contribution - {member?.name}
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
                        <span>W{weekNum} ({weekInfo?.displayDate || 'N/A'})</span>
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
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    onAdvancePayment(selectedWeek, advancePaymentModal.memberId, advanceAmount, 'UPI');
                    setAdvancePaymentModal(null);
                    setAdvanceAmount(5000);
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
