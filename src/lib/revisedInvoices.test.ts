import { describe, expect, it } from 'vitest';
import { findFamily, nextRevisionNumber, revisionSuffix, stripRevision } from '@/lib/revisedInvoices';

const inv = (invoiceNo: string, debtorKey = 1) => ({ invoiceNo, debtorKey });

describe('revised invoice numbering', () => {
  it('strips a revision mark', () => {
    expect(stripRevision('IN-015849R')).toBe('IN-015849');
    expect(stripRevision('1234R2')).toBe('1234');
    expect(stripRevision('1234')).toBe('1234');
  });

  it('names the first revision R and later ones R2, R3', () => {
    expect(revisionSuffix(1)).toBe('R');
    expect(revisionSuffix(2)).toBe('R2');
    expect(revisionSuffix(3)).toBe('R3');
  });

  it('finds the original and its revision from either one', () => {
    const results = [inv('IN-015849'), inv('IN-015849R')];
    for (const picked of results) {
      const { base, members, original } = findFamily(results, picked);
      expect(base).toBe('IN-015849');
      expect(members.map((m) => m.revision)).toEqual([0, 1]);
      expect(original?.invoiceNo).toBe('IN-015849');
      expect(nextRevisionNumber(members)).toBe(2);
    }
  });

  it('numbers the next revision after the highest one', () => {
    const results = [inv('77'), inv('77R'), inv('77R2')];
    const { members } = findFamily(results, inv('77R2'));
    expect(nextRevisionNumber(members)).toBe(3);
  });

  it('ignores other brokers and unrelated invoices', () => {
    const results = [inv('55'), inv('55R', 2), inv('550'), inv('55R9X')];
    const { members } = findFamily(results, inv('55'));
    expect(members.map((m) => m.invoiceNo)).toEqual(['55']);
  });

  it('keeps an invoice that really ends in R as its own base', () => {
    const results = [inv('ABCR')];
    const { base, members } = findFamily(results, inv('ABCR'));
    expect(base).toBe('ABCR');
    expect(nextRevisionNumber(members)).toBe(1);
  });
});
