/**
 * UPI application callback is not authoritative proof of payment. This app has no payment
 * gateway/PSP integration - RESPONSE_SUCCESS below reflects only what the UPI app (or the user,
 * self-reporting) claimed when control returned to this app. VERIFIED is reserved for a real,
 * independently-confirmed payment and nothing in this codebase sets it yet. See
 * FeePaymentService.recordAttemptResult (backend) and task-fee-payment.md for the full caveat.
 */
export type UpiPaymentAttemptStatus =
  | 'INITIATED'
  | 'RESPONSE_SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'VERIFIED';

export interface UpiPaymentResult {
  status: UpiPaymentAttemptStatus;
  transactionId: string | null;
  transactionRef: string | null;
  approvalRefNo: string | null;
  responseCode: string | null;
  rawResponse: string;
}

const SUCCESS_VALUES = new Set(['success']);
const PENDING_VALUES = new Set(['submitted', 'pending']);
const FAILURE_VALUES = new Set(['failure', 'failed']);

/**
 * Different UPI apps use inconsistent capitalization for both keys and values (Status/status,
 * SUCCESS/Success), and some fields (txnId/txnRef/ApprovalRefNo) vary in casing too. This parses
 * defensively and never throws, even on malformed or empty input - unrecognized input becomes
 * UNKNOWN rather than crashing the screen that's waiting on it.
 */
export function parseUpiResponse(response: string | null | undefined): UpiPaymentResult {
  const raw = response ?? '';
  const fields = new Map<string, string>();

  for (const pair of raw.split('&')) {
    if (!pair) continue;
    const eqIndex = pair.indexOf('=');
    const rawKey = eqIndex === -1 ? pair : pair.slice(0, eqIndex);
    const rawValue = eqIndex === -1 ? '' : pair.slice(eqIndex + 1);
    if (!rawKey) continue;
    try {
      fields.set(rawKey.toLowerCase(), decodeURIComponent(rawValue));
    } catch {
      fields.set(rawKey.toLowerCase(), rawValue);
    }
  }

  const statusValue = (fields.get('status') ?? '').toLowerCase();
  let status: UpiPaymentAttemptStatus;
  if (SUCCESS_VALUES.has(statusValue)) {
    status = 'RESPONSE_SUCCESS';
  } else if (PENDING_VALUES.has(statusValue)) {
    status = 'PENDING';
  } else if (FAILURE_VALUES.has(statusValue)) {
    status = 'FAILED';
  } else {
    status = 'UNKNOWN';
  }

  return {
    status,
    transactionId: fields.get('txnid') ?? null,
    transactionRef: fields.get('txnref') ?? null,
    approvalRefNo: fields.get('approvalrefno') ?? null,
    responseCode: fields.get('responsecode') ?? null,
    rawResponse: raw,
  };
}
