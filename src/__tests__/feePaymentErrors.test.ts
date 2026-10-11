import { canRetryFeePayment } from '../utils/feePaymentErrors';

describe('canRetryFeePayment', () => {
  it('offers only Back when the school has not set up UPI payments', () => {
    expect(canRetryFeePayment('UPI_NOT_CONFIGURED')).toBe(false);
  });

  it('offers Try again for failures without a code (no connection, server trouble)', () => {
    expect(canRetryFeePayment(undefined)).toBe(true);
    expect(canRetryFeePayment(null)).toBe(true);
    expect(canRetryFeePayment('')).toBe(true);
  });

  it('offers Try again for other codes, which start a fresh payment', () => {
    expect(canRetryFeePayment('PAYMENT_ATTEMPT_ALREADY_REPORTED')).toBe(true);
  });
});
