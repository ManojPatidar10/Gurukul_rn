// Fee payment refusals that trying again can't fix, by the server's errorCode. UPI_NOT_CONFIGURED
// (409): the school has no UPI ID set, so only its admin can make UPI payments possible.
// PAYMENT_ATTEMPT_ALREADY_REPORTED (409): this attempt already has a different result, which the
// server keeps; starting a fresh payment from here could pay twice.
const NOT_RETRYABLE_CODES = new Set(['UPI_NOT_CONFIGURED', 'PAYMENT_ATTEMPT_ALREADY_REPORTED']);

/**
 * Whether the Pay Fees error screen offers "Try again" (true) or only "Back" (false). Every failure
 * is worth retrying except one that a fresh payment can't fix or could make worse.
 */
export function canRetryFeePayment(errorCode: string | null | undefined): boolean {
  return !errorCode || !NOT_RETRYABLE_CODES.has(errorCode);
}

/** The server refused a payment report because the attempt already has a different result. */
export function isPaymentAlreadyReported(errorCode: string | null | undefined): boolean {
  return errorCode === 'PAYMENT_ATTEMPT_ALREADY_REPORTED';
}
