import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, FastForward } from 'lucide-react';
import { formatDateDDMMYY } from '../utils/storage';

// Tracks a media query so the log can render as stacked rows on a phone and as a
// table on wider screens. A 6-column table on a 390px screen has to scroll
// sideways, which hides the Amount and Method columns behind a gesture with no
// visual affordance.
const useIsNarrow = (query = '(max-width: 767px)') => {
  const [isNarrow, setIsNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsNarrow(e.matches);
    setIsNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return isNarrow;
};

const money = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

const advanceBadge = (
  <span
    title="Paid in advance — this week has not arrived yet"
    style={{
      display: 'inline-flex', alignItems: 'center', gap: '3px',
      fontSize: '0.8rem', fontWeight: '700', padding: '2px 6px',
      borderRadius: '999px', background: 'rgba(96, 165, 250, 0.2)',
      color: '#93c5fd', border: '1px solid rgba(96, 165, 250, 0.4)'
    }}
  >
    <FastForward size={10} /> ADVANCE
  </span>
);

export default function ContributionLog({ entries, currentWeek }) {
  const isNarrow = useIsNarrow();

  if (!entries || entries.length === 0) {
    return (
      <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', padding: '12px' }}>
        No contribution weeks to show yet
      </p>
    );
  }

  // ---- Phone: one stacked row per week, no horizontal scrolling ----
  if (isNarrow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entries.map((entry, idx) => {
          const isCurrent = entry.weekNum === currentWeek;
          return (
            <div
              key={`${entry.weekNum}-${idx}`}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: isCurrent ? 'rgba(96, 165, 250, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isCurrent ? 'rgba(96, 165, 250, 0.35)' : 'rgba(255, 255, 255, 0.07)'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                {/* The separator is real text, not just a margin, so the week and
                    the date do not run together as "W14 Jan 2026" for screen
                    readers and copy-paste. */}
                <span style={{ fontSize: '0.9rem' }}>
                  <strong style={{ color: '#60a5fa' }}>W{entry.weekNum}</strong>
                  <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                    {' · '}{entry.displayDate}
                  </span>
                </span>
                <strong style={{ fontSize: '0.95rem', color: entry.paid ? '#34d399' : '#f87171' }}>
                  {money(entry.amount)}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.8rem' }}>
                {entry.paid ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: '600' }}>
                    <CheckCircle2 size={13} /> Paid
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f87171', fontWeight: '600' }}>
                    <AlertCircle size={13} /> Due
                  </span>
                )}
                {entry.paid && entry.paymentMethod && (
                  <span style={{ color: '#94a3b8' }}>{entry.paymentMethod}</span>
                )}
                {entry.paidAt && (
                  <span style={{ color: '#94a3b8' }}>· {formatDateDDMMYY(entry.paidAt)}</span>
                )}
                {entry.isAdvance && advanceBadge}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ---- Wider screens: the full table ----
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: 'rgba(16, 185, 129, 0.1)', borderBottom: '2px solid rgba(16, 185, 129, 0.4)' }}>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#10b981' }}>Week</th>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#10b981' }}>Due Date</th>
            <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#10b981' }}>Status</th>
            <th style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: '#10b981' }}>Amount</th>
            <th style={{ padding: '10px', textAlign: 'left', fontWeight: '600', color: '#10b981' }}>Paid Date</th>
            <th style={{ padding: '10px', textAlign: 'center', fontWeight: '600', color: '#10b981' }}>Method</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr
              key={`${entry.weekNum}-${idx}`}
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: entry.weekNum === currentWeek ? 'rgba(96, 165, 250, 0.08)' : 'transparent'
              }}
            >
              <td style={{ padding: '10px', fontWeight: '600', color: '#60a5fa' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  W{entry.weekNum}
                  {entry.isAdvance && advanceBadge}
                </span>
              </td>
              <td style={{ padding: '10px', color: '#cbd5e1' }}>{entry.displayDate}</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>
                {entry.paid ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#10b981', fontWeight: '600' }}>
                    <CheckCircle2 size={14} /> Paid
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#f87171', fontWeight: '600' }}>
                    <AlertCircle size={14} /> Due
                  </span>
                )}
              </td>
              <td style={{ padding: '10px', textAlign: 'right', fontWeight: '600', color: entry.paid ? '#34d399' : '#f87171' }}>
                {money(entry.amount)}
              </td>
              <td style={{ padding: '10px', color: entry.paidAt ? '#10b981' : '#6b7280', fontWeight: entry.paidAt ? '600' : 'normal' }}>
                {entry.paidAt ? formatDateDDMMYY(entry.paidAt) : '-'}
              </td>
              <td style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem' }}>
                {entry.paid ? (entry.paymentMethod || '-') : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
