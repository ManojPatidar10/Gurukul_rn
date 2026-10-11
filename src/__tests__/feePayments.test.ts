import { ApiError, NetworkError } from '../api/client';
import {
  addDays,
  duplicateReferenceInfo,
  FEE_PAYMENT_METHODS,
  feeReceiptFileName,
  formatPaymentDate,
  normalizeReference,
  paymentDateBounds,
  paymentMethodLabelKey,
  referenceRequired,
  reversalTypesFor,
  validateRecordPayment,
  validateReversal,
  type RecordPaymentForm,
  type ReversalForm,
} from '../utils/feePayments';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import { tEn, tHi } from '../testUtils/i18nFixture';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

const TODAY = '2026-10-11';

/** True when `key` (e.g. 'fees.recordPayment.errors.amountInvalid') is in en.json. */
function hasKey(key: string): boolean {
  let node: unknown = en;
  for (const part of key.split('.')) {
    if (!node || typeof node !== 'object' || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

describe('payment methods and references', () => {
  it('offers the 4 backend methods, each with a label', () => {
    expect(FEE_PAYMENT_METHODS).toEqual(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']);
    for (const method of FEE_PAYMENT_METHODS) expect(hasKey(paymentMethodLabelKey(method)!)).toBe(true);
    expect(paymentMethodLabelKey('CARD')).toBeNull();
    expect(paymentMethodLabelKey(null)).toBeNull();
  });

  it('needs a reference for everything but cash', () => {
    expect(referenceRequired('CASH')).toBe(false);
    expect(referenceRequired('UPI')).toBe(true);
    expect(referenceRequired('BANK_TRANSFER')).toBe(true);
    expect(referenceRequired('CHEQUE')).toBe(true);
  });

  it('normalises a reference the way the server stores it', () => {
    expect(normalizeReference(' utr 1234 5 ')).toBe('UTR12345');
    expect(normalizeReference('n28\t103 12345')).toBe('N2810312345');
    expect(normalizeReference('   ')).toBeNull();
    expect(normalizeReference(undefined)).toBeNull();
  });
});

describe('payment dates', () => {
  it('moves calendar dates across months and years', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('allows today back to 400 days ago', () => {
    expect(paymentDateBounds(TODAY)).toEqual({ min: '2025-09-06', max: TODAY });
  });
});

describe('validateRecordPayment', () => {
  const form = (overrides: Partial<RecordPaymentForm> = {}): RecordPaymentForm => ({
    amount: '5,000',
    method: 'CASH',
    reference: '',
    date: TODAY,
    ...overrides,
  });

  it('accepts a cash payment with no reference and returns the parsed amount', () => {
    expect(validateRecordPayment(form(), 9000, TODAY)).toEqual({ amount: 5000, errors: {}, valid: true });
  });

  it('accepts exactly the remaining due, paise included', () => {
    expect(validateRecordPayment(form({ amount: '9000.50' }), 9000.5, TODAY).valid).toBe(true);
  });

  it('refuses an unreadable, zero or too-large amount', () => {
    expect(validateRecordPayment(form({ amount: '99.999' }), 9000, TODAY).errors.amount).toBe(
      'fees.recordPayment.errors.amountInvalid'
    );
    expect(validateRecordPayment(form({ amount: '0' }), 9000, TODAY).errors.amount).toBe(
      'fees.recordPayment.errors.amountTooSmall'
    );
    expect(validateRecordPayment(form({ amount: '9000.01' }), 9000, TODAY).errors.amount).toBe(
      'fees.recordPayment.errors.amountTooLarge'
    );
  });

  it('needs a reference for UPI, bank transfer and cheque', () => {
    const result = validateRecordPayment(form({ method: 'UPI', reference: '  ' }), 9000, TODAY);
    expect(result.valid).toBe(false);
    expect(result.errors.reference).toBe('fees.recordPayment.errors.referenceRequired');
    expect(validateRecordPayment(form({ method: 'CHEQUE', reference: '004512' }), 9000, TODAY).valid).toBe(true);
  });

  it('refuses a future date or one more than 400 days back', () => {
    expect(validateRecordPayment(form({ date: '2026-10-12' }), 9000, TODAY).errors.date).toBe(
      'fees.recordPayment.errors.dateFuture'
    );
    expect(validateRecordPayment(form({ date: addDays(TODAY, -401) }), 9000, TODAY).errors.date).toBe(
      'fees.recordPayment.errors.dateTooOld'
    );
    expect(validateRecordPayment(form({ date: addDays(TODAY, -400) }), 9000, TODAY).valid).toBe(true);
    expect(validateRecordPayment(form({ date: '' }), 9000, TODAY).valid).toBe(true);
  });

  it('only returns error keys that exist', () => {
    const result = validateRecordPayment(form({ amount: 'x', method: 'UPI', date: '2027-01-01' }), 9000, TODAY);
    for (const key of Object.values(result.errors)) expect(hasKey(key!)).toBe(true);
  });
});

describe('reversals', () => {
  it("doesn't offer BOUNCED for cash", () => {
    expect(reversalTypesFor('CASH')).toEqual(['CORRECTION', 'REFUND']);
    expect(reversalTypesFor('CHEQUE')).toEqual(['CORRECTION', 'BOUNCED', 'REFUND']);
    expect(reversalTypesFor('UPI')).toContain('BOUNCED');
  });

  const form = (overrides: Partial<ReversalForm> = {}): ReversalForm => ({
    type: 'CORRECTION',
    reason: 'Entered against the wrong student',
    refundMethod: null,
    refundReference: '',
    ...overrides,
  });

  it('accepts a correction with a 10-character reason', () => {
    expect(validateReversal(form({ reason: '  0123456789  ' }))).toEqual({ errors: {}, valid: true });
  });

  it('needs a type and a reason of at least 10 characters', () => {
    const result = validateReversal(form({ type: null, reason: ' 123456789 ' }));
    expect(result.errors).toEqual({
      type: 'fees.reversePayment.errors.typeRequired',
      reason: 'fees.reversePayment.errors.reasonTooShort',
    });
  });

  it('needs the refund method and reference for a refund, but not for a bounce', () => {
    expect(validateReversal(form({ type: 'REFUND' })).errors).toEqual({
      refundMethod: 'fees.reversePayment.errors.refundMethodRequired',
      refundReference: 'fees.reversePayment.errors.refundReferenceRequired',
    });
    expect(validateReversal(form({ type: 'BOUNCED' })).valid).toBe(true);
    expect(validateReversal(form({ type: 'REFUND', refundMethod: 'CASH', refundReference: 'v-17' })).valid).toBe(true);
  });

  it('asks for no refund date: the server enters a refund on the day it is reversed', () => {
    const refund = form({ type: 'REFUND', refundMethod: 'BANK_TRANSFER', refundReference: 'N28' });
    expect(refund).not.toHaveProperty('refundDate');
    expect(validateReversal(refund)).toEqual({ errors: {}, valid: true });
  });

  it('only returns error keys that exist', () => {
    const results = [
      validateReversal(form({ type: null, reason: '' })),
      validateReversal(form({ type: 'REFUND', reason: 'short' })),
    ];
    for (const { errors } of results) for (const key of Object.values(errors)) expect(hasKey(key!)).toBe(true);
  });
});

describe('duplicateReferenceInfo', () => {
  const data = {
    existingPaymentId: 'p-1',
    existingReceiptNumber: 'GUR/2026-27/RCPT/000012',
    existingStudentName: 'Asha Verma',
    existingAmount: 5000,
    existingTransactionDate: '2026-10-05',
  };

  it('reads the existing payment from a DUPLICATE_REFERENCE error', () => {
    const error = new ApiError('Reference UTR1 is already on receipt …', 409, 'DUPLICATE_REFERENCE', data);
    expect(duplicateReferenceInfo(error)).toEqual(data);
  });

  it('is null for any other error', () => {
    expect(duplicateReferenceInfo(new ApiError('This payment was already reversed.', 409, 'ALREADY_REVERSED', {}))).toBeNull();
    expect(duplicateReferenceInfo(new ApiError('Bad request', 400))).toBeNull();
    expect(duplicateReferenceInfo(new NetworkError('timeout'))).toBeNull();
    expect(duplicateReferenceInfo(undefined)).toBeNull();
    expect(duplicateReferenceInfo(new ApiError('x', 409, 'DUPLICATE_REFERENCE'))).toBeNull();
  });
});

describe('in-flight messages', () => {
  it('has the bill refresh notice, and the in-flight hold messages, in en.json', () => {
    expect(hasKey('fees.paymentHistory.billRefreshError')).toBe(true);
    expect(hasKey('fees.recordPayment.stillSaving')).toBe(true);
    expect(hasKey('fees.reversePayment.stillReversing')).toBe(true);
  });
});

describe('feeReceiptFileName', () => {
  it('slugs the receipt number like the server', () => {
    expect(feeReceiptFileName({ id: 'abcdef12-3456', receiptNumber: 'GUR/2026-27/RCPT/000012' })).toBe(
      'fee-receipt-gur-2026-27-rcpt-000012.pdf'
    );
  });

  it("falls back to the id's first 8 characters", () => {
    expect(feeReceiptFileName({ id: 'abcdef12-3456-7890', receiptNumber: null })).toBe('fee-receipt-abcdef12.pdf');
  });
});

describe('formatPaymentDate', () => {
  it("shows a payment's date like every other fee date: the month in the app language, whatever the phone's", () => {
    expect(formatPaymentDate('2026-10-05', tEn)).toBe('5 Oct 2026');
    expect(formatPaymentDate('2026-10-05', tHi)).toBe(`5 ${hi.fees.bill.monthsShort['10']} 2026`);
  });

  it("shows '—' for no date, and anything else as sent", () => {
    expect(formatPaymentDate(null, tEn)).toBe('—');
    expect(formatPaymentDate(undefined, tEn)).toBe('—');
    expect(formatPaymentDate('', tEn)).toBe('—');
    expect(formatPaymentDate('soon', tEn)).toBe('soon');
  });
});
