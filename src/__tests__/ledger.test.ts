import type { LedgerTransaction } from '../api/types';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import { tEn, tHi } from '../testUtils/i18nFixture';
import {
  ALL_OPTION,
  LEDGER_DIRECTIONS,
  LEDGER_DOCUMENT_TYPES,
  LEDGER_LABEL_KEYS,
  LEDGER_PAGE_SIZE,
  LEDGER_SOURCE_TYPES,
  LEDGER_STATUSES,
  MANUAL_CATEGORIES,
  PAYMENT_METHODS,
  appendPage,
  buildEntriesFilter,
  buildLedgerQuery,
  categoryFilterOf,
  categoryOptions,
  customRangeError,
  displayNumber,
  entriesView,
  entryChips,
  entryLabel,
  financialYearOf,
  formatLedgerDate,
  formatRupees,
  formatSignedRupees,
  isValidReversalReason,
  isZeroBucket,
  linkedDocumentText,
  methodBucket,
  methodFilterOf,
  methodOptions,
  normalizeReceiptQuery,
  numberLabelKey,
  paymentMethodLabel,
  periodRange,
  reverseConfirmText,
  reverseHint,
  shiftIsoDate,
  signedAmount,
  summaryFilterOf,
} from '../utils/ledger';

function tx(overrides: Partial<LedgerTransaction> = {}): LedgerTransaction {
  return {
    id: 'tx-1',
    schoolId: 'school-1',
    direction: 'INFLOW',
    sourceType: 'MANUAL',
    sourceId: 'src-1',
    amount: 5000,
    paymentMethod: 'CASH',
    paymentReference: null,
    transactionDate: '2026-10-11',
    receiptNumber: 'GUR/2026-27/RCPT/000012',
    status: 'COMPLETED',
    fundAccountId: null,
    notes: 'Donation from alumni',
    createdAt: '2026-10-11T05:00:00Z',
    updatedAt: '2026-10-11T05:00:00Z',
    voucherNumber: null,
    manualCategory: 'DONATION',
    documentType: 'MANUAL_ENTRY',
    documentId: null,
    reversed: false,
    reversedAt: null,
    reversedBy: null,
    reversalReason: null,
    reversalTransactionId: null,
    reversalOfId: null,
    reversible: true,
    ...overrides,
  };
}

type Tree = { [key: string]: string | Tree };
function hasKey(tree: Tree, key: string): boolean {
  let node: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (!node || typeof node === 'string') return false;
    node = node[part];
  }
  return typeof node === 'string' && node.trim() !== '';
}

describe('enum lists', () => {
  it('match the API contract', () => {
    expect(LEDGER_SOURCE_TYPES).toEqual([
      'FEE_PAYMENT',
      'EVENT_COLLECTION',
      'SPONSORSHIP',
      'SALARY',
      'VENDOR_PAYMENT',
      'MANUAL',
    ]);
    expect(MANUAL_CATEGORIES).toEqual([
      'OPENING_BALANCE',
      'DONATION',
      'OTHER_INCOME',
      'BANK_INTEREST',
      'PETTY_EXPENSE',
      'BANK_CHARGES',
      'OTHER_EXPENSE',
    ]);
    expect(LEDGER_DOCUMENT_TYPES).toEqual([
      'FEE_PAYMENT',
      'PAYROLL_LINE',
      'INFRA_EXPENSE_REQUEST',
      'EVENT_EXPENSE_REQUEST',
      'SPONSORSHIP_PAYMENT',
      'EVENT_COLLECTION_PAYMENT',
      'MANUAL_ENTRY',
    ]);
    expect(PAYMENT_METHODS).toEqual(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']);
    expect(LEDGER_DIRECTIONS).toEqual(['INFLOW', 'OUTFLOW']);
    expect(LEDGER_STATUSES).toEqual(['PENDING', 'COMPLETED', 'REVERSED']);
    expect(LEDGER_PAGE_SIZE).toBe(50);
  });

  it('has an English and a Hindi label for every enum value and every key the helpers hand out', () => {
    const keys = [
      ...LEDGER_LABEL_KEYS,
      'ledger.method.none',
      'ledger.entry.manualWithCategory',
      'ledger.entry.reversed',
      'ledger.entry.reversal',
      'ledger.entries.all',
      'ledger.entries.rangeOrder',
      'ledger.detail.hint.feePayment',
      'ledger.detail.hint.salaryVendor',
      'ledger.detail.receiptNumber',
      'ledger.detail.voucherNumber',
      'ledger.detail.notLinked',
      'ledger.detail.linkedValue',
      'ledger.reverse.body',
      'ledger.reverse.receiptCancelled',
      'ledger.reverse.voucherCancelled',
      'ledger.reverse.cannotUndo',
      ...Array.from({ length: 12 }, (_, i) => `ledger.monthsShort.${i + 1}`),
    ];
    // One per value of each of the six enums, plus the six plural filter labels.
    expect(LEDGER_LABEL_KEYS).toHaveLength(6 + 7 + 7 + 4 + 2 + 3 + 6);
    expect(keys.filter((k) => !hasKey(en as Tree, k))).toEqual([]);
    expect(keys.filter((k) => !hasKey(hi as Tree, k))).toEqual([]);
  });

  it('labels the values in words, a new value as sent', () => {
    expect(entryLabel(tx({ sourceType: 'FEE_PAYMENT', manualCategory: null }), tEn)).toBe('Fee payment');
    expect(entryLabel(tx({ sourceType: 'MANUAL', manualCategory: 'DONATION' }), tEn)).toBe('Manual entry · Donation');
    expect(entryLabel(tx({ sourceType: 'MANUAL', manualCategory: null }), tEn)).toBe('Manual entry');
    expect(entryLabel(tx({ sourceType: 'REFUND' as LedgerTransaction['sourceType'] }), tEn)).toBe('REFUND');
    expect(entryLabel(tx({ sourceType: 'SALARY' }), tHi)).toBe(hi.ledger.sourceType.SALARY);
    expect(paymentMethodLabel('BANK_TRANSFER', tEn)).toBe('Bank transfer');
    expect(paymentMethodLabel(null, tEn)).toBe('Not recorded');
  });
});

describe('buildLedgerQuery / summaryFilterOf', () => {
  it('is empty with nothing set', () => {
    expect(buildLedgerQuery({})).toBe('');
    expect(buildLedgerQuery({ from: '', to: '   ', sourceType: undefined })).toBe('');
  });

  it('leaves out empty values and keeps a fixed order', () => {
    expect(
      buildLedgerQuery({ paymentMethod: 'CASH', from: '2026-10-01', to: '2026-10-11', manualCategory: undefined }, 0, 50)
    ).toBe('?from=2026-10-01&to=2026-10-11&paymentMethod=CASH&page=0&size=50');
    expect(buildLedgerQuery({ academicYear: '2026-27', sourceType: 'MANUAL', manualCategory: 'DONATION' })).toBe(
      '?academicYear=2026-27&sourceType=MANUAL&manualCategory=DONATION'
    );
  });

  it('encodes values and clamps a negative page to 0', () => {
    expect(buildLedgerQuery({ documentId: ' a b&c/d ' }, -3, 20)).toBe('?documentId=a%20b%26c%2Fd&page=0&size=20');
    expect(buildLedgerQuery({ documentType: 'FEE_PAYMENT', direction: 'OUTFLOW' }, 2)).toBe(
      '?direction=OUTFLOW&documentType=FEE_PAYMENT&page=2'
    );
  });

  it('keeps only the filters the summary understands', () => {
    expect(
      summaryFilterOf({
        from: '2026-10-01',
        to: '2026-10-11',
        sourceType: 'MANUAL',
        manualCategory: 'DONATION',
        paymentMethod: 'UPI',
        direction: 'INFLOW',
        documentType: 'MANUAL_ENTRY',
        documentId: 'x',
      })
    ).toEqual({ from: '2026-10-01', to: '2026-10-11', sourceType: 'MANUAL', manualCategory: 'DONATION', paymentMethod: 'UPI' });
    expect(summaryFilterOf({ academicYear: '2026-27' })).toEqual({ academicYear: '2026-27' });
  });
});

describe('financialYearOf / periodRange', () => {
  it('switches year on 1 April', () => {
    expect(financialYearOf('2026-03-31')).toBe('2025-26');
    expect(financialYearOf('2026-04-01')).toBe('2026-27');
    expect(financialYearOf('2027-01-15')).toBe('2026-27');
    expect(financialYearOf('2099-04-01')).toBe('2099-00');
    expect(financialYearOf('2009-12-31')).toBe('2009-10');
  });

  it('works out periods from today in IST', () => {
    // 20:00Z on 10 Oct is already 11 Oct in India.
    const now = new Date('2026-10-10T20:00:00Z');
    expect(periodRange('thisMonth', now)).toEqual({ from: '2026-10-01', to: '2026-10-11' });
    expect(periodRange('thisYear', now)).toEqual({ academicYear: '2026-27' });
    expect(periodRange('lastYear', now)).toEqual({ academicYear: '2025-26' });
  });

  it('starts the new year at IST midnight on 1 April', () => {
    const now = new Date('2026-03-31T18:30:00Z');
    expect(periodRange('thisMonth', now)).toEqual({ from: '2026-04-01', to: '2026-04-01' });
    expect(periodRange('thisYear', now)).toEqual({ academicYear: '2026-27' });
    expect(periodRange('thisYear', new Date('2026-03-31T18:29:59Z'))).toEqual({ academicYear: '2025-26' });
    expect(periodRange('lastYear', new Date('2000-01-05T00:00:00Z'))).toEqual({ academicYear: '1998-99' });
  });
});

describe('filters', () => {
  it('offers All, each source, then each manual category', () => {
    const options = categoryOptions(tEn);
    expect(options.map((o) => o.label)).toEqual([
      'All',
      'Fees',
      'Salary',
      'Vendor payments',
      'Sponsorships',
      'Event collections',
      'Manual entries (any)',
      'Manual entry · Opening balance',
      'Manual entry · Donation',
      'Manual entry · Other income',
      'Manual entry · Bank interest',
      'Manual entry · Petty expense',
      'Manual entry · Bank charges',
      'Manual entry · Other expense',
    ]);
    expect(options[0].value).toBe(ALL_OPTION);
    expect(methodOptions(tEn).map((o) => o.label)).toEqual(['All', 'Cash', 'UPI', 'Bank transfer', 'Cheque']);
  });

  it('maps each option back to a filter', () => {
    for (const option of categoryOptions(tEn)) {
      const filter = categoryFilterOf(option.value);
      if (option.value === ALL_OPTION) expect(filter).toEqual({});
      else expect(filter.sourceType).toBeDefined();
    }
    expect(categoryFilterOf('source:SALARY')).toEqual({ sourceType: 'SALARY' });
    expect(categoryFilterOf('source:MANUAL')).toEqual({ sourceType: 'MANUAL' });
    expect(categoryFilterOf('manual:BANK_CHARGES')).toEqual({ sourceType: 'MANUAL', manualCategory: 'BANK_CHARGES' });
    expect(categoryFilterOf('source:BOGUS')).toEqual({});
    expect(categoryFilterOf('manual:SALARY')).toEqual({});
    expect(methodFilterOf('UPI')).toEqual({ paymentMethod: 'UPI' });
    expect(methodFilterOf(ALL_OPTION)).toEqual({});
    expect(methodFilterOf('CARD')).toEqual({});
  });

  it('builds the Entries tab filter from the period, category and method', () => {
    const now = new Date('2026-10-10T20:00:00Z');
    const base = { customFrom: '2026-09-01', customTo: '2026-09-30', category: ALL_OPTION, method: ALL_OPTION };
    expect(buildEntriesFilter({ ...base, period: 'thisMonth' }, now)).toEqual({ from: '2026-10-01', to: '2026-10-11' });
    expect(buildEntriesFilter({ ...base, period: 'thisYear', category: 'manual:DONATION', method: 'CASH' }, now)).toEqual({
      academicYear: '2026-27',
      sourceType: 'MANUAL',
      manualCategory: 'DONATION',
      paymentMethod: 'CASH',
    });
    expect(buildEntriesFilter({ ...base, period: 'custom', category: 'source:FEE_PAYMENT' }, now)).toEqual({
      from: '2026-09-01',
      to: '2026-09-30',
      sourceType: 'FEE_PAYMENT',
    });
    expect(buildEntriesFilter({ ...base, period: 'custom', customFrom: '', customTo: '' }, now)).toEqual({});
  });

  it('flags a custom range that ends before it starts', () => {
    expect(customRangeError('2026-10-02', '2026-10-01')).toBe('ledger.entries.rangeOrder');
    expect(customRangeError('2026-10-01', '2026-10-01')).toBeNull();
    expect(customRangeError('2026-09-30', '2026-10-01')).toBeNull();
    expect(customRangeError('', '2026-10-01')).toBeNull();
  });
});

describe('amounts and numbers', () => {
  it('splits methods into cash and bank as the server does', () => {
    expect(methodBucket('CASH')).toBe('cash');
    expect(methodBucket('UPI')).toBe('bank');
    expect(methodBucket('BANK_TRANSFER')).toBe('bank');
    expect(methodBucket('CHEQUE')).toBe('bank');
    expect(methodBucket(null)).toBe('unspecified');
    expect(methodBucket(undefined)).toBe('unspecified');
  });

  it('shows the receipt number, else the voucher number', () => {
    expect(displayNumber({ receiptNumber: 'R1', voucherNumber: null })).toBe('R1');
    expect(displayNumber({ receiptNumber: null, voucherNumber: 'PV1' })).toBe('PV1');
    expect(displayNumber({ receiptNumber: 'R1', voucherNumber: 'PV1' })).toBe('R1');
    expect(displayNumber({ receiptNumber: null, voucherNumber: null })).toBeNull();
  });

  it('calls the number a receipt for money in and a voucher for money out', () => {
    const label = (receiptNumber: string | null, voucherNumber: string | null, direction: 'INFLOW' | 'OUTFLOW') =>
      numberLabelKey({ receiptNumber, voucherNumber, direction });
    expect(label('R1', null, 'INFLOW')).toBe('ledger.detail.receiptNumber');
    expect(label(null, 'PV1', 'OUTFLOW')).toBe('ledger.detail.voucherNumber');
    // No number (an old row, or a reversal row): by direction.
    expect(label(null, null, 'INFLOW')).toBe('ledger.detail.receiptNumber');
    expect(label(null, null, 'OUTFLOW')).toBe('ledger.detail.voucherNumber');
  });

  it('signs money out as negative', () => {
    expect(signedAmount({ direction: 'INFLOW', amount: 5000 })).toBe(5000);
    expect(signedAmount({ direction: 'OUTFLOW', amount: 2000 })).toBe(-2000);
  });

  it('formats rupees with Indian grouping and two decimals', () => {
    expect(formatRupees(5000)).toBe('₹5,000.00');
    expect(formatRupees(999)).toBe('₹999.00');
    expect(formatRupees(100000)).toBe('₹1,00,000.00');
    expect(formatRupees(1234567.5)).toBe('₹12,34,567.50');
    expect(formatRupees(0.1 + 0.2)).toBe('₹0.30');
    expect(formatRupees(0)).toBe('₹0.00');
    expect(formatRupees(-2000)).toBe('−₹2,000.00');
    expect(formatRupees(-0.001)).toBe('₹0.00');
    expect(formatRupees(Number.NaN)).toBe('₹0.00');
    expect(formatSignedRupees(5000)).toBe('+₹5,000.00');
    expect(formatSignedRupees(-2000)).toBe('−₹2,000.00');
    expect(formatSignedRupees(0)).toBe('₹0.00');
  });

  it('shows totals and rows only once they were loaded for the filter on screen', () => {
    const view = (over: Partial<Parameters<typeof entriesView>[0]> = {}) =>
      entriesView({ filterKey: '?from=b', loadedKey: '?from=b', rangeInvalid: false, failed: false, ...over });
    // Loaded for this filter: shown, whichever tab was open when the load finished.
    expect(view()).toBe('ready');
    // First visit to the tab: nothing loaded yet, so a spinner rather than "No entries match".
    expect(view({ loadedKey: null })).toBe('loading');
    // A new period, category or method: the old filter's totals are not shown under the new chips.
    expect(view({ loadedKey: '?from=a' })).toBe('loading');
    expect(view({ failed: true })).toBe('error');
    expect(view({ failed: true, loadedKey: null })).toBe('error');
    expect(view({ rangeInvalid: true })).toBe('invalidRange');
    expect(view({ rangeInvalid: true, failed: true })).toBe('invalidRange');
  });

  it('adds a page without repeating rows already shown', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };
    expect(appendPage([a, b], [b, c])).toEqual([a, b, c]);
    expect(appendPage([], [a])).toEqual([a]);
  });
});

describe('dates', () => {
  it('moves a day across month, year and leap-day ends', () => {
    expect(shiftIsoDate('2026-10-11', -1)).toBe('2026-10-10');
    expect(shiftIsoDate('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftIsoDate('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftIsoDate('2028-02-28', 1)).toBe('2028-02-29');
    expect(shiftIsoDate('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('formats a date as "d MMM", with the year when asked, the month in the app language', () => {
    expect(formatLedgerDate('2026-10-11', tEn)).toBe('11 Oct');
    expect(formatLedgerDate('2026-04-01', tEn, true)).toBe('1 Apr 2026');
    expect(formatLedgerDate('2026-01-05', tEn)).toBe('5 Jan');
    expect(formatLedgerDate('2026-12-31', tEn)).toBe('31 Dec');
    expect(formatLedgerDate('2026-10-11', tHi, true)).toBe(`11 ${hi.ledger.monthsShort['10']} 2026`);
    expect(formatLedgerDate('2026-10-11', tHi)).not.toMatch(/Oct/);
    expect(formatLedgerDate('', tEn)).toBe('');
    expect(formatLedgerDate(null, tEn)).toBe('');
    expect(formatLedgerDate('2026-13-01', tEn)).toBe('');
    expect(formatLedgerDate('2026-00-01', tEn)).toBe('');
  });

  it('treats an all-zero bucket as empty', () => {
    expect(isZeroBucket({ opening: 0, inflow: 0, outflow: 0, closing: 0 })).toBe(true);
    expect(isZeroBucket({ opening: 10, inflow: 0, outflow: 0, closing: 10 })).toBe(false);
    expect(isZeroBucket({ opening: 0, inflow: 5, outflow: 5, closing: 0 })).toBe(false);
    expect(isZeroBucket(null)).toBe(true);
  });
});

describe('receipts and reversal', () => {
  it('normalises the find box', () => {
    expect(normalizeReceiptQuery('  gur/2026-27/rcpt/000012 ')).toBe('GUR/2026-27/RCPT/000012');
    expect(normalizeReceiptQuery('   ')).toBeNull();
  });

  it('wants a reason of 3 to 500 characters once trimmed', () => {
    expect(isValidReversalReason('')).toBe(false);
    expect(isValidReversalReason('  ab  ')).toBe(false);
    expect(isValidReversalReason('abc')).toBe(true);
    expect(isValidReversalReason('x'.repeat(500))).toBe(true);
    expect(isValidReversalReason(`  ${'x'.repeat(500)}  `)).toBe(true);
    expect(isValidReversalReason('x'.repeat(501))).toBe(false);
  });

  it('explains why there is no Reverse button, in every case', () => {
    expect(reverseHint(tx({ reversible: true }))).toBeNull();
    expect(reverseHint(tx({ reversible: false, reversed: true }))).toBeNull();
    expect(reverseHint(tx({ reversible: false, reversalOfId: 'orig-1', sourceType: 'FEE_PAYMENT' }))).toBeNull();
    expect(reverseHint(tx({ reversible: false, reversed: true, sourceType: 'FEE_PAYMENT' }))).toBeNull();
    expect(reverseHint(tx({ reversible: false, sourceType: 'FEE_PAYMENT' }))).toBe('ledger.detail.hint.feePayment');
    expect(reverseHint(tx({ reversible: false, sourceType: 'SALARY' }))).toBe('ledger.detail.hint.salaryVendor');
    expect(reverseHint(tx({ reversible: false, sourceType: 'VENDOR_PAYMENT' }))).toBe('ledger.detail.hint.salaryVendor');
    expect(reverseHint(tx({ reversible: false, sourceType: 'MANUAL', status: 'PENDING' }))).toBeNull();
    expect(reverseHint(tx({ reversible: false, sourceType: 'EVENT_COLLECTION' }))).toBeNull();
    expect(reverseHint(tx({ reversible: false, sourceType: 'SPONSORSHIP' }))).toBeNull();
  });

  it('chips a reversed entry, a reversal entry and a pending one', () => {
    expect(entryChips(tx())).toEqual([]);
    expect(entryChips(tx({ reversed: true }))).toEqual([{ key: 'ledger.entry.reversed', variant: 'warning' }]);
    expect(entryChips(tx({ reversalOfId: 'orig-1' }))).toEqual([{ key: 'ledger.entry.reversal', variant: 'neutral' }]);
    expect(entryChips(tx({ status: 'PENDING' }))).toEqual([{ key: 'ledger.status.PENDING', variant: 'neutral' }]);
  });

  it('says what the entry is linked to', () => {
    expect(linkedDocumentText(tx({ documentType: 'FEE_PAYMENT', documentId: '1a2b3c4d-5e6f-7a8b' }), tEn)).toBe(
      'Fee payment · 1a2b3c4d'
    );
    expect(linkedDocumentText(tx({ documentType: 'MANUAL_ENTRY', documentId: null }), tEn)).toBe('Manual entry');
    expect(linkedDocumentText(tx({ documentType: null, documentId: null }), tEn)).toBe(
      'Not linked (recorded before this update)'
    );
  });

  it('warns what a reversal does before it happens', () => {
    expect(reverseConfirmText(tx({ amount: 5000 }), tEn)).toBe(
      "This adds a reversal entry of ₹5,000.00 dated today. Receipt GUR/2026-27/RCPT/000012 will show as cancelled. This can't be undone."
    );
    expect(
      reverseConfirmText(tx({ amount: 250.5, receiptNumber: null, voucherNumber: 'GUR/2026-27/PV/000003' }), tEn)
    ).toBe(
      "This adds a reversal entry of ₹250.50 dated today. Voucher GUR/2026-27/PV/000003 will show as cancelled. This can't be undone."
    );
    expect(reverseConfirmText(tx({ amount: 100, receiptNumber: null, voucherNumber: null }), tEn)).toBe(
      "This adds a reversal entry of ₹100.00 dated today. This can't be undone."
    );
  });
});
