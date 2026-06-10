import { buildClientInsuranceList } from '@/lib/clientInsuranceList';
import { normalizeClientName } from '@/lib/importClients';
import type { Client, ClientInsurance } from '@/types';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Print current client registry with MC and DOT (from insurance when linked). */
export function printClientsList(clients: Client[], clientInsurance: ClientInsurance[]): void {
  if (typeof window === 'undefined') return;

  const insuranceByName = new Map(
    clientInsurance.map((ci) => [normalizeClientName(ci.client), ci] as const)
  );
  const items = buildClientInsuranceList(clientInsurance, clients);

  const rows = items
    .map((item) => {
      const name = item.kind === 'insurance' ? item.record.client : item.client.name;
      const registry = item.kind === 'registry' ? item.client : clients.find(
        (c) => normalizeClientName(c.name) === normalizeClientName(name)
      );
      const insurance =
        item.kind === 'insurance' ? item.record : insuranceByName.get(normalizeClientName(name));
      const expenses = registry?.expenses ?? '—';
      const warning = registry?.warning_note?.trim() || '—';
      const mc = insurance?.mc?.trim() || '—';
      const dot = insurance?.dot?.trim() || '—';

      return `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(expenses)}</td>
      <td class="wrap">${escapeHtml(warning)}</td>
      <td class="mono">${escapeHtml(mc)}</td>
      <td class="mono">${escapeHtml(dot)}</td>
    </tr>`;
    })
    .join('');

  const printDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Clients List</title>
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
    .sub { font-size: 12px; color: #6b7280; }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; color: #111827; }
    .meta { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead { background: #f8fafc; }
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
      vertical-align: top;
    }
    .mono { font-family: ui-monospace, monospace; font-weight: 500; }
    .wrap { max-width: 220px; word-break: break-word; }
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
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">TRUFUNDING LLC</div>
    <div class="sub">Clients List</div>
  </div>
  <h1>Client registry</h1>
  <div class="meta">Printed ${printDate} · ${items.length} client${items.length !== 1 ? 's' : ''}</div>
  <table>
    <thead>
      <tr>
        <th>Client</th>
        <th>Expenses</th>
        <th>Warning</th>
        <th>MC</th>
        <th>DOT</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <div class="footer">TRUFUNDING LLC · Clients List</div>
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
