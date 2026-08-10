import React, { useState, useEffect } from 'react';
import { Users, Phone, CreditCard, CheckCircle2, AlertCircle, Zap, TrendingUp, BookOpen, X, ChevronDown, ChevronUp, Calendar, Tag } from 'lucide-react';
import { getMemberStats, formatDateDDMMYY } from '../utils/storage';

export default function MemberRoster({ state }) {
  const [selectedMemberForLedger, setSelectedMemberForLedger] = useState(null);
  const [ledgerSortBy, setLedgerSortBy] = useState('week-asc'); // week-asc, week-desc, status, amount
  const [ledgerFilterMode, setLedgerFilterMode] = useState('ALL'); // ALL, PAID, UNPAID
  const [ledgerLoanFilter, setLedgerLoanFilter] = useState('ALL'); // ALL or loan nickname
  const [selectedLoanForDetails, setSelectedLoanForDetails] = useState(null);
  const [ledgerSubPage, setLedgerSubPage] = useState('contributions'); // 'contributions' or 'loans'
  const [expandedLoanInModal, setExpandedLoanInModal] = useState(null);
  const [ledgerLoanStatusFilter, setLedgerLoanStatusFilter] = useState('ALL'); // ALL, ACTIVE, CLOSED

  // Reset filters when opening a new member's ledger
  useEffect(() => {
    if (selectedMemberForLedger) {
      setLedgerSortBy('week-desc');
      setLedgerFilterMode('ALL');
      setLedgerLoanFilter('ALL');
      setLedgerSubPage('contributions');
      setExpandedLoanInModal(null);
      setLedgerLoanStatusFilter('ALL');
    }
  }, [selectedMemberForLedger?.id]);

  const isLoanClosed = (loan) => loan.status !== 'ACTIVE';

  const getMemberLedger = (memberId) => {
    const ledger = [];
    const memberLoans = state.loans.filter(l => l.memberId === memberId);

    for (let weekNum = 1; weekNum <= (state.totalWeeks || 52); weekNum++) {
      const weekData = state.weeks[weekNum];
      if (weekData) {
        const collection = weekData.collections[memberId];

        // Find all active loans for this member in this week
        const activeLoansThatWeek = memberLoans.filter(l =>
          l.startWeekNum <= weekNum &&
          (l.startWeekNum + l.termWeeks > weekNum) &&
          l.status === 'ACTIVE'
        );

        // If there are active loans, create an entry for each
        if (activeLoansThatWeek.length > 0) {
          activeLoansThatWeek.forEach(activeLoan => {
            ledger.push({
              weekNum,
              date: weekData.date,
              displayDate: weekData.displayDate,
              paid: collection?.paid || false,
              amount: collection?.amount || state.weeklyAmount || 1000,
              paymentMethod: collection?.paymentMethod || 'UPI',
              paidAt: collection?.paidAt || null,
              loanPaid: collection?.loanInstallmentPaid || false,
              loanAmount: activeLoan.weeklyInstallment,
              loanPaidAt: collection?.loanInstallmentPaidAt || null,
              loanNickname: activeLoan.nickname || 'Loan',
              loanId: activeLoan.id
            });
          });
        } else {
          // No active loans this week
          ledger.push({
            weekNum,
            date: weekData.date,
            displayDate: weekData.displayDate,
            paid: collection?.paid || false,
            amount: collection?.amount || state.weeklyAmount || 1000,
            paymentMethod: collection?.paymentMethod || 'UPI',
            paidAt: collection?.paidAt || null,
            loanPaid: collection?.loanInstallmentPaid || false,
            loanAmount: 0,
            loanPaidAt: collection?.loanInstallmentPaidAt || null,
            loanNickname: ''
          });
        }
      }
    }
    return ledger;
  };

  const LOAN_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

  const getLoanColor = (loanId) => {
    const hash = loanId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return LOAN_COLORS[hash % LOAN_COLORS.length];
  };

  const getMemberAvailableLoanNicknames = (memberId) => {
    const loans = state.loans.filter(l => l.memberId === memberId);
    return [...new Map(loans.map(l => [l.nickname || 'Loan', l])).entries()]
      .map(([nickname, loan]) => ({ nickname, loanId: loan.id }));
  };

  const getLoanTransactionsForMember = (loan) => {
    const transactions = [];
    for (let week = loan.startWeekNum; week < loan.startWeekNum + loan.termWeeks && week <= 52; week++) {
      const weekData = state.weeks[week];
      const isPaymentWeek = weekData?.collections?.[loan.memberId]?.loanInstallmentPaid || false;
      transactions.push({
        week,
        date: weekData?.date,
        displayDate: weekData?.displayDate,
        paid: isPaymentWeek,
        amount: loan.weeklyInstallment
      });
    }
    return transactions.slice(0, 10);
  };

  return (
    <div className="members-container">
      {/* Header */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          marginBottom: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Users size={24} color="#d1fae5" />
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{state.members.length} Group Members</h2>
        </div>
        <p style={{ fontSize: '0.9rem', color: '#a7f3d0' }}>
          View member status, payment history, and loans. To edit members, go to Settings → Members Management
        </p>
      </div>

      {/* Members Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
        {state.members.map((member) => {
          const mStats = getMemberStats(state, member.id);
          const currentWeekData = state.weeks[state.currentWeekNum]?.collections[member.id] || {};
          const activeLoans = mStats.activeLoans;

          return (
            <div
              key={member.id}
              style={{
                background: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {/* Member Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="avatar"
                  style={{
                    backgroundColor: member.avatarColor || '#10b981',
                    width: '48px',
                    height: '48px'
                  }}
                >
                  {member.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontWeight: '700', fontSize: '1.05rem', color: '#ffffff' }}>
                    {member.name}
                  </h4>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Username: <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '3px' }}>
                      {member.name.split(' ')[0]}
                    </code>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{ fontSize: '0.8rem', color: '#cbd5e1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Phone size={13} color="#94a3b8" /> {member.phone}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CreditCard size={13} color="#94a3b8" /> {member.upiId}
                </div>
              </div>

              {/* Status & Quick Stats */}
              <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' }}>Status</span>
                  <div>
                    {mStats.status === 'CLEAN' && <span className="status-badge clean">✓ Good Standing</span>}
                    {mStats.status === 'PENDING_1' && <span className="status-badge pending_1">⚠️ 1 Wk Pending</span>}
                    {mStats.status === 'OVERDUE_2' && <span className="status-badge overdue_2">⚠️ 2 Wks Overdue</span>}
                    {mStats.status === 'CRITICAL_3' && <span className="status-badge critical_3">🚨 3 Wks Critical</span>}
                    {mStats.status === 'BLOCKED' && <span className="status-badge blocked">⛔ BLOCKED</span>}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Regular Invested</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#10b981', marginTop: '2px' }}>
                      ₹{mStats.totalRegularPaid.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: '#94a3b8' }}>Unpaid Weeks</span>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', color: mStats.unpaidPastWeeks > 0 ? '#f87171' : '#10b981', marginTop: '2px' }}>
                      {mStats.unpaidPastWeeks} week(s)
                    </div>
                  </div>
                </div>
              </div>

              {/* Current Week Status */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  This Week (Week {state.currentWeekNum})
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Contribution</span>
                    </div>
                    {currentWeekData.paid ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                        <CheckCircle2 size={14} color="#10b981" />
                        <span style={{ color: '#10b981', fontWeight: '600' }}>₹{currentWeekData.amount || 1000}</span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                        <AlertCircle size={14} color="#f87171" />
                        <span style={{ color: '#f87171', fontWeight: '600' }}>DUE ₹{currentWeekData.amount || 1000}</span>
                      </div>
                    )}
                  </div>

                  {activeLoans.length > 0 && (
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Loan Inst.</span>
                      </div>
                      {currentWeekData.loanInstallmentPaid ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                          <CheckCircle2 size={14} color="#10b981" />
                          <span style={{ color: '#10b981', fontWeight: '600' }}>₹{currentWeekData.loanInstallmentAmount}</span>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                          <AlertCircle size={14} color="#f59e0b" />
                          <span style={{ color: '#f59e0b', fontWeight: '600' }}>₹{activeLoans[0]?.weeklyInstallment || 0}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Active Loans */}
              {activeLoans.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#f59e0b', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={13} /> Active Loans ({activeLoans.length})
                  </div>
                  {activeLoans.map((loan) => {
                    const remaining = loan.requestedAmount - loan.repaidAmount;
                    const progress = Math.round((loan.repaidAmount / loan.requestedAmount) * 100);
                    return (
                      <div key={loan.id} style={{ fontSize: '0.8rem', marginBottom: '8px', padding: '8px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontWeight: '600', color: '#fbbf24' }}>{loan.nickname}</span>
                          <span style={{ color: '#f59e0b' }}>{progress}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <span>Repaid: ₹{loan.repaidAmount.toLocaleString('en-IN')}</span>
                          <span>Remaining: ₹{remaining.toLocaleString('en-IN')}</span>
                        </div>
                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: '#f59e0b' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recent Payment History */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TrendingUp size={13} /> Recent Payment History (Last 8 Weeks)
                  </div>
                  <button
                    onClick={() => setSelectedMemberForLedger(member)}
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '4px 8px',
                      fontSize: '0.65rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="View complete payment ledger"
                  >
                    <BookOpen size={12} /> Full Ledger
                  </button>
                </div>

                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {Array.from({ length: 8 }).map((_, idx) => {
                    const weekNum = state.currentWeekNum - (7 - idx);
                    if (weekNum < 1) return null;

                    const weekInfo = state.weeks[weekNum];
                    const weekData = weekInfo?.collections[member.id];
                    const isPaid = weekData?.paid || false;
                    const amount = weekData?.amount || state.weeklyAmount || 1000;
                    const isAdvance = isPaid && amount > (state.weeklyAmount || 1000);

                    const tooltipText = `Week ${weekNum}
${weekInfo?.displayDate || 'Date not available'}
Status: ${isPaid ? '✓ Paid' : '✗ Due'}
Amount: ₹${amount.toLocaleString('en-IN')}
${isAdvance ? `Note: Advance payment` : ''}`;

                    return (
                      <div
                        key={weekNum}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '4px',
                          background: isPaid ? '#10b981' : '#374151',
                          border: weekNum === state.currentWeekNum ? '2px solid #60a5fa' : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          color: isPaid ? '#ffffff' : '#94a3b8',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        title={tooltipText}
                      >
                        {weekNum}
                      </div>
                    );
                  })}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '8px' }}>
                  🟩 Paid | 🟫 Unpaid | 🔵 Current Week | Hover for date & status
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info Note */}
      <div style={{
        marginTop: '20px',
        padding: '16px',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid #3b82f6',
        borderRadius: '8px',
        color: '#93c5fd',
        fontSize: '0.85rem',
        lineHeight: '1.5'
      }}>
        <strong>ℹ️ Member Management:</strong> To add, edit, or delete members, go to <strong>Settings → Members Management</strong>. A member's first name is their login username.
      </div>

      {/* Complete Ledger Modal */}
      {selectedMemberForLedger && (
        <div className="modal-overlay" onClick={() => setSelectedMemberForLedger(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="#3b82f6" />
                Complete Payment Ledger - {selectedMemberForLedger.name}
              </h3>
              <button className="modal-close" onClick={() => setSelectedMemberForLedger(null)}>×</button>
            </div>

            {/* Summary Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '20px', padding: '16px', background: 'var(--bg-dark)', borderRadius: '8px' }}>
              {(() => {
                const ledger = getMemberLedger(selectedMemberForLedger.id);
                const mStats = getMemberStats(state, selectedMemberForLedger.id);
                const totalAmount = ledger.reduce((sum, w) => sum + (w.paid ? w.amount : 0), 0);
                const paidWeeks = ledger.filter(w => w.paid).length;
                const totalLoanAvailed = state.loans
                  .filter(l => l.memberId === selectedMemberForLedger.id)
                  .reduce((sum, l) => sum + l.requestedAmount, 0);

                return (
                  <>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Weeks</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#3b82f6' }}>{ledger.length}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Weeks Paid</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#10b981' }}>{paidWeeks}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Collected</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#34d399' }}>₹{totalAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Loans Availed</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#f59e0b' }}>₹{totalLoanAvailed.toLocaleString('en-IN')}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Status</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: '700' }}>
                        {mStats.status === 'CLEAN' && <span className="status-badge clean">Good Standing</span>}
                        {mStats.status === 'PENDING_1' && <span className="status-badge pending_1">1 Wk Pending</span>}
                        {mStats.status === 'OVERDUE_2' && <span className="status-badge overdue_2">2 Wks Overdue</span>}
                        {mStats.status === 'CRITICAL_3' && <span className="status-badge critical_3">3 Wks Critical</span>}
                        {mStats.status === 'BLOCKED' && <span className="status-badge blocked">BLOCKED</span>}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Ledger Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => {
                  setLedgerSubPage('contributions');
                  setLedgerFilterMode('ALL');
                }}
                style={{
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  background: ledgerSubPage === 'contributions' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
                  border: 'none',
                  borderBottom: ledgerSubPage === 'contributions' ? '3px solid #10b981' : '3px solid transparent',
                  color: ledgerSubPage === 'contributions' ? '#10b981' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📊 Contributions
              </button>
              <button
                onClick={() => {
                  setLedgerSubPage('loans');
                  setLedgerFilterMode('ALL');
                  setLedgerLoanFilter('ALL');
                  setLedgerLoanStatusFilter('ALL');
                }}
                style={{
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  background: ledgerSubPage === 'loans' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                  border: 'none',
                  borderBottom: ledgerSubPage === 'loans' ? '3px solid #f59e0b' : '3px solid transparent',
                  color: ledgerSubPage === 'loans' ? '#f59e0b' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                💰 Loans
              </button>
            </div>

            {/* CONTRIBUTIONS TAB */}
            {ledgerSubPage === 'contributions' && (
              <div>
                {/* Sort & Filter Controls */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', marginRight: '8px' }}>Sort by:</label>
                    <select
                      value={ledgerSortBy}
                      onChange={(e) => setLedgerSortBy(e.target.value)}
                      style={{
                        background: 'var(--bg-dark)',
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#e5e7eb',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="week-desc">Week (Newest First)</option>
                      <option value="week-asc">Week (Oldest First)</option>
                      <option value="status">Status (Paid First)</option>
                      <option value="amount">Amount (Highest First)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', marginRight: '8px' }}>Filter:</label>
                    <select
                      value={ledgerFilterMode}
                      onChange={(e) => setLedgerFilterMode(e.target.value)}
                      style={{
                        background: 'var(--bg-dark)',
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        color: '#e5e7eb',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="ALL">All Weeks</option>
                      <option value="PAID">Paid</option>
                      <option value="UNPAID">Unpaid</option>
                    </select>
                  </div>
                </div>

                {/* Contributions Table */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.85rem'
                  }}>
                    <thead>
                      <tr style={{ background: 'rgba(16, 185, 129, 0.1)', borderBottom: '2px solid #10b981' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#10b981' }}>Week</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#10b981' }}>Due Date</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#10b981' }}>Status</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#10b981' }}>Amount</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', color: '#10b981' }}>Paid Date</th>
                        <th style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: '#10b981' }}>Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let ledger = getMemberLedger(selectedMemberForLedger.id);

                        // Apply filter
                        if (ledgerFilterMode === 'PAID') {
                          ledger = ledger.filter(e => e.paid);
                        } else if (ledgerFilterMode === 'UNPAID') {
                          ledger = ledger.filter(e => !e.paid);
                        }

                        // Apply sort
                        if (ledgerSortBy === 'week-asc') {
                          ledger = ledger.sort((a, b) => a.weekNum - b.weekNum);
                        } else if (ledgerSortBy === 'week-desc') {
                          ledger = ledger.sort((a, b) => b.weekNum - a.weekNum);
                        } else if (ledgerSortBy === 'status') {
                          ledger = ledger.sort((a, b) => (b.paid ? 1 : 0) - (a.paid ? 1 : 0));
                        } else if (ledgerSortBy === 'amount') {
                          ledger = ledger.sort((a, b) => b.amount - a.amount);
                        }

                        return ledger.map((entry) => (
                          <tr key={entry.weekNum} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: entry.weekNum === state.currentWeekNum ? 'rgba(16, 185, 129, 0.05)' : 'transparent' }}>
                            <td style={{ padding: '12px', fontWeight: '600', color: '#60a5fa' }}>Week {entry.weekNum}</td>
                            <td style={{ padding: '12px', color: '#cbd5e1' }}>{entry.displayDate}</td>
                            <td style={{ padding: '12px', textAlign: 'center' }}>
                              {entry.paid ? (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#10b981' }}>
                                  <CheckCircle2 size={14} /> Paid
                                </span>
                              ) : (
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', color: '#f87171' }}>
                                  <AlertCircle size={14} /> Due
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', fontWeight: '600', color: entry.paid ? '#34d399' : '#f87171' }}>
                              ₹{entry.amount.toLocaleString('en-IN')}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'left', color: entry.paidAt ? '#10b981' : '#6b7280', fontWeight: entry.paidAt ? '600' : 'normal' }}>
                              {entry.paidAt || '-'}
                            </td>
                            <td style={{ padding: '12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                              {entry.paymentMethod || '-'}
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* LOANS TAB */}
            {ledgerSubPage === 'loans' && (
              <div>
                {(() => {
                  const memberLoans = state.loans.filter(l => l.memberId === selectedMemberForLedger.id);
                  const activeCount = memberLoans.filter(l => !isLoanClosed(l)).length;
                  const closedCount = memberLoans.length - activeCount;

                  const visibleLoans = memberLoans.filter(l => {
                    if (ledgerLoanStatusFilter === 'ACTIVE') return !isLoanClosed(l);
                    if (ledgerLoanStatusFilter === 'CLOSED') return isLoanClosed(l);
                    return true;
                  });

                  const statusTabs = [
                    { key: 'ALL', label: `All (${memberLoans.length})`, color: '#f59e0b' },
                    { key: 'ACTIVE', label: `⏳ Active (${activeCount})`, color: '#10b981' },
                    { key: 'CLOSED', label: `✓ Closed (${closedCount})`, color: '#6b7280' }
                  ];

                  return memberLoans.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
                      <p style={{ fontSize: '1rem' }}>📭 No loans for this member</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Loan Status Filter */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', marginRight: '4px' }}>Show:</label>
                        {statusTabs.map(tab => {
                          const isSelected = ledgerLoanStatusFilter === tab.key;
                          return (
                            <button
                              key={tab.key}
                              onClick={() => {
                                setLedgerLoanStatusFilter(tab.key);
                                setExpandedLoanInModal(null);
                              }}
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                borderRadius: '999px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                background: isSelected ? `${tab.color}33` : 'transparent',
                                border: `1px solid ${isSelected ? tab.color : '#374151'}`,
                                color: isSelected ? tab.color : '#94a3b8'
                              }}
                            >
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      {visibleLoans.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94a3b8' }}>
                          <p style={{ fontSize: '0.95rem' }}>
                            {ledgerLoanStatusFilter === 'CLOSED'
                              ? '📭 No closed loans for this member yet'
                              : '📭 No active loans for this member'}
                          </p>
                        </div>
                      )}

                      {visibleLoans.map((loan) => {
                        const transactions = getLoanTransactionsForMember(loan);
                        const paidCount = transactions.filter(t => t.paid).length;
                        const isExpanded = expandedLoanInModal === loan.id;
                        const isClosed = isLoanClosed(loan);

                        return (
                          <div key={loan.id} style={{ background: 'var(--bg-dark)', border: `1px solid ${isClosed ? 'rgba(107, 114, 128, 0.3)' : 'rgba(251, 191, 36, 0.2)'}`, borderRadius: '8px', overflow: 'hidden' }}>
                            {/* Loan Header */}
                            <div
                              onClick={() => setExpandedLoanInModal(isExpanded ? null : loan.id)}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '16px',
                                cursor: 'pointer',
                                background: isClosed
                                  ? 'linear-gradient(135deg, rgba(107, 114, 128, 0.12) 0%, rgba(75, 85, 99, 0.05) 100%)'
                                  : 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
                                borderBottom: isExpanded ? `1px solid ${isClosed ? 'rgba(107, 114, 128, 0.3)' : 'rgba(251, 191, 36, 0.2)'}` : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '1rem', fontWeight: '700', color: '#f3f4f6' }}>
                                  {loan.nickname}
                                </div>
                                <span style={{
                                  fontSize: '0.7rem',
                                  fontWeight: '700',
                                  padding: '2px 8px',
                                  borderRadius: '999px',
                                  background: isClosed ? 'rgba(107, 114, 128, 0.25)' : 'rgba(16, 185, 129, 0.2)',
                                  color: isClosed ? '#9ca3af' : '#10b981',
                                  border: `1px solid ${isClosed ? 'rgba(107, 114, 128, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`
                                }}>
                                  {isClosed ? '✓ CLOSED' : '⏳ ACTIVE'}
                                </span>
                                <div style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
                                  ₹{loan.weeklyInstallment}/week • {transactions.length} weeks • {paidCount} paid
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontWeight: '700', fontSize: '1.1rem', color: paidCount === transactions.length ? '#10b981' : '#f59e0b' }}>
                                    ₹{loan.repaidAmount}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                    of ₹{loan.disbursedAmount}
                                  </div>
                                </div>
                                {isExpanded ? <ChevronUp size={20} color="#fbbf24" /> : <ChevronDown size={20} color="#94a3b8" />}
                              </div>
                            </div>

                            {/* Transaction Details */}
                            {isExpanded && (
                              <div style={{ padding: '16px', background: 'rgba(0,0,0,0.3)' }}>
                                <div style={{ marginBottom: '16px' }}>
                                  <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e5e7eb', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> Payment Schedule
                                  </h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                                    {transactions.map((tx, idx) => (
                                      <div
                                        key={idx}
                                        onClick={() => {
                                          // Call the handler to toggle loan payment
                                          // This requires passing the handler from App.jsx
                                        }}
                                        style={{
                                          padding: '10px',
                                          borderRadius: '6px',
                                          background: tx.paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(243, 244, 246, 0.05)',
                                          border: `1px solid ${tx.paid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(243, 244, 246, 0.1)'}`,
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          textAlign: 'center'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = tx.paid ? 'rgba(16, 185, 129, 0.25)' : 'rgba(243, 244, 246, 0.1)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = tx.paid ? 'rgba(16, 185, 129, 0.15)' : 'rgba(243, 244, 246, 0.05)'}
                                      >
                                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: tx.paid ? '#10b981' : '#f3f4f6' }}>
                                          W{tx.week}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>
                                          {tx.displayDate?.split(' ')[0] || formatDateDDMMYY(tx.date)}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: tx.paid ? '#10b981' : '#f87171', fontWeight: '600', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                          {tx.paid && <CheckCircle2 size={12} />}
                                          {tx.paid ? '✓' : '○'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Loan Summary */}
                                <div style={{ background: 'rgba(251, 191, 36, 0.1)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: '8px', padding: '12px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>Loan Amount:</span>
                                      <div style={{ fontWeight: '700', color: '#fbbf24', marginTop: '2px' }}>₹{loan.disbursedAmount}</div>
                                    </div>
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>Repaid So Far:</span>
                                      <div style={{ fontWeight: '700', color: '#10b981', marginTop: '2px' }}>₹{loan.repaidAmount}</div>
                                    </div>
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>Status:</span>
                                      <div style={{ fontWeight: '700', color: loan.status === 'REPAID' ? '#10b981' : '#f59e0b', marginTop: '2px' }}>
                                        {loan.status}
                                      </div>
                                    </div>
                                    <div>
                                      <span style={{ color: '#94a3b8' }}>Upfront Fee:</span>
                                      <div style={{ fontWeight: '700', color: '#94a3b8', marginTop: '2px' }}>₹{loan.upfrontFee}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Close Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setSelectedMemberForLedger(null)}
                className="btn btn-secondary"
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Details Modal */}
      {selectedLoanForDetails && (
        <div className="modal-overlay" onClick={() => setSelectedLoanForDetails(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#f59e0b' }}>💰</span>
                Loan Details
              </h3>
              <button className="modal-close" onClick={() => setSelectedLoanForDetails(null)}>×</button>
            </div>

            {(() => {
              const loan = selectedLoanForDetails;
              const borrower = state.members.find(m => m.id === loan.memberId) || { name: 'Unknown' };
              const remaining = loan.requestedAmount - loan.repaidAmount;
              const progressPct = Math.round((loan.repaidAmount / loan.requestedAmount) * 100);
              const weeksCompleted = Math.floor(loan.repaidAmount / loan.weeklyInstallment);

              return (
                <div>
                  {/* Loan Header */}
                  <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>LOAN NICKNAME</div>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#fbbf24' }}>{loan.nickname || 'Loan'}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.9rem' }}>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Borrower</span>
                        <div style={{ fontWeight: '600', color: '#ffffff' }}>{borrower.name}</div>
                      </div>
                      <div>
                        <span style={{ color: '#94a3b8' }}>Status</span>
                        <div style={{ fontWeight: '600', color: loan.status === 'ACTIVE' ? '#10b981' : '#6b7280' }}>
                          {loan.status === 'ACTIVE' ? '⏳ Active' : '✓ Repaid'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Loan Amounts */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>Requested</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#60a5fa' }}>₹{loan.requestedAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>Repaid</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#10b981' }}>₹{loan.repaidAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase' }}>Remaining</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: '700', color: loan.status === 'ACTIVE' ? '#f87171' : '#6b7280' }}>₹{remaining.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '8px' }}>
                      <span>Repayment Progress</span>
                      <span style={{ fontWeight: '600', color: '#f59e0b' }}>{progressPct}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${progressPct}%`, background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}></div>
                    </div>
                  </div>

                  {/* Loan Details Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px', fontSize: '0.9rem' }}>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Disbursed Amount (90%)</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e5e7eb' }}>₹{loan.disbursedAmount.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Upfront Fee (10%)</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fbbf24' }}>₹{loan.upfrontFee.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Weekly Installment</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e5e7eb' }}>₹{loan.weeklyInstallment.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Loan Term</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e5e7eb' }}>{loan.termWeeks} weeks</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Start Week</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e5e7eb' }}>Week {loan.startWeekNum}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>End Week</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e5e7eb' }}>Week {loan.startWeekNum + loan.termWeeks - 1}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Created</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#e5e7eb' }}>{loan.createdAt}</div>
                    </div>
                    <div style={{ background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '8px', padding: '12px' }}>
                      <div style={{ color: '#94a3b8', marginBottom: '4px' }}>Weeks Completed</div>
                      <div style={{ fontSize: '1rem', fontWeight: '600', color: '#34d399' }}>{weeksCompleted}/{loan.termWeeks}</div>
                    </div>
                  </div>

                  {/* Close Button */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                      onClick={() => setSelectedLoanForDetails(null)}
                      className="btn btn-secondary"
                    >
                      Close Details
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
