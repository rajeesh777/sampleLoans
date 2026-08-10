// Renders a week summary as a spreadsheet-style PNG and triggers a download.
// Drawn directly on a canvas so no export library is needed.

import { formatDateDDMMYY } from './storage';

const COL_WIDTHS = [230, 115, 105, 105, 135];
const ROW_NUM_W = 40;
const COL_HEADER_H = 24;

const ROW_H = {
  title: 36,
  subtitle: 22,
  blank: 12,
  section: 28,
  header: 26,
  data: 25,
  total: 27,
  note: 20
};

// Excel-ish palette
const C = {
  paper: '#ffffff',
  grid: '#d4d4d4',
  band: '#f3f3f3',
  bandText: '#5f6368',
  bandBorder: '#c6c6c6',
  ink: '#1f2328',
  muted: '#6b7280',
  green: '#217346',       // Excel ribbon green
  greenSoft: '#e9f2ec',
  headerText: '#14532d',
  totalFill: '#f7f7f7',
  money: '#0b6b3a',
  negative: '#b42318',
  advance: '#1d4ed8',
  late: '#b45309'
};

const money = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

// Build the row model for one week summary.
const buildRows = (summary, state, exportedBy) => {
  const rows = [];
  const push = (type, cells, opts = {}) => rows.push({ type, cells, ...opts });

  push('title', [`${state.groupName || 'Isthooi'} — Week ${summary.weekNum} Summary`]);
  push('subtitle', [`Sunday ${summary.displayDate || ''}  ·  ${state.members.length} members  ·  ₹${(state.weeklyAmount || 1000).toLocaleString('en-IN')} per week`]);
  push('subtitle', [`Exported by ${exportedBy || 'Unknown member'}  ·  ${formatDateDDMMYY(new Date().toISOString().slice(0, 10))}`], { exporter: true });
  push('blank', []);

  // --- 1. Contributions ---
  push('section', [`1. CONTRIBUTIONS  (${summary.contributions.length} of ${state.members.length} paid)`]);
  push('header', ['Member', 'Amount', 'Method', 'Timing', 'Payment Date']);

  if (summary.contributions.length === 0) {
    push('data', ['No contributions recorded', '', '', '', ''], { muted: true });
  } else {
    summary.contributions.forEach((c) => {
      const timing = c.timing === 'ADVANCE' ? 'Advance' : c.timing === 'LATE' ? 'Late' : 'On time';
      // Payment date matters most when it differs from the due Sunday.
      const showDate = c.timing !== 'ON_TIME' && c.paidAt;
      push('data', [c.name, money(c.amount), c.paymentMethod, timing, showDate ? formatDateDDMMYY(c.paidAt) : '—'], {
        moneyCols: [1],
        tint: { 3: c.timing === 'ADVANCE' ? C.advance : c.timing === 'LATE' ? C.late : C.muted }
      });
    });
  }
  push('total', ['Total Contributions', money(summary.totalContribution), '', '', ''], { moneyCols: [1] });

  if (summary.notPaid.length > 0) {
    push('data', [`Due — not paid (${summary.notPaid.length})`, money(summary.notPaid.reduce((s, m) => s + m.amount, 0)), '', '', ''], {
      moneyCols: [1], negative: true
    });
    push('note', [summary.notPaid.map(m => m.name).join(', ')]);
  }
  push('blank', []);

  // --- 2. Loan returns ---
  push('section', [`2. LOAN RETURNS  (${summary.loanReturns.length})`]);
  push('header', ['Member', 'Amount', 'Loan', '', 'Payment Date']);
  if (summary.loanReturns.length === 0) {
    push('data', ['No loan installments paid', '', '', '', ''], { muted: true });
  } else {
    summary.loanReturns.forEach((r) => {
      push('data', [r.name, money(r.amount), r.loanNicknames.join(', ') || '—', '', r.paidAt ? formatDateDDMMYY(r.paidAt) : '—'], { moneyCols: [1] });
    });
  }
  push('total', ['Total Loan Returns', money(summary.totalLoanReturn), '', '', ''], { moneyCols: [1] });
  push('blank', []);

  // --- 3. New loans ---
  push('section', [`3. NEW LOANS  (${summary.newLoans.length})`]);
  push('header', ['Member', 'Availed', 'Upfront Fee', 'Paid Out', 'Nickname']);
  if (summary.newLoans.length === 0) {
    push('data', ['No new loans issued', '', '', '', ''], { muted: true });
  } else {
    summary.newLoans.forEach((l) => {
      push('data', [l.name, money(l.requestedAmount), money(l.upfrontFee), money(l.disbursedAmount), l.nickname || '—'], {
        moneyCols: [1, 2, 3]
      });
    });
  }
  push('total', ['Total New Loans', money(summary.totalNewLoanRequested), '', money(summary.totalNewLoanDisbursed), ''], { moneyCols: [1, 3] });
  push('blank', []);

  // --- 4. Calculations ---
  push('section', ['4. CALCULATIONS']);
  push('header', ['Line', 'Amount', '', '', '']);
  push('data', ['+ Total contributions', money(summary.totalContribution), '', '', ''], { moneyCols: [1] });
  push('data', ['+ Total loan returns', money(summary.totalLoanReturn), '', '', ''], { moneyCols: [1] });
  push('data', [`+ Cash available as of week ${summary.weekNum - 1}`, money(summary.openingCash), '', '', ''], { moneyCols: [1] });
  push('data', ['− New loans given (cash paid out)', money(summary.totalNewLoanDisbursed), '', '', ''], { moneyCols: [1], negative: true });
  push('total', [`Cash available after week ${summary.weekNum}`, money(summary.closingCash), '', '', ''], { moneyCols: [1], grand: true });
  push('note', [`(${money(summary.totalContribution)} + ${money(summary.totalLoanReturn)}) + ${money(summary.openingCash)} − ${money(summary.totalNewLoanDisbursed)} = ${money(summary.closingCash)}`]);

  return rows;
};

const truncate = (ctx, text, maxWidth) => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
};

export const exportWeekSummaryImage = (summary, state, loggedInMember) => {
  const rows = buildRows(summary, state, loggedInMember?.name);

  const tableW = COL_WIDTHS.reduce((a, b) => a + b, 0);
  const width = ROW_NUM_W + tableW;
  const height = COL_HEADER_H + rows.reduce((sum, r) => sum + ROW_H[r.type], 0);

  // Render at 2x so the PNG stays sharp when zoomed or printed.
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.textBaseline = 'middle';

  const FONT = (weight = '', size = 12) => `${weight} ${size}px "Segoe UI", Arial, sans-serif`.trim();

  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, width, height);

  const line = (x1, y1, x2, y2, color = C.grid) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.floor(x1) + 0.5, Math.floor(y1) + 0.5);
    ctx.lineTo(Math.floor(x2) + 0.5, Math.floor(y2) + 0.5);
    ctx.stroke();
  };

  const colX = (i) => ROW_NUM_W + COL_WIDTHS.slice(0, i).reduce((a, b) => a + b, 0);

  // ---- Column header band (A, B, C ...) ----
  ctx.fillStyle = C.band;
  ctx.fillRect(0, 0, width, COL_HEADER_H);
  ctx.fillStyle = C.bandText;
  ctx.font = FONT('600', 11);
  ctx.textAlign = 'center';
  COL_WIDTHS.forEach((w, i) => {
    ctx.fillText(String.fromCharCode(65 + i), colX(i) + w / 2, COL_HEADER_H / 2);
    line(colX(i), 0, colX(i), COL_HEADER_H, C.bandBorder);
  });
  line(0, COL_HEADER_H, width, COL_HEADER_H, C.bandBorder);
  line(ROW_NUM_W, 0, ROW_NUM_W, height, C.bandBorder);

  // ---- Rows ----
  let y = COL_HEADER_H;
  rows.forEach((row, idx) => {
    const h = ROW_H[row.type];
    const spans = row.type === 'title' || row.type === 'subtitle' || row.type === 'section' || row.type === 'note';

    // Row-number gutter
    ctx.fillStyle = C.band;
    ctx.fillRect(0, y, ROW_NUM_W, h);
    ctx.fillStyle = C.bandText;
    ctx.font = FONT('', 10);
    ctx.textAlign = 'center';
    ctx.fillText(String(idx + 1), ROW_NUM_W / 2, y + h / 2);
    line(0, y + h, ROW_NUM_W, y + h, C.bandBorder);

    // Row background
    if (row.type === 'section') {
      ctx.fillStyle = C.green;
      ctx.fillRect(ROW_NUM_W, y, tableW, h);
    } else if (row.type === 'header') {
      ctx.fillStyle = C.greenSoft;
      ctx.fillRect(ROW_NUM_W, y, tableW, h);
    } else if (row.type === 'total') {
      ctx.fillStyle = C.totalFill;
      ctx.fillRect(ROW_NUM_W, y, tableW, h);
    }

    // Cell text
    if (spans) {
      const padX = 8;
      if (row.type === 'title') {
        ctx.fillStyle = C.ink;
        ctx.font = FONT('700', 17);
      } else if (row.type === 'subtitle') {
        ctx.fillStyle = row.exporter ? C.green : C.muted;
        ctx.font = FONT(row.exporter ? '600' : '', 11.5);
      } else if (row.type === 'section') {
        ctx.fillStyle = '#ffffff';
        ctx.font = FONT('700', 12.5);
      } else {
        ctx.fillStyle = C.muted;
        ctx.font = FONT('italic', 11);
      }
      ctx.textAlign = 'left';
      if (row.cells[0]) {
        ctx.fillText(truncate(ctx, row.cells[0], tableW - padX * 2), ROW_NUM_W + padX, y + h / 2);
      }
    } else {
      row.cells.forEach((text, i) => {
        if (text === '' || text == null) return;
        const w = COL_WIDTHS[i];
        const isMoney = (row.moneyCols || []).includes(i);

        if (row.type === 'header') {
          ctx.fillStyle = C.headerText;
          ctx.font = FONT('700', 11.5);
        } else if (row.type === 'total') {
          ctx.fillStyle = isMoney ? (row.grand ? C.green : C.money) : C.ink;
          ctx.font = FONT('700', row.grand ? 13 : 12);
        } else if (row.muted) {
          ctx.fillStyle = C.muted;
          ctx.font = FONT('italic', 11.5);
        } else if (isMoney) {
          ctx.fillStyle = row.negative ? C.negative : C.money;
          ctx.font = FONT('600', 12);
        } else {
          ctx.fillStyle = (row.tint && row.tint[i]) || C.ink;
          ctx.font = FONT('', 12);
        }

        const alignRight = isMoney || (row.type === 'header' && (row.moneyCols || []).includes(i));
        ctx.textAlign = alignRight ? 'right' : 'left';
        const tx = alignRight ? colX(i) + w - 8 : colX(i) + 8;
        ctx.fillText(truncate(ctx, String(text), w - 16), tx, y + h / 2);
      });
    }

    // Gridlines — vertical separators only where there are real cells
    if (!spans) {
      COL_WIDTHS.forEach((w, i) => { if (i > 0) line(colX(i), y, colX(i), y + h); });
      line(colX(COL_WIDTHS.length), y, colX(COL_WIDTHS.length), y + h);
    }
    if (row.type !== 'blank') line(ROW_NUM_W, y + h, width, y + h);

    y += h;
  });

  // Outer frame
  line(0, 0, width, 0, C.bandBorder);
  line(0, 0, 0, height, C.bandBorder);
  line(width - 1, 0, width - 1, height, C.bandBorder);
  line(0, height - 1, width, height - 1, C.bandBorder);

  // ---- Download ----
  // Week number is zero-padded and the week's Sunday date included, so exports for
  // different weeks are distinguishable and sort chronologically in a folder listing.
  const slug = (state.groupName || 'isthooi').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const weekPart = `week-${String(summary.weekNum).padStart(2, '0')}`;
  const datePart = summary.date || 'no-date';
  const filename = `${slug}-${weekPart}-${datePart}-summary.png`;

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Give the browser a moment to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');

  return filename;
};
