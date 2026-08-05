import React, { useState } from 'react';
import { Calendar, CheckCircle2, MessageCircle, CheckSquare, Clock, Filter, Lock } from 'lucide-react';
import { getMemberStats } from '../utils/storage';

export default function SundayContributions({
  state,
  editLocked,
  onTogglePayment,
  onMarkAllPaid,
  onChangePaymentMethod,
  onAdvancePayment,
  onCeaseWeek
}) {
  const [selectedWeek, setSelectedWeek] = useState(state.currentWeekNum || 1);
  const [filterMode, setFilterMode] = useState('ALL');
  const [advancePaymentModal, setAdvancePaymentModal] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState(5000);
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
    msg += `👉 *Due Today: ₹${regularAmount}*\n`;
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
            Sunday Contributions — Week {selectedWeek}
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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
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
                  disabled={weekData.ceased || editLocked}
                  style={(weekData.ceased || editLocked) ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                  title={editLocked ? '🔒 Editing is locked' : weekData.ceased ? 'Week is ceased' : 'Mark payment'}
                >
                  {rec.paid ? <CheckCircle2 size={16} /> : null}
                  {rec.paid ? 'PAID ₹1,000' : 'MARK ₹1k PAID'}
                </button>

                <button
                  className="btn btn-sm"
                  style={{ background: '#8b5cf6', color: 'white', opacity: (weekData.ceased || editLocked) ? 0.5 : 1, cursor: (weekData.ceased || editLocked) ? 'not-allowed' : 'pointer' }}
                  onClick={() => setAdvancePaymentModal({ memberId: member.id })}
                  disabled={weekData.ceased || editLocked}
                  title={editLocked ? '🔒 Editing is locked' : weekData.ceased ? "Week is ceased - no edits allowed" : "Pay multiple weeks in advance with custom amount"}
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
