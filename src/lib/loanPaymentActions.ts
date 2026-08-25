import type { Loan } from '@/types';

/** Today's date as YYYY-MM-DD (local calendar). */
export function todayDateOnly(): string {
  return new Date().toISOString().split('T')[0];
}

/** Round to cents. */
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Format dollars for user-facing messages. */
function fmtMoney(n: number): string {
  return `$${roundMoney(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** True when every installment is deducted and there is no open partial. */
export function isLoanFullyPaid(loan: Loan): boolean {
  return loan.paidCount >= loan.totalInstallments && !(loan.partialPaidAmount > 0);
}

/** Amount already stored for an installment index, else the loan's flat installment. */
function amountAtIndex(loan: Loan, index: number): number {
  const custom = loan.paymentAmounts?.[index];
  if (custom != null && Number.isFinite(Number(custom))) return Number(custom);
  return loan.installment;
}

/** Ensure paymentAmounts stays aligned when recording a full installment close. */
function withRecordedAmount(loan: Loan, index: number, amount: number): number[] {
  const amounts = [...(loan.paymentAmounts ?? [])];
  while (amounts.length < index) amounts.push(amountAtIndex(loan, amounts.length));
  if (amounts.length === index) amounts.push(amount);
  else amounts[index] = amount;
  return amounts;
}

function padNotes(notes: string[] | undefined, length: number): string[] {
  const out = [...(notes ?? [])];
  while (out.length < length) out.push('');
  out.length = length;
  return out;
}

/**
 * Close the next open installment in full (optional note + paid date).
 * Uses remaining due after any partial. Returns null if nothing left to close
 * without creating a new installment (prefer buildPostInstallmentPayment for that).
 */
export function buildCloseNextInstallment(
  loan: Loan,
  note = '',
  paidDate?: string
): Loan | null {
  const due = amountAtIndex(loan, loan.paidCount);
  const partial = Number(loan.partialPaidAmount ?? 0) || 0;
  const remaining = roundMoney(due - partial);
  if (loan.paidCount >= loan.totalInstallments && remaining <= 0) return null;
  const result = buildPostInstallmentPayment(loan, remaining > 0 ? remaining : due, note, paidDate);
  return result.ok ? result.loan : null;
}

/**
 * Mark the loan fully paid: fill remaining payment dates/notes through totalInstallments.
 * Returns null if already fully paid.
 */
export function buildCloseLoanFully(loan: Loan, paidDate?: string): Loan | null {
  if (loan.paidCount >= loan.totalInstallments && !(loan.partialPaidAmount > 0)) return null;
  const date = paidDate?.trim() || todayDateOnly();
  let working: Loan = { ...loan, partialPaidAmount: 0 };
  const paymentDates = [...(working.paymentDates ?? [])];
  while (paymentDates.length < working.totalInstallments) paymentDates.push(date);
  const paymentNotes = padNotes(working.paymentNotes, working.totalInstallments);

  const hasCustomAmounts = (working.paymentAmounts ?? []).length > 0;
  let paymentAmounts = [...(working.paymentAmounts ?? [])];
  if (hasCustomAmounts || (loan.partialPaidAmount ?? 0) > 0) {
    while (paymentAmounts.length < working.totalInstallments) {
      paymentAmounts.push(amountAtIndex(working, paymentAmounts.length));
    }
    paymentAmounts = paymentAmounts.slice(0, working.totalInstallments);
  }

  return {
    ...working,
    paidCount: working.totalInstallments,
    paymentDates,
    paymentNotes,
    paymentAmounts,
    partialPaidAmount: 0,
  };
}

export type LoanAmountEditInput = {
  total: number;
  totalInstallments: number;
  factoringFee?: number;
};

export type AddInstallmentInput = {
  amount: number;
  /** When set, the new installment is marked deducted on this date. */
  paidDate?: string;
  note?: string;
};

export type PostInstallmentPaymentResult =
  | { ok: true; loan: Loan; message: string | null }
  | { ok: false; error: string };

/**
 * Rebuild loan money fields after Super Admin edits total / installment count / fee.
 * Recalculates the flat installment for unpaid slots only.
 * Already-deducted paymentAmounts are preserved (e.g. mid-week $500 pulls).
 */
export function buildLoanAmountEdit(loan: Loan, input: LoanAmountEditInput): Loan | null {
  const total = Number(input.total);
  const totalInstallments = Math.floor(Number(input.totalInstallments));
  const factoringFee = Number(input.factoringFee ?? loan.factoringFee ?? 0);

  if (!Number.isFinite(total) || total < 0) return null;
  if (!Number.isFinite(totalInstallments) || totalInstallments < 1) return null;
  if (!Number.isFinite(factoringFee) || factoringFee < 0) return null;

  const effective = total + factoringFee;
  const installment = totalInstallments > 0 ? effective / totalInstallments : 0;
  const paidCount = Math.min(loan.paidCount, totalInstallments);

  const paymentDates = [...(loan.paymentDates ?? [])].slice(0, paidCount);
  const paymentNotes = padNotes(loan.paymentNotes, totalInstallments);

  // Keep deducted amounts; unpaid slots fall back to the new flat installment.
  const paymentAmounts: number[] = [];
  for (let i = 0; i < paidCount; i++) {
    paymentAmounts.push(amountAtIndex(loan, i));
  }

  // Clear partial if we clamped past the open installment.
  const partialPaidAmount =
    paidCount < loan.paidCount ? 0 : Number(loan.partialPaidAmount ?? 0) || 0;

  return {
    ...loan,
    total,
    factoringFee,
    totalInstallments,
    installment,
    paidCount,
    paymentDates,
    paymentNotes,
    paymentAmounts,
    partialPaidAmount,
  };
}

/**
 * Append / insert one installment slot.
 * - With paidDate: inserts a deducted installment after the last paid one (mid-week extras).
 * - Without paidDate: appends an unpaid slot at the end with the given amount.
 */
export function buildAddInstallment(loan: Loan, input: AddInstallmentInput): Loan | null {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return null;

  const note = (input.note ?? '').trim();
  const paidDate = input.paidDate?.trim();
  const totalInstallments = loan.totalInstallments + 1;

  if (paidDate) {
    const insertAt = loan.paidCount;
    const paymentAmounts: number[] = [];
    for (let i = 0; i < insertAt; i++) paymentAmounts.push(amountAtIndex(loan, i));
    paymentAmounts.push(amount);
    for (let i = insertAt; i < loan.totalInstallments; i++) {
      paymentAmounts.push(amountAtIndex(loan, i));
    }

    const paymentNotes = padNotes(loan.paymentNotes, loan.totalInstallments);
    paymentNotes.splice(insertAt, 0, note);
    while (paymentNotes.length < totalInstallments) paymentNotes.push('');
    paymentNotes.length = totalInstallments;

    const paymentDates = [...(loan.paymentDates ?? [])].slice(0, insertAt);
    paymentDates.push(paidDate);

    return {
      ...loan,
      totalInstallments,
      paidCount: loan.paidCount + 1,
      paymentDates,
      paymentNotes,
      paymentAmounts,
      partialPaidAmount: 0,
    };
  }

  const index = loan.totalInstallments;
  const paymentAmounts = [...(loan.paymentAmounts ?? [])];
  while (paymentAmounts.length < index) {
    paymentAmounts.push(amountAtIndex(loan, paymentAmounts.length));
  }
  paymentAmounts.push(amount);

  const paymentNotes = padNotes(loan.paymentNotes, totalInstallments);
  paymentNotes[index] = note;

  return {
    ...loan,
    totalInstallments,
    paymentNotes,
    paymentAmounts,
  };
}

/**
 * Post a payment toward the current open installment (supports partials + overpay rollover).
 *
 * - amount < remaining due → installment stays open; partialPaidAmount increases
 * - amount == remaining due → installment closes
 * - amount > remaining due → installment closes; excess applies to the next installment
 *   (auto-creates installment #N+1 when the schedule is exhausted)
 * - posting when the current slot is already fully covered → error message
 */
export function buildPostInstallmentPayment(
  loan: Loan,
  paymentAmount: number,
  note = '',
  paidDate?: string
): PostInstallmentPaymentResult {
  const amount = roundMoney(Number(paymentAmount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter a payment amount greater than 0.' };
  }

  const date = paidDate?.trim() || todayDateOnly();
  const noteTrim = note.trim();
  let working: Loan = {
    ...loan,
    paymentDates: [...(loan.paymentDates ?? [])],
    paymentNotes: [...(loan.paymentNotes ?? [])],
    paymentAmounts: [...(loan.paymentAmounts ?? [])],
    partialPaidAmount: Number(loan.partialPaidAmount ?? 0) || 0,
  };
  let remainingPayment = amount;
  const messages: string[] = [];
  let guard = 0;

  while (remainingPayment > 0.009 && guard < 50) {
    guard += 1;

    // Need an open slot — create a new week when the schedule is exhausted.
    if (working.paidCount >= working.totalInstallments) {
      const nextNum = working.totalInstallments + 1;
      working = {
        ...working,
        totalInstallments: nextNum,
        paymentNotes: padNotes(working.paymentNotes, nextNum),
      };
      messages.push(`Created installment #${nextNum}.`);
    }

    const index = working.paidCount;
    const due = amountAtIndex(working, index);
    const already = Number(working.partialPaidAmount ?? 0) || 0;
    const remainingDue = roundMoney(due - already);

    if (remainingDue <= 0.009) {
      return {
        ok: false,
        error: `Installment #${index + 1} is already fully paid. Nothing left to post on this installment.`,
      };
    }

    // Partial — leave installment open.
    if (remainingPayment + 0.009 < remainingDue) {
      const posted = remainingPayment;
      const newPartial = roundMoney(already + posted);
      const paymentNotes = padNotes(working.paymentNotes, working.totalInstallments);
      const partialLine = `Partial ${fmtMoney(posted)} on ${date}`;
      paymentNotes[index] = noteTrim
        ? paymentNotes[index]
          ? `${paymentNotes[index]}; ${partialLine} — ${noteTrim}`
          : `${partialLine} — ${noteTrim}`
        : paymentNotes[index]
          ? `${paymentNotes[index]}; ${partialLine}`
          : partialLine;

      working = {
        ...working,
        partialPaidAmount: newPartial,
        paymentNotes,
      };
      messages.push(
        `Posted ${fmtMoney(posted)} toward installment #${index + 1}. ` +
          `${fmtMoney(roundMoney(due - newPartial))} remaining — installment stays open.`
      );
      remainingPayment = 0;
      break;
    }

    // Close this installment (payment covers what was left).
    const applied = remainingDue;
    remainingPayment = roundMoney(remainingPayment - applied);

    const paymentDates = [...(working.paymentDates ?? [])];
    paymentDates.push(date);

    const paymentNotes = padNotes(working.paymentNotes, Math.max(working.totalInstallments, index + 1));
    if (noteTrim && !messages.length) {
      paymentNotes[index] = already > 0
        ? `${paymentNotes[index] ? `${paymentNotes[index]}; ` : ''}Closed — ${noteTrim}`
        : noteTrim;
    } else if (already > 0) {
      paymentNotes[index] = paymentNotes[index]
        ? `${paymentNotes[index]}; Closed`
        : `Closed after partials totaling ${fmtMoney(due)}`;
    }

    const paymentAmounts = withRecordedAmount(working, index, due);

    working = {
      ...working,
      paidCount: working.paidCount + 1,
      paymentDates,
      paymentNotes,
      paymentAmounts,
      partialPaidAmount: 0,
    };

    if (remainingPayment > 0.009) {
      messages.push(
        `Installment #${index + 1} closed (${fmtMoney(applied)}). ` +
          `${fmtMoney(remainingPayment)} applied to the next installment.`
      );
    } else if (already > 0) {
      messages.push(`Installment #${index + 1} closed (final ${fmtMoney(applied)}).`);
    }
  }

  return {
    ok: true,
    loan: working,
    message: messages.length > 0 ? messages.join(' ') : null,
  };
}
