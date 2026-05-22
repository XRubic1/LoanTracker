import type { WorksheetEntry } from '@/types';

type ExportRow = Record<string, string | number | boolean>;

export interface WorksheetExportRow {
  entry: WorksheetEntry;
  clientName: string;
  authorLabel: string;
  expenses: string;
  warningNote: string;
}

/** Export worksheet activity rows to Excel. */
export async function exportWorksheetActivityExcel(
  rows: WorksheetExportRow[],
  filenamePrefix = 'worksheet-activity'
): Promise<void> {
  const XLSX = await import('xlsx');
  const sheetData: ExportRow[] = rows.map((r) => ({
    Date: r.entry.work_date,
    Client: r.clientName,
    'On Client List': r.entry.client_id != null ? 'YES' : 'NO',
    Invoices: r.entry.invoice_count,
    'Group Work': r.entry.group_work ? 'YES' : 'NO',
    Verified: r.entry.verified ? 'YES' : 'NO',
    Note: r.entry.note ?? '',
    Expenses: r.expenses,
    'Warning Note': r.warningNote,
    User: r.authorLabel,
  }));
  const worksheet = XLSX.utils.json_to_sheet(sheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Activity');
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filenamePrefix}-${date}.xlsx`);
}
