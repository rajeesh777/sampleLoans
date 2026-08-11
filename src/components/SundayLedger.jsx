import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Tag, Calendar, CheckCircle2, BookOpen } from 'lucide-react';
import { formatDateDDMMYY } from '../utils/storage';
import ContributionLog from './ContributionLog';

export default function SundayLedger({
  state,
  onToggleLoanInstallment,
  onAdvanceLoanInstallment
}) {
  const [section, setSection] = useState('loans'); // 'loans' or 'contributions'
  const [expandedLoanId, setExpandedLoanId] = useState(null);
  const [activeMemberIndex, setActiveMemberIndex] = useState(0);
  const [slideDir, setSlideDir] = useState('right'); // drives the enter animation

  const allLoans = state.loans || [];
  const currentWeek = state.currentWeekNum || 1;
  const totalWeeks = state.totalWeeks || 52;
  const members = state.members || [];

  const getLoanMember = (memberId) => state.members.find(m => m.id === memberId);

  const getLoanTransactions = (loan) => {
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

  const handleToggleLoanPayment = (week, loan) => {
    onToggleLoanInstallment(week, loan.memberId, loan.id);
    setExpandedLoanId(loan.id);
  };

  // Contribution log for one member.
  // Weeks up to and including the current week always appear. Weeks beyond the
  // current week appear only when they have already been paid in advance.
  const getContributionLog = (memberId) => {
    const entries = [];
    for (let w = 1; w <= totalWeeks; w++) {
      const weekData = state.weeks[w];
      if (!weekData) continue;

      const rec = weekData.collections?.[memberId];
      const paid = rec?.paid || false;
      if (w > currentWeek && !paid) continue;

      entries.push({
        weekNum: w,
        date: weekData.date,
        displayDate: weekData.displayDate,
        paid,
        amount: rec?.amount || state.weeklyAmount || 1000,
        paymentMethod: rec?.paymentMethod || 'UPI',
        paidAt: rec?.paidAt || null,
        isAdvance: w > currentWeek
      });
    }
    return entries;
  };

  // ---- Person-card deck navigation ----
  const goToMember = (nextIndex, direction) => {
    if (members.length === 0) return;
    setSlideDir(direction);
    // Wrap around at both ends so the deck cycles.
    setActiveMemberIndex(((nextIndex % members.length) + members.length) % members.length);
  };

  const goPrevMember = () => goToMember(activeMemberIndex - 1, 'left');
  const goNextMember = () => goToMember(activeMemberIndex + 1, 'right');

  // Keep the index valid if members are added or removed while this tab is open.
  useEffect(() => {
    if (activeMemberIndex > members.length - 1) setActiveMemberIndex(0);
  }, [members.length, activeMemberIndex]);

  // Arrow-key navigation, only while the Contribution Book is showing.
  useEffect(() => {
    if (section !== 'contributions' || members.length < 2) return;

    const handleKey = (e) => {
      if (e.key === 'ArrowLeft') {
        setSlideDir('left');
        setActiveMemberIndex(i => (i - 1 + members.length) % members.length);
      } else if (e.key === 'ArrowRight') {
        setSlideDir('right');
        setActiveMemberIndex(i => (i + 1) % members.length);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [section, members.length]);

  // Swipe / drag across the card. Pointer events cover both touch and mouse.
  const dragStartX = useRef(null);
  const SWIPE_THRESHOLD = 60;

  const handlePointerDown = (e) => { dragStartX.current = e.clientX; };
  const handlePointerUp = (e) => {
    if (dragStartX.current === null) return;
    const deltaX = e.clientX - dragStartX.current;
    dragStartX.current = null;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
    if (deltaX < 0) goNextMember(); else goPrevMember();
  };

  const sectionTabs = [
    { key: 'loans', label: '💰 Loan Book', color: '#fbbf24' },
    { key: 'contributions', label: '📗 Contribution Book', color: '#10b981' }
  ];

  return (
    <div className="sunday-ledger-container" style={{ padding: '16px' }}>
      {/* Fund Book Header */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <BookOpen size={24} color="#60a5fa" /> Fund Book
        </h1>
        <p style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
          All group transactions, split into loan repayments and weekly contributions
        </p>

        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
          {sectionTabs.map(tab => {
            const isActive = section === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setSection(tab.key)}
                style={{
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  background: isActive ? `${tab.color}22` : 'transparent',
                  border: 'none',
                  borderBottom: `3px solid ${isActive ? tab.color : 'transparent'}`,
                  color: isActive ? tab.color : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ============ LOAN BOOK ============ */}
      {section === 'loans' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Tag size={20} color="#fbbf24" /> Loan Book
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Track loan repayments for each member • Max 10 weeks shown per loan
            </p>
          </div>

          {allLoans.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem' }}>📭 No loans recorded yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {allLoans.map((loan) => {
                const member = getLoanMember(loan.memberId);
                const transactions = getLoanTransactions(loan);
                const paidCount = transactions.filter(t => t.paid).length;
                const isExpanded = expandedLoanId === loan.id;

                return (
                  <div key={loan.id} className="card" style={{ overflow: 'hidden' }}>
                    {/* Loan Header */}
                    <div
                      onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        cursor: 'pointer',
                        background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
                        borderBottom: isExpanded ? '1px solid rgba(251, 191, 36, 0.2)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <div className="avatar" style={{ backgroundColor: member?.avatarColor || '#10b981', fontSize: '0.85rem' }}>
                          {member?.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '700', fontSize: '1rem', color: '#f3f4f6' }}>
                            {loan.nickname} — {member?.name}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
                            ₹{loan.weeklyInstallment}/week • {transactions.length} weeks • {paidCount} paid
                          </div>
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
                      <div style={{ padding: '16px', background: 'var(--bg-dark)' }}>
                        <div style={{ marginBottom: '16px' }}>
                          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e5e7eb', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} /> Payment Schedule
                          </h4>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                            {transactions.map((tx, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleToggleLoanPayment(tx.week, loan)}
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
          )}
        </div>
      )}

      {/* ============ CONTRIBUTION BOOK ============ */}
      {section === 'contributions' && (
        <div>
          <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={20} color="#10b981" /> Contribution Book
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              One member at a time • swipe the card or use ← → arrows to move between people • weeks 1–{currentWeek} shown, later weeks appear only once paid in advance
            </p>
          </div>

          {members.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 16px', color: '#94a3b8' }}>
              <p style={{ fontSize: '1rem' }}>📭 No members yet</p>
            </div>
          ) : (
            (() => {
              const member = members[Math.min(activeMemberIndex, members.length - 1)];
              const log = getContributionLog(member.id);
              const paidEntries = log.filter(e => e.paid);
              const dueCount = log.filter(e => !e.paid).length;
              const advanceCount = log.filter(e => e.isAdvance).length;
              const totalPaid = paidEntries.reduce((sum, e) => sum + e.amount, 0);

              const navBtnStyle = {
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                background: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                fontSize: '0.85rem',
                fontWeight: '600',
                cursor: members.length > 1 ? 'pointer' : 'not-allowed',
                opacity: members.length > 1 ? 1 : 0.4,
                transition: 'all 0.2s'
              };

              return (
                <div>
                  {/* Deck navigation */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                    <button
                      onClick={goPrevMember}
                      disabled={members.length < 2}
                      aria-label="Previous member"
                      style={navBtnStyle}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>

                    <div style={{ textAlign: 'center', flex: 1, minWidth: '140px' }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: '#e5e7eb' }}>
                        {member.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                        Card {activeMemberIndex + 1} of {members.length}
                      </div>
                    </div>

                    <button
                      onClick={goNextMember}
                      disabled={members.length < 2}
                      aria-label="Next member"
                      style={navBtnStyle}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>

                  {/* Card deck — stacked backs behind the active card give it depth */}
                  <div style={{ position: 'relative' }}>
                    {members.length > 1 && (
                      <>
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 0,
                          transform: 'translateY(12px) scale(0.975)',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.12)'
                        }} />
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 0,
                          transform: 'translateY(6px) scale(0.99)',
                          borderRadius: '12px',
                          background: 'rgba(16, 185, 129, 0.07)',
                          border: '1px solid rgba(16, 185, 129, 0.18)'
                        }} />
                      </>
                    )}

                    <div
                      key={`${member.id}-${slideDir}`}
                      className={slideDir === 'right' ? 'deck-in-right' : 'deck-in-left'}
                      onPointerDown={handlePointerDown}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={() => { dragStartX.current = null; }}
                      style={{ position: 'relative', zIndex: 1, touchAction: 'pan-y' }}
                    >
                      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
                        {/* Member Card Header */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '16px',
                            flexWrap: 'wrap',
                            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
                            borderBottom: '1px solid rgba(16, 185, 129, 0.2)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '200px' }}>
                            <div className="avatar" style={{ backgroundColor: member.avatarColor || '#10b981', fontSize: '0.85rem' }}>
                              {member.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '1rem', color: '#f3f4f6' }}>
                                {member.name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                                {paidEntries.length} paid • {dueCount} due
                                {advanceCount > 0 && ` • ${advanceCount} advance`}
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#10b981' }}>
                                ₹{totalPaid.toLocaleString('en-IN')}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                contributed
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Contribution Log */}
                        <div style={{ padding: '16px', background: 'var(--bg-dark)' }}>
                          <ContributionLog entries={log} currentWeek={currentWeek} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deck position dots */}
                  {members.length > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '22px', flexWrap: 'wrap' }}>
                      {members.map((m, idx) => {
                        const isActive = idx === activeMemberIndex;
                        return (
                          <button
                            key={m.id}
                            onClick={() => goToMember(idx, idx > activeMemberIndex ? 'right' : 'left')}
                            title={m.name}
                            aria-label={`Show ${m.name}`}
                            style={{
                              width: isActive ? '26px' : '9px',
                              height: '9px',
                              padding: 0,
                              borderRadius: '999px',
                              border: 'none',
                              cursor: 'pointer',
                              background: isActive ? '#10b981' : 'rgba(148, 163, 184, 0.4)',
                              transition: 'all 0.2s'
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </div>
      )}
    </div>
  );
}
