import type { Loan } from '@/types';
import { fmt } from '@/lib/utils';

/**
 * Print all open (active + visible) loans with full schedules to PDF using the browser's print dialog.
 *
 * Inputs:
 * - loans: full list of loans from the app.
 *
 * Behavior:
 * - Filters to loans that are not hidden and not fully paid.
 * - Opens a new window with a print-friendly HTML document.
 * - Triggers the browser's print dialog (user can choose "Save as PDF").
 */
export function printOpenLoans(loans: Loan[]): void {
  if (typeof window === 'undefined') return;

  const openLoans = loans.filter(
    (l) => !l.hidden && l.paidCount < l.totalInstallments,
  );

  if (openLoans.length === 0) {
    window.alert('No open loans to print.');
    return;
  }

  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const sections = openLoans
    .map((loan) => {
      const remaining =
        (loan.totalInstallments - loan.paidCount) * loan.installment;

      const rows = Array.from({ length: loan.totalInstallments }, (_, i) => {
        const scheduledDate = new Date(loan.startDate);
        scheduledDate.setDate(scheduledDate.getDate() + i * loan.freqDays);
        const scheduledStr = scheduledDate.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });

        const rawPaidDate = loan.paymentDates?.[i];
        const actualStr = rawPaidDate
          ? new Date(rawPaidDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : '—';

        const note = (loan.paymentNotes?.[i] ?? '').trim();
        const noteStr = note ? note.replace(/</g, '&lt;') : '—';

        const status =
          i < loan.paidCount ? 'Paid' : i === loan.paidCount ? 'Next' : 'Pending';

        return `<tr>
          <td>${i + 1}</td>
          <td>${scheduledStr}</td>
          <td>${actualStr}</td>
          <td>${fmt(loan.installment)}</td>
          <td>${status}</td>
          <td style="max-width:220px;word-break:break-word">${noteStr}</td>
        </tr>`;
      }).join('');

      const startDateStr = new Date(loan.startDate).toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        },
      );

      const safeNote = loan.note ? loan.note.replace(/</g, '&lt;') : '';

      return `
      <section class="loan-section">
        <header class="loan-header">
          <div class="loan-title">
            <div class="loan-client">${loan.client}</div>
            <div class="loan-ref">${
              loan.ref ? `Ref: ${loan.ref}` : '&nbsp;'
            }</div>
          </div>
          <div class="loan-summary-pill">
            <span>${fmt(loan.total)}</span>
            <span>${loan.paidCount}/${loan.totalInstallments} paid</span>
          </div>
        </header>

        <table class="summary-table">
          <tr><td>Client</td><td>${loan.client}</td></tr>
          <tr><td>Reference</td><td>${loan.ref || '—'}</td></tr>
          <tr><td>Total loan</td><td>${fmt(loan.total)}</td></tr>
          <tr><td>Installment</td><td>${fmt(loan.installment)}</td></tr>
          <tr><td>Total installments</td><td>${loan.totalInstallments}</td></tr>
          <tr><td>Paid installments</td><td>${loan.paidCount}</td></tr>
          <tr><td>Estimated remaining</td><td>${fmt(remaining)}</td></tr>
          <tr><td>Start date</td><td>${startDateStr}</td></tr>
          ${
            safeNote
              ? `<tr><td>Loan note</td><td>${safeNote}</td></tr>`
              : ''
          }
        </table>

        <table class="installments-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Scheduled date</th>
              <th>Paid date</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `;
    })
    .join('<div class="page-break"></div>');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Open Loans — TRUFUNDING LLC</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 24px 32px;
      color: #111827;
      font-size: 13px;
      background: #ffffff;
    }
    h1 {
      font-size: 22px;
      margin: 0 0 4px;
    }
    .meta {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 24px;
    }
    .loan-section {
      margin-bottom: 32px;
      padding: 18px 18px 20px;
      border-radius: 14px;
      border: 1px solid #e5e7eb;
      background: linear-gradient(135deg, #f9fafb, #ffffff);
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.04);
      page-break-inside: avoid;
    }
    .loan-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .loan-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .loan-client {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }
    .loan-ref {
      font-size: 11px;
      color: #6b7280;
    }
    .loan-summary-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      border-radius: 999px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 11px;
      font-weight: 500;
    }
    .loan-summary-pill span:last-child {
      color: #6b7280;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    .summary-table {
      margin-bottom: 12px;
    }
    .summary-table td {
      border: 1px solid #e5e7eb;
      padding: 6px 9px;
    }
    .summary-table td:first-child {
      width: 140px;
      background: #f9fafb;
      color: #6b7280;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .summary-table td:last-child {
      font-weight: 500;
    }
    .installments-table th,
    .installments-table td {
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      text-align: left;
    }
    .installments-table th {
      background: #f3f4f6;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #4b5563;
    }
    .installments-table td {
      font-size: 12px;
    }
    .page-break {
      page-break-before: always;
      height: 12px;
    }
    @media print {
      body {
        padding: 16px 20px;
      }
      .loan-section {
        box-shadow: none;
        border-color: #d1d5db;
      }
      .page-break {
        display: block;
      }
    }
  </style>
</head>
<body>
  <h1>Open Loans</h1>
  <div class="meta">TRUFUNDING LLC · Printed ${printDate} · ${
    openLoans.length
  } open loan${openLoans.length === 1 ? '' : 's'}</div>
  ${sections}
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;

  w.document.write(html);
  w.document.close();
  w.focus();

  // Delay to allow the new document to render before printing.
  setTimeout(() => {
    try {
      w.print();
    } finally {
      w.close();
    }
  }, 300);
}

/**
 * Print a compact one-sheet-style report of all open loans.
 *
 * Layout is a single table so that, for a typical number of loans, everything fits on one PDF page.
 */
export function printOpenLoansSummary(loans: Loan[]): void {
  if (typeof window === 'undefined') return;

  const openLoans = loans.filter(
    (l) => !l.hidden && l.paidCount < l.totalInstallments,
  );

  if (openLoans.length === 0) {
    window.alert('No open loans to print.');
    return;
  }

  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const rows = openLoans
    .map((loan) => {
      const remaining =
        (loan.totalInstallments - loan.paidCount) * loan.installment;

      const startDateStr = new Date(loan.startDate).toLocaleDateString(
        'en-US',
        {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        },
      );

      const note =
        (loan.note ?? '').trim().length > 40
          ? `${loan.note.trim().slice(0, 37)}…`
          : loan.note ?? '';
      const safeNote = note ? note.replace(/</g, '&lt;') : '';

      return `<tr>
        <td>${loan.client}</td>
        <td>${loan.ref || '—'}</td>
        <td>${fmt(loan.total)}</td>
        <td>${fmt(loan.installment)}</td>
        <td>${loan.paidCount}/${loan.totalInstallments}</td>
        <td>${fmt(remaining)}</td>
        <td>${startDateStr}</td>
        <td>${safeNote || '—'}</td>
      </tr>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Open Loans — Summary</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      padding: 16px 20px;
      color: #111827;
      font-size: 11px;
      background: #ffffff;
    }
    h1 {
      font-size: 18px;
      margin: 0 0 2px;
    }
    .meta {
      font-size: 10px;
      color: #6b7280;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10px;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 4px 6px;
      text-align: left;
      vertical-align: top;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #4b5563;
    }
    th:nth-child(1) { width: 16%; }
    th:nth-child(2) { width: 10%; }
    th:nth-child(3) { width: 11%; }
    th:nth-child(4) { width: 11%; }
    th:nth-child(5) { width: 10%; }
    th:nth-child(6) { width: 13%; }
    th:nth-child(7) { width: 11%; }
    th:nth-child(8) { width: 18%; }
    @page {
      margin: 12mm 10mm;
    }
  </style>
</head>
<body>
  <h1>Open Loans — Summary</h1>
  <div class="meta">TRUFUNDING LLC · Printed ${printDate} · ${
    openLoans.length
  } open loan${openLoans.length === 1 ? '' : 's'}</div>
  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th>Ref</th>
        <th>Total</th>
        <th>Installment</th>
        <th>Paid</th>
        <th>Remaining</th>
        <th>Start</th>
        <th>Note</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) return;

  w.document.write(html);
  w.document.close();
  w.focus();

  setTimeout(() => {
    try {
      w.print();
    } finally {
      w.close();
    }
  }, 300);
}

