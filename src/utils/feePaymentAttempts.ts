import type { PaymentAttempt, PaymentAttemptStatus } from '../api/types';

/**
 * How Pay Fees shows an attempt's stored outcome. 'reportedSuccess' is only the payer's own claim;
 * 'confirmed' (VERIFIED) means an admin recorded the payment. A repeat success report on a confirmed
 * attempt comes back VERIFIED, so both are a success to the payer.
 */
export type PaymentResultKind = 'reportedSuccess' | 'confirmed' | 'pending' | 'failed' | 'cancelled' | 'unknown';

export function paymentResultKind(status: PaymentAttemptStatus): PaymentResultKind {
  switch (status) {
    case 'RESPONSE_SUCCESS':
      return 'reportedSuccess';
    case 'VERIFIED':
      return 'confirmed';
    case 'PENDING':
      return 'pending';
    case 'FAILED':
      return 'failed';
    case 'CANCELLED':
      return 'cancelled';
    default:
      // UNKNOWN, and INITIATED, which a report never leaves behind.
      return 'unknown';
  }
}

/** A failed or cancelled payment offers Try again (a fresh payment); every other result offers Done. */
export function canPayAgainAfter(kind: PaymentResultKind): boolean {
  return kind === 'failed' || kind === 'cancelled';
}

/**
 * What Pay Now warns about before starting another payment for the same fee, from that fee's
 * attempts. A reported success comes first: a payer's report no longer marks the fee paid, so the
 * fee still shows its full due until the school confirms, and paying again may pay twice.
 * 'inProgress' is an attempt opened (INITIATED) or reported PENDING with no result yet.
 */
export type EarlierAttemptWarning = 'reportedSuccess' | 'inProgress' | null;

export function earlierAttemptWarning(attempts: Pick<PaymentAttempt, 'status'>[]): EarlierAttemptWarning {
  if (attempts.some((attempt) => attempt.status === 'RESPONSE_SUCCESS')) return 'reportedSuccess';
  if (attempts.some((attempt) => attempt.status === 'INITIATED' || attempt.status === 'PENDING')) return 'inProgress';
  return null;
}

/** The attempt a payment request opened, found by the request's referenceId (the attempt's transactionRef). */
export function findAttemptByRef<T extends Pick<PaymentAttempt, 'transactionRef'>>(
  attempts: T[],
  transactionRef: string
): T | null {
  return attempts.find((attempt) => attempt.transactionRef === transactionRef) ?? null;
}
