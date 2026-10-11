// Fee payment refusals that trying again can't fix, by the server's errorCode. UPI_NOT_CONFIGURED
// (409): the school has no UPI ID set, so only its admin can make UPI payments possible.
const NOT_RETRYABLE_CODES = new Set(['UPI_NOT_CONFIGURED']);

/**
 * Whether the Pay Fees error screen offers "Try again" (true) or only "Back" (false). Every failure
 * is worth retrying except one the school itself has to fix first.
 */
export function canRetryFeePayment(errorCode: string | null | undefined): boolean {
  return !errorCode || !NOT_RETRYABLE_CODES.has(errorCode);
}
