import type { Loan } from '@/types';
import {
  fmt,
  getLoanBasePerInstallment,
  getLoanEffectiveTotal,
  getLoanFeePerInstallment,
  getLoanProviderDisplay,
  getScheduleDueDateOnly,
} from '@/lib/utils';

/** Loans funded through an external provider (not TruFunding). */
function isOtherProviderLoan(loan: Loan): boolean {
  return loan.providerType === 'Other';
}

/** Summary-table rows for provider + factoring income on non–Tru Funding loans. */
function buildOtherProviderSummaryRows(loan: Loan): string {
  if (!isOtherProviderLoan(loan)) return '';

  const fee = loan.factoringFee ?? 0;
  const feePer = getLoanFeePerInstallment(loan);
  const remainingCount = Math.max(0, loan.totalInstallments - loan.paidCount);
  const remainingFactoring = feePer * remainingCount;

  const rows = [
    `<tr><td>Provider</td><td>${escapeHtml(getLoanProviderDisplay(loan))}</td></tr>`,
    `<tr><td>Loan principal</td><td>${fmt(loan.total)}</td></tr>`,
    `<tr><td>Factoring income (total)</td><td>${fmt(fee)}</td></tr>`,
    `<tr><td>Total with factoring</td><td>${fmt(getLoanEffectiveTotal(loan))}</td></tr>`,
    `<tr><td>Factoring income / installment</td><td>${fmt(feePer)}</td></tr>`,
    `<tr><td>Remaining factoring income</td><td>${fmt(remainingFactoring)}</td></tr>`,
  ];

  return rows.join('\n');
}

function escapeHtml(text: string): string {
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Installment amount cell — splits base vs factoring for Other providers. */
function formatInstallmentAmountCell(loan: Loan): string {
  const total = fmt(loan.installment);
  if (!isOtherProviderLoan(loan) || (loan.factoringFee ?? 0) <= 0) {
    return total;
  }
  const base = fmt(getLoanBasePerInstallment(loan));
  const fee = fmt(getLoanFeePerInstallment(loan));
  return `${base}<br><span class="factoring-line">+ ${fee} factoring = ${total}</span>`;
}

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
        const dueStr = getScheduleDueDateOnly(loan.startDate, i, loan.freqDays ?? 7);
        const [sy, sm, sd] = dueStr.split('-').map(Number);
        const scheduledStr = new Date(sy, sm - 1, sd).toLocaleDateString('en-US', {
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
          <td>${formatInstallmentAmountCell(loan)}</td>
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
          <tr><td>Client</td><td>${escapeHtml(loan.client)}</td></tr>
          <tr><td>Reference</td><td>${loan.ref || '—'}</td></tr>
          ${
            isOtherProviderLoan(loan)
              ? buildOtherProviderSummaryRows(loan)
              : `<tr><td>Total loan</td><td>${fmt(loan.total)}</td></tr>`
          }
          <tr><td>Installment</td><td>${formatInstallmentAmountCell(loan)}</td></tr>
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
    .factoring-line {
      font-size: 10px;
      color: #6b7280;
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

