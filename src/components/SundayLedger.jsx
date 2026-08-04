import React, { useState } from 'react';
import { Calendar, CheckCircle2, MessageCircle, CheckSquare, Clock, Filter, Tag } from 'lucide-react';
import { getMemberStats } from '../utils/storage';

export default function SundayLedger({
  state,
  onTogglePayment,
  onToggleLoanInstallment,
  onMarkAllPaid,
  onChangePaymentMethod
}) {
  const [selectedWeek, setSelectedWeek] = useState(state.currentWeekNum || 1);
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'UNPAID' | 'PAID'

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
          background: 'linear-gradient(135deg, #131b2e 0%, #1c2742 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
            Sunday Ledger — Week {selectedWeek}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Date: {weekData.displayDate} • Target Pool: ₹10,000
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setFilterMode(filterMode === 'ALL' ? 'UNPAID' : 'ALL')}
          >
            <Filter size={14} /> Filter: {filterMode}
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => onMarkAllPaid(selectedWeek)}
          >
            <CheckSquare size={16} /> Mark All Paid
          </button>
        </div>
      </div>

      {/* 10 Members Collection Cards */}
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
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank">Bank Transfer</option>
                </select>

                <button
                  className={`btn btn-toggle-paid ${rec.paid ? 'paid' : 'unpaid'}`}
                  onClick={() => onTogglePayment(selectedWeek, member.id)}
                >
                  {rec.paid ? <CheckCircle2 size={16} /> : null}
                  {rec.paid ? 'PAID ₹1,000' : 'MARK ₹1k PAID'}
                </button>

                {hasActiveLoan && (
                  <button
                    className={`btn btn-sm ${rec.loanInstallmentPaid ? 'btn-primary' : 'btn-gold'}`}
                    onClick={() => onToggleLoanInstallment(selectedWeek, member.id, activeLoan.id)}
                  >
                    {rec.loanInstallmentPaid ? 'Loan Inst. Paid' : `Pay ${loanNickname} ₹${loanInstallment}`}
                  </button>
                )}

                <button
                  className="btn btn-whatsapp"
                  onClick={() => handleSendWhatsApp(member, regularAmount, loanInstallment, loanNickname, totalDueToday, mStats.unpaidPastWeeks)}
                  title="Send WhatsApp Reminder"
                >
                  <MessageCircle size={16} /> WhatsApp
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
