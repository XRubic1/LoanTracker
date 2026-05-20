import type { AaaPayment } from '@/types';
import { fmt, fmtDate } from '@/lib/utils';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function openPrintDocument(html: string): void {
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Pop-up blocked. Allow pop-ups to print.');
    return;
  }
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

const printStyles = `
  * { box-sizing: border-box; }
  body {
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    padding: 16px 20px;
    color: #111827;
    font-size: 11px;
    background: #fff;
  }
  h1 { font-size: 18px; margin: 0 0 2px; }
  h2 { font-size: 14px; margin: 18px 0 6px; color: #374151; }
  .meta { font-size: 10px; color: #6b7280; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px; }
  th, td { border: 1px solid #e5e7eb; padding: 5px 7px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #4b5563; }
  .total-row td { font-weight: 600; background: #f9fafb; }
  .grand-total { margin-top: 12px; font-size: 12px; font-weight: 600; }
  @page { margin: 12mm 10mm; }
`;

function paymentRows(payments: AaaPayment[]): string {
  return payments
    .map(
      (p) => `<tr>
        <td>${escapeHtml(fmtDate(p.paymentDate))}</td>
        <td>${escapeHtml(p.client)}</td>
        <td>${escapeHtml(p.payee)}</td>
        <td style="text-align:right">${escapeHtml(fmt(p.amount))}</td>
      </tr>`
    )
    .join('');
}

function tableHeader(): string {
  return `<thead><tr>
    <th>Date</th><th>Client</th><th>Payee</th><th style="text-align:right">Amount</th>
  </tr></thead>`;
}

/** Print the visible (filtered) payments as one table. */
export function printAaaPaymentsFiltered(
  payments: AaaPayment[],
  filterDescription: string
): void {
  if (typeof window === 'undefined') return;
  if (payments.length === 0) {
    window.alert('No payments match the current filters.');
    return;
  }

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AAA Payments</title>
  <style>${printStyles}</style></head><body>
  <h1>AAA Payments</h1>
  <div class="meta">Printed ${printDate} · ${filterDescription} · ${payments.length} payment${payments.length === 1 ? '' : 's'}</div>
  <table>${tableHeader()}<tbody>${paymentRows(payments)}</tbody></table>
  <div class="grand-total">Total: ${escapeHtml(fmt(total))}</div>
  </body></html>`;

  openPrintDocument(html);
}

/** Print filtered payments grouped by payee with per-payee subtotals. */
export function printAaaPaymentsByPayee(
  payments: AaaPayment[],
  filterDescription: string
): void {
  if (typeof window === 'undefined') return;
  if (payments.length === 0) {
    window.alert('No payments match the current filters.');
    return;
  }

  const byPayee = new Map<string, AaaPayment[]>();
  for (const p of payments) {
    const list = byPayee.get(p.payee) ?? [];
    list.push(p);
    byPayee.set(p.payee, list);
  }

  const payeeOrder = Array.from(byPayee.keys()).sort();
  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const sections = payeeOrder
    .map((payee) => {
      const list = byPayee.get(payee)!;
      const subtotal = list.reduce((s, p) => s + p.amount, 0);
      return `
        <h2>${escapeHtml(payee)}</h2>
        <table>${tableHeader()}
          <tbody>
            ${paymentRows(list)}
            <tr class="total-row">
              <td colspan="3">Subtotal (${list.length})</td>
              <td style="text-align:right">${escapeHtml(fmt(subtotal))}</td>
            </tr>
          </tbody>
        </table>`;
    })
    .join('');

  const grandTotal = payments.reduce((s, p) => s + p.amount, 0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AAA Payments by Payee</title>
  <style>${printStyles}</style></head><body>
  <h1>AAA Payments — By Payee</h1>
  <div class="meta">Printed ${printDate} · ${escapeHtml(filterDescription)} · ${payments.length} payment${payments.length === 1 ? '' : 's'}</div>
  ${sections}
  <div class="grand-total">Grand total: ${escapeHtml(fmt(grandTotal))}</div>
  </body></html>`;

  openPrintDocument(html);
}
