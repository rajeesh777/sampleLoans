import React, { useState } from 'react';
import {
  ClipboardList, ChevronDown, ChevronUp, CheckCircle2, AlertCircle,
  HandCoins, IndianRupee, Calculator, FastForward, Clock, Download, Wallet
} from 'lucide-react';
import { getWeekSummary, formatDateDDMMYY } from '../utils/storage';
import { exportWeekSummaryImage } from '../utils/exportSummaryImage';

export default function WeekSummary({ state, loggedInMember }) {
  const currentWeekNum = state.currentWeekNum || 1;
  const totalWeeks = state.totalWeeks || 52;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(currentWeekNum);
  const [exportNote, setExportNote] = useState('');

  const summary = getWeekSummary(state, selectedWeek);

  const handleExport = () => {
    try {
      const filename = exportWeekSummaryImage(summary, state, loggedInMember);
      setExportNote(`Downloaded ${filename}`);
    } catch (err) {
      console.error('Failed to export week summary image:', err);
      setExportNote('Could not generate the image — see the browser console.');
    }
    setTimeout(() => setExportNote(''), 5000);
  };

  const weekOptions = [];
  for (let w = 1; w <= totalWeeks; w++) {
    if (state.weeks[w]) weekOptions.push(state.weeks[w]);
  }

  const money = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

  const timingBadge = (timing) => {
    if (timing === 'ADVANCE') {
      return { label: 'ADVANCE', color: '#60a5fa', bg: 'rgba(96, 165, 250, 0.18)', Icon: FastForward };
    }
    if (timing === 'LATE') {
      return { label: 'LATE', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.18)', Icon: Clock };
    }
    return null;
  };

  const sectionTitle = (Icon, color, text, right) => (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      gap: '10px', flexWrap: 'wrap', marginBottom: '10px'
    }}>
      <h4 style={{ fontSize: '0.95rem', fontWeight: '700', color: '#e5e7eb', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
        <Icon size={16} color={color} /> {text}
      </h4>
      {right}
    </div>
  );

  const avatar = (name, color) => (
    <div className="avatar" style={{ backgroundColor: color || '#10b981', fontSize: '0.8rem', width: '28px', height: '28px' }}>
      {name.substring(0, 2).toUpperCase()}
    </div>
  );

  const emptyRow = (text) => (
    <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: 0, padding: '10px 0' }}>{text}</p>
  );

  const subCard = { background: 'var(--bg-dark)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '14px', marginBottom: '12px' };

  return (
    <div className="card" style={{ border: '1px solid rgba(96, 165, 250, 0.35)' }}>
      {/* Header / toggle */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', cursor: 'pointer', flexWrap: 'wrap' }}
      >
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <ClipboardList size={20} color="#60a5fa" /> Summarize a Week
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '4px 0 0' }}>
            Contributions, loan returns, new loans and the cash calculation for any Sunday
          </p>
        </div>
        <button
          className="btn"
          onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px',
            borderRadius: '8px', border: '1px solid rgba(96, 165, 250, 0.4)',
            background: 'rgba(96, 165, 250, 0.12)', color: '#60a5fa',
            fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer'
          }}
        >
          {isOpen ? <>Hide <ChevronUp size={15} /></> : <>Summarize <ChevronDown size={15} /></>}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '16px' }}>
          {/* Week picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <label htmlFor="week-summary-select" style={{ fontSize: '0.85rem', fontWeight: '600', color: '#94a3b8' }}>
              Select week:
            </label>
            <select
              id="week-summary-select"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              style={{
                background: 'var(--bg-dark)', border: '1px solid #374151', borderRadius: '6px',
                padding: '7px 10px', color: '#e5e7eb', fontSize: '0.85rem', cursor: 'pointer'
              }}
            >
              {weekOptions.map((w) => (
                <option key={w.weekNum} value={w.weekNum}>
                  W{w.weekNum} — {w.displayDate}{w.weekNum === currentWeekNum ? ' (current)' : ''}
                </option>
              ))}
            </select>
            {selectedWeek !== currentWeekNum && (
              <button
                onClick={() => setSelectedWeek(currentWeekNum)}
                style={{
                  padding: '6px 10px', borderRadius: '6px', border: '1px solid #374151',
                  background: 'transparent', color: '#94a3b8', fontSize: '0.8rem', cursor: 'pointer'
                }}
              >
                Reset to current week
              </button>
            )}
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {summary.displayDate}
            </span>

            <button
              onClick={handleExport}
              title="Download this summary as a spreadsheet-style PNG"
              style={{
                marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 12px', borderRadius: '6px',
                border: '1px solid rgba(16, 185, 129, 0.45)',
                background: 'rgba(16, 185, 129, 0.14)', color: '#10b981',
                fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              <Download size={14} /> Export as Image
            </button>
          </div>

          {exportNote && (
            <div style={{
              fontSize: '0.8rem', color: '#93c5fd', marginBottom: '12px',
              padding: '8px 10px', borderRadius: '6px',
              background: 'rgba(96, 165, 250, 0.1)', border: '1px solid rgba(96, 165, 250, 0.3)'
            }}>
              {exportNote}
            </div>
          )}

          {/* ---- 1. Contributions ---- */}
          <div style={subCard}>
            {sectionTitle(IndianRupee, '#10b981', `1. Contributions (${summary.contributions.length}/${state.members.length} paid)`,
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#10b981' }}>{money(summary.totalContribution)}</span>
            )}

            {summary.contributions.length === 0 ? emptyRow('No contributions recorded for this week.') : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.contributions.map((c) => {
                  const badge = timingBadge(c.timing);
                  return (
                    <div key={c.memberId} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                      padding: '8px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.08)',
                      border: '1px solid rgba(16, 185, 129, 0.18)'
                    }}>
                      {avatar(c.name, c.avatarColor)}
                      <span style={{ fontWeight: '600', color: '#f3f4f6', fontSize: '0.88rem', flex: 1, minWidth: '110px' }}>
                        {c.name}
                      </span>
                      <span style={{ fontWeight: '700', color: '#34d399', fontSize: '0.88rem' }}>
                        {money(c.amount)}
                      </span>
                      <span style={{
                        fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8',
                        padding: '2px 8px', borderRadius: '999px', background: 'rgba(148,163,184,0.15)'
                      }}>
                        {c.paymentMethod}
                      </span>
                      {badge && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.8rem', fontWeight: '700', color: badge.color,
                          padding: '2px 8px', borderRadius: '999px', background: badge.bg,
                          border: `1px solid ${badge.color}66`
                        }}>
                          <badge.Icon size={10} /> {badge.label}
                        </span>
                      )}
                      {/* Payment date is shown whenever it differs from the due Sunday */}
                      {badge && c.paidAt && (
                        <span style={{ fontSize: '0.8rem', color: '#93c5fd', fontWeight: '600' }}>
                          paid {formatDateDDMMYY(c.paidAt)}
                        </span>
                      )}
                      {!badge && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', color: '#10b981' }}>
                          <CheckCircle2 size={11} /> on time
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {summary.notPaid.length > 0 && (
              <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed rgba(248,113,113,0.3)' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#f87171', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={13} /> Due — not paid ({summary.notPaid.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {summary.notPaid.map((m) => (
                    <span key={m.memberId} style={{
                      fontSize: '0.8rem', color: '#fca5a5', padding: '4px 10px', borderRadius: '999px',
                      background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.3)'
                    }}>
                      {m.name} · {money(m.amount)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---- 2. Loan returns ---- */}
          <div style={subCard}>
            {sectionTitle(HandCoins, '#fbbf24', `2. Loan Returns (${summary.loanReturns.length})`,
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#fbbf24' }}>{money(summary.totalLoanReturn)}</span>
            )}

            {summary.loanReturns.length === 0 ? emptyRow('No loan installments were paid in this week.') : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.loanReturns.map((r) => (
                  <div key={r.memberId} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '8px 10px', borderRadius: '6px', background: 'rgba(251, 191, 36, 0.08)',
                    border: '1px solid rgba(251, 191, 36, 0.2)'
                  }}>
                    {avatar(r.name, r.avatarColor)}
                    <span style={{ fontWeight: '600', color: '#f3f4f6', fontSize: '0.88rem', flex: 1, minWidth: '110px' }}>
                      {r.name}
                      {r.loanNicknames.length > 0 && (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>
                          {' '}· {r.loanNicknames.join(', ')}
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: '700', color: '#fbbf24', fontSize: '0.88rem' }}>
                      {money(r.amount)}
                    </span>
                    {r.paidAt && (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        paid {formatDateDDMMYY(r.paidAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- 3. New loans ---- */}
          <div style={subCard}>
            {sectionTitle(HandCoins, '#a78bfa', `3. New Loans (${summary.newLoans.length})`,
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#a78bfa' }}>{money(summary.totalNewLoanRequested)}</span>
            )}

            {summary.newLoans.length === 0 ? emptyRow('No new loans were issued in this week.') : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.newLoans.map((l) => (
                  <div key={l.loanId} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '8px 10px', borderRadius: '6px', background: 'rgba(167, 139, 250, 0.08)',
                    border: '1px solid rgba(167, 139, 250, 0.22)'
                  }}>
                    {avatar(l.name, '#a78bfa')}
                    <span style={{ fontWeight: '600', color: '#f3f4f6', fontSize: '0.88rem', flex: 1, minWidth: '110px' }}>
                      {l.name}
                      {l.nickname && (
                        <span style={{
                          marginLeft: '8px', fontSize: '0.8rem', fontWeight: '600', color: '#c4b5fd',
                          padding: '2px 8px', borderRadius: '999px', background: 'rgba(167, 139, 250, 0.18)',
                          border: '1px solid rgba(167, 139, 250, 0.35)'
                        }}>
                          {l.nickname}
                        </span>
                      )}
                    </span>
                    <span style={{ fontWeight: '700', color: '#c4b5fd', fontSize: '0.88rem' }}>
                      {money(l.requestedAmount)} availed
                    </span>
                    <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      fee {money(l.upfrontFee)} · {money(l.disbursedAmount)} paid out
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- 4. Miscellaneous expenses ---- */}
          <div style={subCard}>
            {sectionTitle(Wallet, '#f59e0b', `4. Expenses (${summary.expenses.length})`,
              <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#f87171' }}>− {money(summary.totalExpenses)}</span>
            )}

            {summary.expenses.length === 0 ? emptyRow('No expenses recorded for this week.') : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {summary.expenses.map((e) => (
                  <div key={e.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
                    padding: '8px 10px', borderRadius: '6px', background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.22)'
                  }}>
                    <Wallet size={16} color="#f59e0b" />
                    <span style={{ fontWeight: '600', color: '#f3f4f6', fontSize: '0.88rem', flex: 1, minWidth: '110px' }}>
                      {e.description}
                    </span>
                    <span style={{ fontWeight: '700', color: '#f87171', fontSize: '0.88rem' }}>
                      − {money(e.amount)}
                    </span>
                    <span style={{
                      fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8',
                      padding: '2px 8px', borderRadius: '999px', background: 'rgba(148,163,184,0.15)'
                    }}>
                      {e.paymentMethod}
                    </span>
                    {e.date && (
                      <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                        {formatDateDDMMYY(e.date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ---- 5. Calculations ---- */}
          <div style={{
            background: 'rgba(96, 165, 250, 0.1)',
            border: '1px solid rgba(96, 165, 250, 0.35)', borderRadius: '8px', padding: '14px'
          }}>
            {sectionTitle(Calculator, '#60a5fa', '5. Calculations')}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '0.86rem' }}>
              {[
                ['Total contributions', summary.totalContribution, '#34d399', '+'],
                ['Total loan returns', summary.totalLoanReturn, '#fbbf24', '+'],
                [`Cash available as of week ${selectedWeek - 1}`, summary.openingCash, '#93c5fd', '+'],
                ['New loans given (cash paid out)', summary.totalNewLoanDisbursed, '#f87171', '−'],
                ['Miscellaneous expenses', summary.totalExpenses, '#f87171', '−']
              ].map(([label, value, color, sign]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ color: '#cbd5e1' }}>{sign} {label}</span>
                  <span style={{ fontWeight: '700', color }}>{money(value)}</span>
                </div>
              ))}

              <div style={{
                display: 'flex', justifyContent: 'space-between', gap: '10px',
                marginTop: '6px', paddingTop: '10px', borderTop: '1px solid rgba(96, 165, 250, 0.3)'
              }}>
                <span style={{ fontWeight: '700', color: '#e5e7eb' }}>
                  Cash available after week {selectedWeek}
                </span>
                <span style={{ fontWeight: '800', fontSize: '1.05rem', color: '#60a5fa' }}>
                  {money(summary.closingCash)}
                </span>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '6px', lineHeight: '1.5' }}>
                ({money(summary.totalContribution)} + {money(summary.totalLoanReturn)}) + {money(summary.openingCash)} − {money(summary.totalNewLoanDisbursed)} − {money(summary.totalExpenses)} = {money(summary.closingCash)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
