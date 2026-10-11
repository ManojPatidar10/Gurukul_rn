import type { PaymentAttemptStatus } from '../api/types';
import {
  canPayAgainAfter,
  earlierAttemptWarning,
  findAttemptByRef,
  paymentResultKind,
} from '../utils/feePaymentAttempts';

describe('paymentResultKind', () => {
  it('shows a self-reported success as reported, not confirmed', () => {
    expect(paymentResultKind('RESPONSE_SUCCESS')).toBe('reportedSuccess');
  });

  it('shows a VERIFIED attempt (a success report on a payment the school already confirmed) as confirmed', () => {
    expect(paymentResultKind('VERIFIED')).toBe('confirmed');
  });

  it('maps the other reported outcomes to their own result', () => {
    expect(paymentResultKind('PENDING')).toBe('pending');
    expect(paymentResultKind('FAILED')).toBe('failed');
    expect(paymentResultKind('CANCELLED')).toBe('cancelled');
    expect(paymentResultKind('UNKNOWN')).toBe('unknown');
  });

  it('treats INITIATED, which a report never leaves behind, as unknown', () => {
    expect(paymentResultKind('INITIATED')).toBe('unknown');
  });
});

describe('canPayAgainAfter', () => {
  it('offers a fresh payment only after a failed or cancelled one', () => {
    expect(canPayAgainAfter('failed')).toBe(true);
    expect(canPayAgainAfter('cancelled')).toBe(true);
  });

  it('offers Done after a reported or confirmed success, a pending payment or an unclear one', () => {
    expect(canPayAgainAfter('reportedSuccess')).toBe(false);
    expect(canPayAgainAfter('confirmed')).toBe(false);
    expect(canPayAgainAfter('pending')).toBe(false);
    expect(canPayAgainAfter('unknown')).toBe(false);
  });
});

describe('earlierAttemptWarning', () => {
  const attempts = (...statuses: PaymentAttemptStatus[]) => statuses.map((status) => ({ status }));

  it('warns about a reported success the school has not confirmed, which no longer marks the fee paid', () => {
    expect(earlierAttemptWarning(attempts('RESPONSE_SUCCESS'))).toBe('reportedSuccess');
  });

  it('puts a reported success ahead of an attempt still in progress', () => {
    expect(earlierAttemptWarning(attempts('INITIATED', 'RESPONSE_SUCCESS'))).toBe('reportedSuccess');
  });

  it('warns about an attempt opened or reported pending with no result yet', () => {
    expect(earlierAttemptWarning(attempts('INITIATED'))).toBe('inProgress');
    expect(earlierAttemptWarning(attempts('CANCELLED', 'PENDING'))).toBe('inProgress');
  });

  it('says nothing for no attempts, or only confirmed, failed, cancelled or unclear ones', () => {
    expect(earlierAttemptWarning([])).toBeNull();
    expect(earlierAttemptWarning(attempts('VERIFIED', 'FAILED', 'CANCELLED', 'UNKNOWN'))).toBeNull();
  });
});

describe('findAttemptByRef', () => {
  const list = [
    { transactionRef: 'FEE1', status: 'CANCELLED' as const },
    { transactionRef: 'FEE2', status: 'RESPONSE_SUCCESS' as const },
  ];

  it("finds the payment request's own attempt by its reference", () => {
    expect(findAttemptByRef(list, 'FEE2')).toEqual(list[1]);
  });

  it('returns null when the attempt is not in the list', () => {
    expect(findAttemptByRef(list, 'FEE3')).toBeNull();
    expect(findAttemptByRef([], 'FEE1')).toBeNull();
  });
});
