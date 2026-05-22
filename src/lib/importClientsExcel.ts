import type { Client } from '@/types';
import { CLIENT_EXPENSE_OPTIONS, type ClientExpenseType } from '@/types';
import { normalizeClientName } from '@/lib/importClients';
import { parseVerificationPeriodInput } from '@/lib/clientUtils';

/** One parsed row from Excel ready to import, update, or skip. */
export interface ClientImportPreviewRow {
  rowNumber: number;
  payload: Omit<Client, 'id'>;
  status: 'new' | 'duplicate' | 'override' | 'invalid';
  /** Set when status is duplicate or override. */
  existingClientId?: number;
  message?: string;
}

export interface ParseClientsExcelOptions {
  /** When true, rows matching an existing client name are marked for update. */
  overrideExisting?: boolean;
}

/** Template column headers (row 1). */
export const CLIENT_IMPORT_HEADERS = [
  'Client Name',
  'Expenses',
  'Warning Note',
  'New Client',
  'Started Date',
  'Client Reviewed',
  'Verification Days',
] as const;

const HEADER_ALIASES: Record<string, string[]> = {
  name: ['client name', 'client', 'name'],
  expenses: ['expenses', 'expense'],
  warning_note: ['warning note', 'warning', 'warning_note'],
  is_new_client: ['new client', 'is new client', 'new_client'],
  started_date: ['started date', 'start date', 'started_date'],
  new_client_reviewed: ['client reviewed', 'reviewed', 'new client reviewed', 'verified'],
  verification_days: ['verification days', 'verification_days', 'days'],
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parse Excel serial or string to YYYY-MM-DD. */
function parseDateCell(
  val: unknown,
  parseExcelDate?: (n: number) => { y: number; m: number; d: number } | null
): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`;
  }
  if (typeof val === 'number' && val > 0 && parseExcelDate) {
    const parsed = parseExcelDate(val);
    if (parsed) {
      return `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`;
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }
  return null;
}

function parseYesNo(val: unknown): boolean {
  if (typeof val === 'boolean') return val;
  const s = String(val ?? '').trim().toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === '1';
}

function parseExpense(val: unknown): ClientExpenseType | null {
  const s = String(val ?? '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'wire') return 'Wire';
  if (lower === 'ach') return 'ACH';
  if ((CLIENT_EXPENSE_OPTIONS as readonly string[]).includes(s)) return s as ClientExpenseType;
  return null;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Map header row cells to field keys. */
function mapHeaders(headerRow: unknown[]): Partial<Record<keyof typeof HEADER_ALIASES, number>> {
  const map: Partial<Record<keyof typeof HEADER_ALIASES, number>> = {};
  headerRow.forEach((cell, idx) => {
    const h = normalizeHeader(String(cell ?? ''));
    if (!h) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      if (aliases.includes(h)) {
        map[field as keyof typeof HEADER_ALIASES] = idx;
      }
    }
  });
  return map;
}

function cell(row: unknown[], idx: number | undefined): unknown {
  if (idx == null) return undefined;
  return row[idx];
}

/**
 * Parse first worksheet of an Excel file into client import rows.
 */
export async function parseClientsExcelFile(
  file: File,
  existingClients: Client[],
  options: ParseClientsExcelOptions = {}
): Promise<{ rows: ClientImportPreviewRow[]; parseErrors: string[] }> {
  const overrideExisting = options.overrideExisting ?? false;
  const existingByName = new Map(
    existingClients.map((c) => [normalizeClientName(c.name), c] as const)
  );
  const XLSX = await import('xlsx');
  const parseExcelDate = XLSX.SSF?.parse_date_code?.bind(XLSX.SSF);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { rows: [], parseErrors: ['The file has no worksheets.'] };
  }
  const sheet = workbook.Sheets[sheetName];
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) {
    return { rows: [], parseErrors: ['Add a header row and at least one data row.'] };
  }

  const headerMap = mapHeaders(raw[0] as unknown[]);
  if (headerMap.name == null) {
    return {
      rows: [],
      parseErrors: ['Missing required column: Client Name (or Client / Name).'],
    };
  }

  const seenInFile = new Set<string>();
  const rows: ClientImportPreviewRow[] = [];
  const parseErrors: string[] = [];

  for (let i = 1; i < raw.length; i++) {
    const row = raw[i] as unknown[];
    const rowNumber = i + 1;
    const nameRaw = String(cell(row, headerMap.name) ?? '').trim();
    if (!nameRaw) continue;

    const key = normalizeClientName(nameRaw);
    if (seenInFile.has(key)) {
      rows.push({
        rowNumber,
        payload: emptyPayload(nameRaw),
        status: 'invalid',
        message: 'Duplicate name in file',
      });
      continue;
    }
    seenInFile.add(key);

    const expenses = parseExpense(cell(row, headerMap.expenses));
    const expensesRaw = String(cell(row, headerMap.expenses) ?? '').trim();
    if (expensesRaw && !expenses) {
      rows.push({
        rowNumber,
        payload: emptyPayload(nameRaw),
        status: 'invalid',
        message: 'Expenses must be Wire or ACH',
      });
      continue;
    }

    let isNewClient = parseYesNo(cell(row, headerMap.is_new_client));
    let startedDate = parseDateCell(cell(row, headerMap.started_date), parseExcelDate);

    const verificationDaysRaw = cell(row, headerMap.verification_days);
    let verificationDays = 30;
    let verificationAlways = false;
    let newClientReviewed = false;

    const periodStr =
      verificationDaysRaw != null && String(verificationDaysRaw).trim() !== ''
        ? String(verificationDaysRaw).trim()
        : '';

    if (periodStr.toLowerCase() === 'always') {
      const parsed = parseVerificationPeriodInput('always');
      verificationDays = parsed.verification_days;
      verificationAlways = parsed.verification_always;
      newClientReviewed = parsed.new_client_reviewed;
      isNewClient = true;
    } else if (isNewClient) {
      const daysStr = periodStr || '30';
      const n = parseInt(daysStr, 10);
      if (!n || n < 1) {
        rows.push({
          rowNumber,
          payload: emptyPayload(nameRaw),
          status: 'invalid',
          message: 'Verification Days must be a positive number or "always"',
        });
        continue;
      }
      verificationDays = n;
      newClientReviewed = parseYesNo(cell(row, headerMap.new_client_reviewed));
    }

    if (isNewClient && !startedDate && !verificationAlways) {
      startedDate = new Date().toISOString().split('T')[0];
    }

    const payload: Omit<Client, 'id'> = {
      name: nameRaw,
      expenses,
      warning_note: String(cell(row, headerMap.warning_note) ?? '').trim() || null,
      is_new_client: isNewClient,
      started_date: isNewClient ? startedDate : null,
      new_client_reviewed: newClientReviewed,
      verification_days: isNewClient ? verificationDays : 30,
      verification_always: isNewClient ? verificationAlways : false,
    };

    const existingClient = existingByName.get(key);
    if (existingClient) {
      if (overrideExisting) {
        rows.push({
          rowNumber,
          payload,
          status: 'override',
          existingClientId: existingClient.id,
          message: 'Will update existing client',
        });
      } else {
        rows.push({
          rowNumber,
          payload,
          status: 'duplicate',
          existingClientId: existingClient.id,
          message: 'Already in Clients list',
        });
      }
    } else {
      rows.push({ rowNumber, payload, status: 'new' });
    }
  }

  if (rows.length === 0 && parseErrors.length === 0) {
    parseErrors.push('No client rows found below the header.');
  }

  return { rows, parseErrors };
}

function emptyPayload(name: string): Omit<Client, 'id'> {
  return {
    name,
    expenses: null,
    warning_note: null,
    is_new_client: false,
    started_date: null,
    new_client_reviewed: false,
    verification_days: 30,
    verification_always: false,
  };
}

/** Download empty Excel template for client import. */
export async function downloadClientsImportTemplate(): Promise<void> {
  const XLSX = await import('xlsx');
  const example: string[][] = [
    [...CLIENT_IMPORT_HEADERS],
    ['Acme Transport', 'Wire', 'Call before billing', 'YES', '2026-01-15', 'NO', '30'],
    ['Beta Logistics', 'ACH', '', 'NO', '', '', ''],
    ['Trusted Partner', 'Wire', '', 'YES', '2026-01-01', 'YES', 'always'],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(example);
  worksheet['!cols'] = CLIENT_IMPORT_HEADERS.map((h) => ({
    wch: Math.max(h.length, 14),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clients');
  XLSX.writeFile(workbook, 'clients-import-template.xlsx');
}
