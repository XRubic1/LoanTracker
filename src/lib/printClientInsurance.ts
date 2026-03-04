import type { ClientInsurance } from '@/types';
import { isClientInsuranceCancellationWithDate } from '@/lib/clientInsuranceUtils';

/**
 * Print a clean report of clients with cancellation (and date) to PDF via the browser print dialog.
 * Sorted by cancellation date, oldest first.
 */
export function printCancellationReport(clientInsurance: ClientInsurance[]): void {
  if (typeof window === 'undefined') return;

  const list = clientInsurance
    .filter(isClientInsuranceCancellationWithDate)
    .map((c) => ({ ...c, _sortDate: c.expiration_date ? new Date(c.expiration_date).getTime() : 0 }))
    .sort((a, b) => a._sortDate - b._sortDate);

  if (list.length === 0) {
    window.alert('No clients with cancellation and date to print.');
    return;
  }

  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const rows = list
    .map(
      (c) => `
    <tr>
      <td>${escapeHtml(c.client)}</td>
      <td class="mc">${escapeHtml(c.mc)}</td>
      <td class="date">${c.expiration_date ? formatDate(c.expiration_date) : '—'}</td>
    </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Client Insurance — Cancellation Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      padding: 32px 40px;
      color: #1a1a1a;
      background: #fff;
      font-size: 14px;
      line-height: 1.45;
    }
    .header {
      margin-bottom: 28px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    .logo {
      font-size: 22px;
      font-weight: 700;
      color: #1d4ed8;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .sub {
      font-size: 12px;
      color: #6b7280;
    }
    h1 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px;
      color: #111827;
    }
    .meta {
      font-size: 12px;
      color: #6b7280;
      margin-bottom: 20px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    thead {
      background: #f8fafc;
    }
    th {
      text-align: left;
      padding: 12px 14px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
      border-bottom: 2px solid #e2e8f0;
    }
    td {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
    }
    tbody tr:hover {
      background: #f8fafc;
    }
    .mc {
      font-family: ui-monospace, monospace;
      font-weight: 500;
    }
    .date {
      font-family: ui-monospace, monospace;
      color: #475569;
    }
    .footer {
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 11px;
      color: #9ca3af;
    }
    @media print {
      body { padding: 20px 24px; }
      .header { border-color: #d1d5db; }
      tbody tr:hover { background: transparent; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">TRUFUNDING LLC</div>
    <div class="sub">Client Insurance — Cancellation Report</div>
  </div>
  <h1>Clients with cancellation (by date, oldest first)</h1>
  <div class="meta">Printed ${printDate} · ${list.length} client${list.length !== 1 ? 's' : ''}</div>
  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th>MC</th>
        <th>Cancellation</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">TRUFUNDING LLC · Client Insurance Cancellation Report</div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
        window.close();
      }, 300);
    };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Please allow popups to print the report.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
