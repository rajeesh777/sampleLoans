import React, { useState } from 'react';
import { HandCoins, Plus, Award, AlertOctagon, CheckCircle2, ShieldAlert, Tag } from 'lucide-react';
import { getMemberStats } from '../utils/storage';

export default function LoanManager({ state, groupStats, onCreateLoan, onRepayLoanExtra }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(state.members[0]?.id || '');
  const [nickname, setNickname] = useState('');
  const [requestedAmount, setRequestedAmount] = useState(10000);
  const [errorMsg, setErrorMsg] = useState('');

  // Live calculations for new loan modal
  const numRequested = Number(requestedAmount) || 0;
  const upfrontFee = Math.round(numRequested * 0.1); // 10% fee retained by group
  const disbursedCash = numRequested - upfrontFee;   // 90% cash out
  const weeklyInstallment = Math.round(numRequested / 10); // 10 weeks term

  // Check eligibility of selected member
  const selectedMemberStats = selectedMemberId ? getMemberStats(state, selectedMemberId) : null;
  const isSelectedBlocked = selectedMemberStats ? !selectedMemberStats.isEligibleForLoan : false;

  const handleSubmitLoan = (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (numRequested <= 0) {
      setErrorMsg('Please enter a valid loan amount.');
      return;
    }

    if (isSelectedBlocked) {
      setErrorMsg(`Cannot grant loan! Member has ${selectedMemberStats.unpaidPastWeeks} unpaid weeks (Exceeds 3-week rule limit).`);
      return;
    }

    if (disbursedCash > groupStats.treasuryCash) {
      setErrorMsg(`Insufficient Treasury Cash! Available: ₹${groupStats.treasuryCash.toLocaleString('en-IN')}, Disbursal Needed: ₹${disbursedCash.toLocaleString('en-IN')}.`);
      return;
    }

    const selectedMember = state.members.find(m => m.id === selectedMemberId);
    const loanNickname = nickname.trim() || selectedMember?.name || 'General Advance';

    onCreateLoan({
      memberId: selectedMemberId,
      nickname: loanNickname,
      requestedAmount: numRequested,
      disbursedAmount: disbursedCash,
      upfrontFee: upfrontFee,
      startWeekNum: state.currentWeekNum || 1,
      termWeeks: 10,
      weeklyInstallment: weeklyInstallment
    });

    setShowModal(false);
    setNickname('');
    setRequestedAmount(10000);
  };

  return (
    <div className="loan-manager-container">
      {/* Header Banner */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="status-badge gold">10% Upfront Discount Policy</span>
            <span className="status-badge clean">10-Week Term</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: '800' }}>Member Loans & Advance Treasury</h2>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Members get 90% cash; 10% is retained as group profit. Repaid in 10 weekly installments.
          </p>
        </div>

        <button className="btn btn-gold" onClick={() => setShowModal(true)}>
          <Plus size={18} /> Request New Loan
        </button>
      </div>

      {/* Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card gold">
          <div className="metric-label">
            <Award size={14} /> Total 10% Fees Earned
          </div>
          <div className="metric-value">₹{groupStats.totalGroupProfitsEarned.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Direct Group Profit</div>
        </div>

        <div className="metric-card indigo">
          <div className="metric-label">
            <HandCoins size={14} /> Total Disbursed Cash
          </div>
          <div className="metric-value">₹{groupStats.totalDisbursedLoans.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">90% net cash paid out</div>
        </div>

        <div className="metric-card emerald">
          <div className="metric-label">
            <CheckCircle2 size={14} /> Total Principal Repaid
          </div>
          <div className="metric-value">₹{groupStats.totalLoanPrincipalRepaid.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Remitted back to treasury</div>
        </div>

        <div className="metric-card rose">
          <div className="metric-label">
            <AlertOctagon size={14} /> Active Loan Balance
          </div>
          <div className="metric-value">₹{groupStats.totalActiveLoansBalance.toLocaleString('en-IN')}</div>
          <div className="metric-subtext">Remaining to be remitted</div>
        </div>
      </div>

      {/* Active Loans List */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            <HandCoins size={18} color="#f59e0b" /> Active 10-Week Member Loans ({state.loans.filter(l => l.status === 'ACTIVE').length})
          </span>
        </div>

        {state.loans.filter(l => l.status === 'ACTIVE').length === 0 ? (
          <p style={{ color: '#94a3b8', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
            No active loans right now. Click "Request New Loan" above to issue an advance.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {state.loans.filter(l => l.status === 'ACTIVE').map((loan) => {
              const borrower = state.members.find(m => m.id === loan.memberId) || { name: 'Unknown' };
              const remaining = loan.requestedAmount - loan.repaidAmount;
              const weeksPaid = Math.floor(loan.repaidAmount / loan.weeklyInstallment);
              const progressPct = Math.round((loan.repaidAmount / loan.requestedAmount) * 100);

              return (
                <div
                  key={loan.id}
                  style={{
                    background: 'var(--bg-dark)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1.05rem', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {borrower.name}
                        <span className="status-badge gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Tag size={10} /> {loan.nickname || 'General Advance'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                        Requested: ₹{loan.requestedAmount.toLocaleString('en-IN')} • Cash Disbursed (90%): ₹{loan.disbursedAmount.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="status-badge clean" style={{ fontSize: '0.8rem' }}>
                        ₹{loan.weeklyInstallment}/wk (10 Wks)
                      </span>
                      <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f59e0b', marginTop: '4px' }}>
                        Remaining: ₹{remaining.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Repayment Progress Bar */}
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#94a3b8' }}>
                      <span>Repayment Progress ({weeksPaid}/10 Weeks Paid)</span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #f59e0b, #10b981)' }}></div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onRepayLoanExtra(loan.id, loan.weeklyInstallment)}
                    >
                      + Record Installment (₹{loan.weeklyInstallment})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New Loan Request Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HandCoins size={20} color="#f59e0b" /> Request Member Loan
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>

            {errorMsg && (
              <div style={{ background: 'rgba(244, 63, 94, 0.15)', border: '1px solid #f43f5e', color: '#f43f5e', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitLoan}>
              <div className="form-group">
                <label className="form-label">Select Borrower Member</label>
                <select
                  className="form-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                >
                  {state.members.map((m) => {
                    const mStats = getMemberStats(state, m.id);
                    return (
                      <option key={m.id} value={m.id}>
                        {m.name} {mStats.isBlocked ? '⛔ (BLOCKED: >3 Wks Unpaid)' : mStats.unpaidPastWeeks > 0 ? `(⚠️ ${mStats.unpaidPastWeeks} Wks Unpaid)` : '(Eligible)'}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Loan Nickname / Purpose (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Medical Expense, Bike Repair, Festival Advance"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              {isSelectedBlocked && (
                <div style={{ background: 'rgba(244, 63, 94, 0.12)', border: '1px solid #f43f5e', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', color: '#f87171', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldAlert size={18} />
                  <span>Rule Alert: Member has {selectedMemberStats?.unpaidPastWeeks} unpaid weeks. Loan requests are locked until dues are cleared!</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Requested Loan Principal Amount (₹)</label>
                <input
                  type="number"
                  className="form-input"
                  value={requestedAmount}
                  onChange={(e) => setRequestedAmount(e.target.value)}
                  step="1000"
                  min="1000"
                />
              </div>

              {/* Automatic Calculation Preview */}
              <div className="calc-box">
                <div className="calc-row">
                  <span>Requested Loan Principal:</span>
                  <span style={{ fontWeight: '700' }}>₹{numRequested.toLocaleString('en-IN')}</span>
                </div>
                <div className="calc-row">
                  <span style={{ color: '#f43f5e' }}>- 10% Upfront Group Profit Retainer:</span>
                  <span style={{ color: '#f43f5e', fontWeight: '700' }}>- ₹{upfrontFee.toLocaleString('en-IN')}</span>
                </div>
                <div className="calc-row total">
                  <span>👉 Net Disbursed Cash (90%):</span>
                  <span>₹{disbursedCash.toLocaleString('en-IN')}</span>
                </div>
                <div className="calc-row" style={{ marginTop: '8px', fontSize: '0.8rem', color: '#94a3b8' }}>
                  <span>10-Week Repayment Plan:</span>
                  <span style={{ fontWeight: '700', color: '#ffffff' }}>₹{weeklyInstallment.toLocaleString('en-IN')} / Sunday (for 10 weeks)</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  disabled={isSelectedBlocked || numRequested <= 0}
                >
                  Confirm & Disburse ₹{disbursedCash.toLocaleString('en-IN')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
