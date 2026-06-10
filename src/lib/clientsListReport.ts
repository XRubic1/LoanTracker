import { buildClientInsuranceList } from '@/lib/clientInsuranceList';
import { normalizeClientName } from '@/lib/importClients';
import type { Client, ClientInsurance } from '@/types';

export interface ClientsListRow {
  client: string;
  expenses: string;
  warning: string;
  mc: string;
  dot: string;
}

/** Merged client registry rows for print and Excel export. */
export function buildClientsListRows(
  clients: Client[],
  clientInsurance: ClientInsurance[]
): ClientsListRow[] {
  const insuranceByName = new Map(
    clientInsurance.map((ci) => [normalizeClientName(ci.client), ci] as const)
  );
  const items = buildClientInsuranceList(clientInsurance, clients);

  return items.map((item) => {
    const name = item.kind === 'insurance' ? item.record.client : item.client.name;
    const registry =
      item.kind === 'registry'
        ? item.client
        : clients.find((c) => normalizeClientName(c.name) === normalizeClientName(name));
    const insurance =
      item.kind === 'insurance' ? item.record : insuranceByName.get(normalizeClientName(name));

    return {
      client: name,
      expenses: registry?.expenses ?? '',
      warning: registry?.warning_note?.trim() ?? '',
      mc: insurance?.mc?.trim() ?? '',
      dot: insurance?.dot?.trim() ?? '',
    };
  });
}

/** Download current client list as Excel (.xlsx). */
export async function exportClientsListExcel(
  clients: Client[],
  clientInsurance: ClientInsurance[],
  filenamePrefix = 'clients-list'
): Promise<void> {
  const rows = buildClientsListRows(clients, clientInsurance);
  const XLSX = await import('xlsx');
  const sheetData = rows.map((r) => ({
    Client: r.client,
    Expenses: r.expenses,
    Warning: r.warning,
    MC: r.mc,
    DOT: r.dot,
  }));
  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filenamePrefix}-${date}.xlsx`);
}
