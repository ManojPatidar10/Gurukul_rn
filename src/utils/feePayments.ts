import type { ApiError } from '../api/client';
import type { DuplicateReferenceData, FeePayment, PaymentMethod, ReversalType } from '../api/types';
import { parseRupees, toPaise } from './money';
import { fileSlug } from './reportCardPdfName';

/**
 * The rules for recording and reversing a fee payment in the app, kept in step with the backend
 * (FeePaymentService / FeePaymentReversalService) so the admin sees a problem before saving. The
 * server checks everything again; these only decide what the form shows.
 */

/** The methods an admin can record, in the order the picker lists them (the backend has no CARD). */
export const FEE_PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

const METHOD_LABEL_KEYS: Record<PaymentMethod, string> = {
  CASH: 'fees.paymentMethods.cash',
  UPI: 'fees.paymentMethods.upi',
  BANK_TRANSFER: 'fees.paymentMethods.bankTransfer',
  CHEQUE: 'fees.paymentMethods.cheque',
};

/** The i18n key for a method's name, or null for one this build doesn't know (show it as sent). */
export function paymentMethodLabelKey(method: string | null | undefined): string | null {
  return method && method in METHOD_LABEL_KEYS ? METHOD_LABEL_KEYS[method as PaymentMethod] : null;
}

/** Every method but cash needs a UTR, cheque number or transaction ID. */
export function referenceRequired(method: PaymentMethod): boolean {
  return method !== 'CASH';
}

/** The server's form of a reference: no whitespace anywhere, upper-case; null when nothing is left. */
export function normalizeReference(reference: string | null | undefined): string | null {
  const normalized = (reference ?? '').replace(/\s+/g, '').toUpperCase();
  return normalized || null;
}

/** How far back a payment date may go: the backend refuses anything older than this many days. */
export const MAX_PAYMENT_AGE_DAYS = 400;

/** A YYYY-MM-DD date moved by whole days (calendar arithmetic, no time zone involved). */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const moved = new Date(Date.UTC(year, month - 1, day + days));
  const mm = String(moved.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(moved.getUTCDate()).padStart(2, '0');
  return `${moved.getUTCFullYear()}-${mm}-${dd}`;
}

/** The dates a payment can be recorded for: from 400 days back up to today, as YYYY-MM-DD. */
export function paymentDateBounds(today: string): { min: string; max: string } {
  return { min: addDays(today, -MAX_PAYMENT_AGE_DAYS), max: today };
}

export interface RecordPaymentForm {
  amount: string;
  method: PaymentMethod;
  reference: string;
  /** YYYY-MM-DD, or '' to let the server use today. */
  date: string;
}

export interface RecordPaymentErrors {
  amount?: string;
  reference?: string;
  date?: string;
}

/**
 * Checks the Record payment form against the bill's remaining due. Returns the parsed amount (null
 * when it can't be read) and an i18n key per field that's wrong; `valid` when there are none.
 */
export function validateRecordPayment(
  form: RecordPaymentForm,
  remainingDue: number,
  today: string
): { amount: number | null; errors: RecordPaymentErrors; valid: boolean } {
  const errors: RecordPaymentErrors = {};
  const amount = parseRupees(form.amount);
  if (amount === null) errors.amount = 'fees.recordPayment.errors.amountInvalid';
  else if (toPaise(amount) < 1) errors.amount = 'fees.recordPayment.errors.amountTooSmall';
  else if (toPaise(amount) > toPaise(remainingDue)) errors.amount = 'fees.recordPayment.errors.amountTooLarge';

  if (referenceRequired(form.method) && !normalizeReference(form.reference)) {
    errors.reference = 'fees.recordPayment.errors.referenceRequired';
  }

  if (form.date) {
    const { min, max } = paymentDateBounds(today);
    if (form.date > max) errors.date = 'fees.recordPayment.errors.dateFuture';
    else if (form.date < min) errors.date = 'fees.recordPayment.errors.dateTooOld';
  }

  return { amount, errors, valid: Object.keys(errors).length === 0 };
}

/** The reversal types that make sense for a payment: cash can't bounce. */
export function reversalTypesFor(method: PaymentMethod): ReversalType[] {
  return method === 'CASH' ? ['CORRECTION', 'REFUND'] : ['CORRECTION', 'BOUNCED', 'REFUND'];
}

/** i18n keys for each reversal type's name and one-line explanation. */
export const REVERSAL_TYPE_KEYS: Record<ReversalType, { label: string; description: string }> = {
  CORRECTION: {
    label: 'fees.reversePayment.types.CORRECTION.label',
    description: 'fees.reversePayment.types.CORRECTION.description',
  },
  BOUNCED: {
    label: 'fees.reversePayment.types.BOUNCED.label',
    description: 'fees.reversePayment.types.BOUNCED.description',
  },
  REFUND: {
    label: 'fees.reversePayment.types.REFUND.label',
    description: 'fees.reversePayment.types.REFUND.description',
  },
};

/** The backend wants at least this many characters of reason, after trimming. */
export const MIN_REVERSAL_REASON = 10;
export const MAX_REVERSAL_REASON = 500;

export interface ReversalForm {
  type: ReversalType | null;
  reason: string;
  refundMethod: PaymentMethod | null;
  refundReference: string;
}

export interface ReversalErrors {
  type?: string;
  reason?: string;
  refundMethod?: string;
  refundReference?: string;
}

/**
 * Checks the Reverse payment form. A refund needs its method and reference (a voucher or slip
 * number for cash). There is no refund date: the server enters every reversal on the day it's made.
 */
export function validateReversal(form: ReversalForm): { errors: ReversalErrors; valid: boolean } {
  const errors: ReversalErrors = {};
  if (!form.type) errors.type = 'fees.reversePayment.errors.typeRequired';
  if (form.reason.trim().length < MIN_REVERSAL_REASON) errors.reason = 'fees.reversePayment.errors.reasonTooShort';

  if (form.type === 'REFUND') {
    if (!form.refundMethod) errors.refundMethod = 'fees.reversePayment.errors.refundMethodRequired';
    if (!normalizeReference(form.refundReference)) {
      errors.refundReference = 'fees.reversePayment.errors.refundReferenceRequired';
    }
  }

  return { errors, valid: Object.keys(errors).length === 0 };
}

/**
 * The existing payment behind a 409 DUPLICATE_REFERENCE (another live payment already has this
 * UTR or cheque number), or null for any other error.
 */
export function duplicateReferenceInfo(error: unknown): DuplicateReferenceData | null {
  if (!(error instanceof Error) || (error as ApiError).errorCode !== 'DUPLICATE_REFERENCE') return null;
  const data = (error as ApiError).data;
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<DuplicateReferenceData>;
  return {
    existingPaymentId: d.existingPaymentId ?? '',
    existingReceiptNumber: d.existingReceiptNumber ?? null,
    existingStudentName: d.existingStudentName ?? '',
    existingAmount: typeof d.existingAmount === 'number' ? d.existingAmount : 0,
    existingTransactionDate: d.existingTransactionDate ?? '',
  };
}

/** The server's PDF file name: fee-receipt-<receipt number slug>.pdf, or the id's first 8 characters. */
export function feeReceiptFileName(payment: Pick<FeePayment, 'id' | 'receiptNumber'>): string {
  return `fee-receipt-${fileSlug(payment.receiptNumber, '') || payment.id.slice(0, 8)}.pdf`;
}

/** A YYYY-MM-DD date for display ("5 Oct 2026" in English), in the phone's language. */
export function formatPaymentDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** The local date of an ISO instant (e.g. when a payment was reversed), for display. */
export function formatInstantDate(instant: string | null | undefined): string {
  if (!instant) return '—';
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return instant;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
