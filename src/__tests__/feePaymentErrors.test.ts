import { canRetryFeePayment, isPaymentAlreadyReported } from '../utils/feePaymentErrors';

describe('canRetryFeePayment', () => {
  it('offers only Back when the school has not set up UPI payments', () => {
    expect(canRetryFeePayment('UPI_NOT_CONFIGURED')).toBe(false);
  });

  it('offers only Back when the attempt already has a different result, so a fresh payment could pay twice', () => {
    expect(canRetryFeePayment('PAYMENT_ATTEMPT_ALREADY_REPORTED')).toBe(false);
  });

  it('offers only Back on a cancelled bill, which takes no payment however often it is retried', () => {
    expect(canRetryFeePayment('FEE_BILL_CANCELLED')).toBe(false);
  });

  it('offers Try again for failures without a code (no connection, server trouble)', () => {
    expect(canRetryFeePayment(undefined)).toBe(true);
    expect(canRetryFeePayment(null)).toBe(true);
    expect(canRetryFeePayment('')).toBe(true);
  });

  it('offers Try again for other codes', () => {
    expect(canRetryFeePayment('SOMETHING_ELSE')).toBe(true);
  });
});

describe('isPaymentAlreadyReported', () => {
  it('is true only for the 409 that keeps an earlier result', () => {
    expect(isPaymentAlreadyReported('PAYMENT_ATTEMPT_ALREADY_REPORTED')).toBe(true);
    expect(isPaymentAlreadyReported('UPI_NOT_CONFIGURED')).toBe(false);
    expect(isPaymentAlreadyReported(undefined)).toBe(false);
    expect(isPaymentAlreadyReported(null)).toBe(false);
  });
});
