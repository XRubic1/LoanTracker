import type { Loan } from '@/types';
import {
  getLoanBasePerInstallment,
  getLoanFeePerInstallment,
  getLoanProviderDisplay,
} from '@/lib/utils';

/** Open loans included in summary export (not hidden, not fully paid). */
export function getOpenLoansForExport(loans: Loan[]): Loan[] {
  return loans.filter((l) => !l.hidden && l.paidCount < l.totalInstallments);
}

function isOtherProviderLoan(loan: Loan): boolean {
  return loan.providerType === 'Other';
}

type SummaryRow = Record<string, string | number>;

/**
 * Build one summary row per open loan for Excel export.
 * Mirrors the short report columns (provider + factoring when applicable).
 */
function buildSummaryRows(openLoans: Loan[]): SummaryRow[] {
  const showProviderColumns = openLoans.some(isOtherProviderLoan);

  return openLoans.map((loan) => {
    const remaining =
      (loan.totalInstallments - loan.paidCount) * loan.installment;
    const fee = loan.factoringFee ?? 0;
    const feePer = getLoanFeePerInstallment(loan);
    const remainingFactoring =
      feePer * Math.max(0, loan.totalInstallments - loan.paidCount);

    const startDateStr = new Date(loan.startDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const row: SummaryRow = {
      Client: loan.client,
      Ref: loan.ref || '',
      Total: loan.total,
      Installment: loan.installment,
      Paid: `${loan.paidCount}/${loan.totalInstallments}`,
      Remaining: remaining,
      Start: startDateStr,
      Note: (loan.note ?? '').trim(),
    };

    if (showProviderColumns) {
      row.Provider = isOtherProviderLoan(loan)
        ? getLoanProviderDisplay(loan)
        : 'TruFunding';
      row['Factoring income'] = isOtherProviderLoan(loan) ? fee : '';
      row['Rem. factoring'] = isOtherProviderLoan(loan) ? remainingFactoring : '';
      if (isOtherProviderLoan(loan) && fee > 0) {
        row['Installment base'] = getLoanBasePerInstallment(loan);
        row['Factoring / installment'] = feePer;
      } else {
        row['Installment base'] = loan.installment;
        row['Factoring / installment'] = '';
      }
    }

    return row;
  });
}

/** Column order for the worksheet (stable header row). */
function getSummaryColumnOrder(openLoans: Loan[]): string[] {
  const showProviderColumns = openLoans.some(isOtherProviderLoan);
  if (showProviderColumns) {
    return [
      'Client',
      'Ref',
      'Provider',
      'Factoring income',
      'Rem. factoring',
      'Total',
      'Installment base',
      'Factoring / installment',
      'Installment',
      'Paid',
      'Remaining',
      'Start',
      'Note',
    ];
  }
  return [
    'Client',
    'Ref',
    'Total',
    'Installment',
    'Paid',
    'Remaining',
    'Start',
    'Note',
  ];
}

/**
 * Download the open-loans summary as an Excel (.xlsx) file.
 * Replaces the former PDF/print short report.
 */
export async function exportOpenLoansSummaryExcel(loans: Loan[]): Promise<void> {
  if (typeof window === 'undefined') return;

  const XLSX = await import('xlsx');

  const openLoans = getOpenLoansForExport(loans);

  if (openLoans.length === 0) {
    window.alert('No open loans to export.');
    return;
  }

  const exportDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  const columns = getSummaryColumnOrder(openLoans);
  const dataRows = buildSummaryRows(openLoans).map((row) =>
    columns.map((col) => row[col] ?? ''),
  );

  const sheetData: (string | number)[][] = [
    ['Open Loans — Summary'],
    [
      `TRUFUNDING LLC · Exported ${exportDate} · ${openLoans.length} open loan${
        openLoans.length === 1 ? '' : 's'
      }`,
    ],
    [],
    columns,
    ...dataRows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

  worksheet['!cols'] = columns.map((col) => {
    if (col === 'Client' || col === 'Note') return { wch: 22 };
    if (col === 'Provider') return { wch: 14 };
    if (col.includes('Installment') || col === 'Remaining' || col === 'Total') {
      return { wch: 16 };
    }
    return { wch: 12 };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Open Loans');

  XLSX.writeFile(workbook, `Open_Loans_Summary_${fileDate}.xlsx`);
}
