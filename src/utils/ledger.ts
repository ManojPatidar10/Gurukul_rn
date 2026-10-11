import type { TFunction } from 'i18next';

import type {
  DayBookBucket,
  LedgerDirection,
  LedgerDocumentType,
  LedgerFilter,
  LedgerSourceType,
  LedgerStatus,
  LedgerTransaction,
  ManualCategory,
  PaymentMethod,
} from '../api/types';
import { istToday } from './quizInsights';

/**
 * Pure helpers for the Ledger and Ledger entry screens (specs/ledger-and-receipts). Dates are
 * school days in Asia/Kolkata, the calendar the server files entries under, and the financial year
 * runs April to March.
 */

export const LEDGER_PAGE_SIZE = 50;
export const REVERSAL_REASON_MIN = 3;
export const REVERSAL_REASON_MAX = 500;

// Full i18n keys per enum value, so tsc checks every value has a label; the arrays below come
// from these maps, in the contract's order.
const SOURCE_TYPE_KEYS: Record<LedgerSourceType, string> = {
  FEE_PAYMENT: 'ledger.sourceType.FEE_PAYMENT',
  EVENT_COLLECTION: 'ledger.sourceType.EVENT_COLLECTION',
  SPONSORSHIP: 'ledger.sourceType.SPONSORSHIP',
  SALARY: 'ledger.sourceType.SALARY',
  VENDOR_PAYMENT: 'ledger.sourceType.VENDOR_PAYMENT',
  MANUAL: 'ledger.sourceType.MANUAL',
};

const MANUAL_CATEGORY_KEYS: Record<ManualCategory, string> = {
  OPENING_BALANCE: 'ledger.manualCategory.OPENING_BALANCE',
  DONATION: 'ledger.manualCategory.DONATION',
  OTHER_INCOME: 'ledger.manualCategory.OTHER_INCOME',
  BANK_INTEREST: 'ledger.manualCategory.BANK_INTEREST',
  PETTY_EXPENSE: 'ledger.manualCategory.PETTY_EXPENSE',
  BANK_CHARGES: 'ledger.manualCategory.BANK_CHARGES',
  OTHER_EXPENSE: 'ledger.manualCategory.OTHER_EXPENSE',
};

const DOCUMENT_TYPE_KEYS: Record<LedgerDocumentType, string> = {
  FEE_PAYMENT: 'ledger.documentType.FEE_PAYMENT',
  PAYROLL_LINE: 'ledger.documentType.PAYROLL_LINE',
  INFRA_EXPENSE_REQUEST: 'ledger.documentType.INFRA_EXPENSE_REQUEST',
  EVENT_EXPENSE_REQUEST: 'ledger.documentType.EVENT_EXPENSE_REQUEST',
  SPONSORSHIP_PAYMENT: 'ledger.documentType.SPONSORSHIP_PAYMENT',
  EVENT_COLLECTION_PAYMENT: 'ledger.documentType.EVENT_COLLECTION_PAYMENT',
  MANUAL_ENTRY: 'ledger.documentType.MANUAL_ENTRY',
};

const PAYMENT_METHOD_KEYS: Record<PaymentMethod, string> = {
  CASH: 'ledger.method.CASH',
  UPI: 'ledger.method.UPI',
  BANK_TRANSFER: 'ledger.method.BANK_TRANSFER',
  CHEQUE: 'ledger.method.CHEQUE',
};

const DIRECTION_KEYS: Record<LedgerDirection, string> = {
  INFLOW: 'ledger.direction.INFLOW',
  OUTFLOW: 'ledger.direction.OUTFLOW',
};

const STATUS_KEYS: Record<LedgerStatus, string> = {
  PENDING: 'ledger.status.PENDING',
  COMPLETED: 'ledger.status.COMPLETED',
  REVERSED: 'ledger.status.REVERSED',
};

/** The plural labels the Category filter uses for each source ("Fees", "Vendor payments"). */
const SOURCE_FILTER_KEYS: Record<LedgerSourceType, string> = {
  FEE_PAYMENT: 'ledger.filter.category.FEE_PAYMENT',
  EVENT_COLLECTION: 'ledger.filter.category.EVENT_COLLECTION',
  SPONSORSHIP: 'ledger.filter.category.SPONSORSHIP',
  SALARY: 'ledger.filter.category.SALARY',
  VENDOR_PAYMENT: 'ledger.filter.category.VENDOR_PAYMENT',
  MANUAL: 'ledger.filter.category.MANUAL',
};

export const LEDGER_SOURCE_TYPES = Object.keys(SOURCE_TYPE_KEYS) as LedgerSourceType[];
export const MANUAL_CATEGORIES = Object.keys(MANUAL_CATEGORY_KEYS) as ManualCategory[];
export const LEDGER_DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_KEYS) as LedgerDocumentType[];
export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_KEYS) as PaymentMethod[];
export const LEDGER_DIRECTIONS = Object.keys(DIRECTION_KEYS) as LedgerDirection[];
export const LEDGER_STATUSES = Object.keys(STATUS_KEYS) as LedgerStatus[];

/** Every label key the helpers above can hand out, for the test that checks en.json has them all. */
export const LEDGER_LABEL_KEYS: readonly string[] = [
  ...Object.values(SOURCE_TYPE_KEYS),
  ...Object.values(MANUAL_CATEGORY_KEYS),
  ...Object.values(DOCUMENT_TYPE_KEYS),
  ...Object.values(PAYMENT_METHOD_KEYS),
  ...Object.values(DIRECTION_KEYS),
  ...Object.values(STATUS_KEYS),
  ...Object.values(SOURCE_FILTER_KEYS),
];

/** A label for an enum value; a value a newer server adds shows as sent. */
function labelOf<K extends string>(keys: Record<K, string>, value: K | null | undefined, t: TFunction): string {
  if (!value) return '';
  const key = keys[value] as string | undefined;
  return key ? t(key) : value;
}

export const sourceTypeLabel = (v: LedgerSourceType | null | undefined, t: TFunction) => labelOf(SOURCE_TYPE_KEYS, v, t);
export const manualCategoryLabel = (v: ManualCategory | null | undefined, t: TFunction) =>
  labelOf(MANUAL_CATEGORY_KEYS, v, t);
export const documentTypeLabel = (v: LedgerDocumentType | null | undefined, t: TFunction) =>
  labelOf(DOCUMENT_TYPE_KEYS, v, t);
export const directionLabel = (v: LedgerDirection | null | undefined, t: TFunction) => labelOf(DIRECTION_KEYS, v, t);

/** "Cash", "UPI", …, or "Not recorded" for an entry with no method (old manual entries). */
export function paymentMethodLabel(method: PaymentMethod | null | undefined, t: TFunction): string {
  return method ? labelOf(PAYMENT_METHOD_KEYS, method, t) : t('ledger.method.none');
}

/** A row's label: the source ("Fee payment"), or "Manual entry · Donation" for a manual entry. */
export function entryLabel(tx: Pick<LedgerTransaction, 'sourceType' | 'manualCategory'>, t: TFunction): string {
  if (tx.sourceType === 'MANUAL' && tx.manualCategory) {
    return t('ledger.entry.manualWithCategory', { category: manualCategoryLabel(tx.manualCategory, t) });
  }
  return sourceTypeLabel(tx.sourceType, t);
}

// ---------------------------------------------------------------- query & filters

const QUERY_KEYS: (keyof LedgerFilter)[] = [
  'from',
  'to',
  'academicYear',
  'sourceType',
  'manualCategory',
  'paymentMethod',
  'direction',
  'documentType',
  'documentId',
];

/** The summary takes only the period, source, category and method filters. */
const SUMMARY_KEYS: (keyof LedgerFilter)[] = ['from', 'to', 'academicYear', 'sourceType', 'manualCategory', 'paymentMethod'];

/**
 * "?from=2026-10-01&to=2026-10-11&page=0&size=50", leaving out empty values, or "" when nothing is
 * set. Values are trimmed and URI-encoded.
 */
export function buildLedgerQuery(filter: LedgerFilter, page?: number, size?: number): string {
  const parts: string[] = [];
  for (const key of QUERY_KEYS) {
    const value = filter[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) parts.push(`${key}=${encodeURIComponent(text)}`);
  }
  if (page !== undefined && Number.isFinite(page)) parts.push(`page=${Math.max(0, Math.floor(page))}`);
  if (size !== undefined && Number.isFinite(size)) parts.push(`size=${Math.floor(size)}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/** The part of a filter the fund summary understands. */
export function summaryFilterOf(filter: LedgerFilter): LedgerFilter {
  const out: LedgerFilter = {};
  for (const key of SUMMARY_KEYS) {
    if (filter[key]) Object.assign(out, { [key]: filter[key] });
  }
  return out;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-27" for a financial year starting in April `startYear`. */
function financialYearLabel(startYear: number): string {
  return `${startYear}-${pad((startYear + 1) % 100)}`;
}

/** The April–March financial year of a YYYY-MM-DD date: 2026-04-01 → "2026-27", 2026-03-31 → "2025-26". */
export function financialYearOf(isoDate: string): string {
  const [year, month] = isoDate.split('-').map(Number);
  return financialYearLabel(month >= 4 ? year : year - 1);
}

export type LedgerPeriod = 'thisMonth' | 'thisYear' | 'lastYear';
export type LedgerPeriodChoice = LedgerPeriod | 'custom';

/**
 * The filter for a period chip, by today in IST: this month runs from the 1st to today; this year
 * and last year are financial years, sent as `academicYear`.
 */
export function periodRange(period: LedgerPeriod, now: Date): LedgerFilter {
  const today = istToday(now);
  if (period === 'thisMonth') return { from: `${today.slice(0, 8)}01`, to: today };
  const thisYear = financialYearOf(today);
  if (period === 'thisYear') return { academicYear: thisYear };
  return { academicYear: financialYearLabel(Number(thisYear.slice(0, 4)) - 1) };
}

/** The Category dropdown's value for "All". */
export const ALL_OPTION = 'all';

/** Category dropdown values, in order: All, each source (Fees … Manual entries (any)), then each manual category. */
const CATEGORY_SOURCE_ORDER: LedgerSourceType[] = [
  'FEE_PAYMENT',
  'SALARY',
  'VENDOR_PAYMENT',
  'SPONSORSHIP',
  'EVENT_COLLECTION',
  'MANUAL',
];

export function categoryOptions(t: TFunction): { label: string; value: string }[] {
  return [
    { label: t('ledger.entries.all'), value: ALL_OPTION },
    ...CATEGORY_SOURCE_ORDER.map((s) => ({ label: labelOf(SOURCE_FILTER_KEYS, s, t), value: `source:${s}` })),
    ...MANUAL_CATEGORIES.map((c) => ({
      label: t('ledger.entry.manualWithCategory', { category: manualCategoryLabel(c, t) }),
      value: `manual:${c}`,
    })),
  ];
}

/** The filter a Category dropdown value stands for; {} for All or anything unknown. */
export function categoryFilterOf(value: string): Pick<LedgerFilter, 'sourceType' | 'manualCategory'> {
  const [kind, raw] = value.split(':');
  if (kind === 'source' && (LEDGER_SOURCE_TYPES as string[]).includes(raw)) {
    return { sourceType: raw as LedgerSourceType };
  }
  if (kind === 'manual' && (MANUAL_CATEGORIES as string[]).includes(raw)) {
    return { sourceType: 'MANUAL', manualCategory: raw as ManualCategory };
  }
  return {};
}

export function methodOptions(t: TFunction): { label: string; value: string }[] {
  return [
    { label: t('ledger.entries.all'), value: ALL_OPTION },
    ...PAYMENT_METHODS.map((m) => ({ label: paymentMethodLabel(m, t), value: m })),
  ];
}

/** The filter a Method dropdown value stands for; {} for All or anything unknown. */
export function methodFilterOf(value: string): Pick<LedgerFilter, 'paymentMethod'> {
  return (PAYMENT_METHODS as string[]).includes(value) ? { paymentMethod: value as PaymentMethod } : {};
}

export interface EntriesFilterInput {
  period: LedgerPeriodChoice;
  customFrom: string;
  customTo: string;
  category: string;
  method: string;
}

/** The Entries tab's whole filter: the period (or custom range), plus the category and method. */
export function buildEntriesFilter(input: EntriesFilterInput, now: Date): LedgerFilter {
  const period: LedgerFilter =
    input.period === 'custom'
      ? { ...(input.customFrom ? { from: input.customFrom } : {}), ...(input.customTo ? { to: input.customTo } : {}) }
      : periodRange(input.period, now);
  return { ...period, ...categoryFilterOf(input.category), ...methodFilterOf(input.method) };
}

/** An i18n error key when a custom range ends before it starts, else null. */
export function customRangeError(from: string, to: string): string | null {
  return from && to && from > to ? 'ledger.entries.rangeOrder' : null;
}

/**
 * The next page added to the rows already shown. Pages are by offset, newest first, so an entry
 * recorded in between pushes rows down a page; ones already shown are skipped, not repeated.
 */
export function appendPage<T extends { id: string }>(shown: readonly T[], next: readonly T[]): T[] {
  const seen = new Set(shown.map((row) => row.id));
  return [...shown, ...next.filter((row) => !seen.has(row.id))];
}

// ---------------------------------------------------------------- amounts & numbers

export type MethodBucket = 'cash' | 'bank' | 'unspecified';

/** Cash vs bank, as the server splits its totals: CASH is cash; UPI, bank transfer and cheque are bank. */
export function methodBucket(method: PaymentMethod | null | undefined): MethodBucket {
  if (method === 'CASH') return 'cash';
  if (method === 'UPI' || method === 'BANK_TRANSFER' || method === 'CHEQUE') return 'bank';
  return 'unspecified';
}

/** The receipt number (money in) or voucher number (money out), or null when the entry has neither. */
export function displayNumber(tx: Pick<LedgerTransaction, 'receiptNumber' | 'voucherNumber'>): string | null {
  return tx.receiptNumber ?? tx.voucherNumber ?? null;
}

/** The amount, negative for money out. */
export function signedAmount(tx: Pick<LedgerTransaction, 'direction' | 'amount'>): number {
  return tx.direction === 'OUTFLOW' ? -tx.amount : tx.amount;
}

const MINUS = '−';

/** Indian digit grouping: 1234567 → "12,34,567". */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${digits.slice(-3)}`;
}

/** "₹12,34,567.50"; a negative amount gets a minus sign: "−₹2,000.00". */
export function formatRupees(n: number): string {
  const value = Number.isFinite(n) ? n : 0;
  const paise = Math.round(Math.abs(value) * 100);
  const text = `₹${groupIndian(String(Math.floor(paise / 100)))}.${pad(paise % 100)}`;
  return value < 0 && paise > 0 ? `${MINUS}${text}` : text;
}

/** "+₹5,000.00" or "−₹2,000.00"; zero has no sign. */
export function formatSignedRupees(n: number): string {
  const text = formatRupees(n);
  return n > 0 && text !== '₹0.00' ? `+${text}` : text;
}

// ---------------------------------------------------------------- dates

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A YYYY-MM-DD date moved by `days` (negative goes back). */
export function shiftIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "11 Oct", or "11 Oct 2026" with the year; "" for anything that isn't YYYY-MM-DD. */
export function formatLedgerDate(isoDate: string | null | undefined, withYear = false): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
  if (!match) return '';
  const label = `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]}`;
  return withYear ? `${label} ${match[1]}` : label;
}

/** Whether a day book bucket is all zeros (the "Not recorded" row is hidden then). */
export function isZeroBucket(b: DayBookBucket | null | undefined): boolean {
  return !b || (b.opening === 0 && b.inflow === 0 && b.outflow === 0 && b.closing === 0);
}

// ---------------------------------------------------------------- receipts & reversal

/** What the find box sends: trimmed and upper-cased, or null when blank. */
export function normalizeReceiptQuery(text: string): string | null {
  const value = text.trim().toUpperCase();
  return value ? value : null;
}

/** Whether a reversal reason is long enough and short enough once trimmed. */
export function isValidReversalReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= REVERSAL_REASON_MIN && length <= REVERSAL_REASON_MAX;
}

/**
 * Why an entry has no Reverse button, as an i18n key, or null when there's nothing to say: the
 * entry can be reversed, it already was, or it is itself a reversal.
 */
export function reverseHint(
  tx: Pick<LedgerTransaction, 'reversible' | 'reversed' | 'reversalOfId' | 'sourceType'>
): string | null {
  if (tx.reversible || tx.reversed || tx.reversalOfId) return null;
  if (tx.sourceType === 'FEE_PAYMENT') return 'ledger.detail.hint.feePayment';
  if (tx.sourceType === 'SALARY' || tx.sourceType === 'VENDOR_PAYMENT') return 'ledger.detail.hint.salaryVendor';
  return null;
}

/** The chips a row shows: "Reversed" on a reversed entry, "Reversal" on a reversal entry, "Pending" when not posted. */
export function entryChips(
  tx: Pick<LedgerTransaction, 'reversed' | 'reversalOfId' | 'status'>
): { key: string; variant: 'warning' | 'neutral' }[] {
  const chips: { key: string; variant: 'warning' | 'neutral' }[] = [];
  if (tx.reversed) chips.push({ key: 'ledger.entry.reversed', variant: 'warning' });
  if (tx.reversalOfId) chips.push({ key: 'ledger.entry.reversal', variant: 'neutral' });
  if (tx.status === 'PENDING') chips.push({ key: 'ledger.status.PENDING', variant: 'neutral' });
  return chips;
}

/** "Receipt no." for a receipt, "Voucher no." for a voucher. */
export function numberLabelKey(tx: Pick<LedgerTransaction, 'receiptNumber' | 'voucherNumber'>): string {
  return tx.receiptNumber || !tx.voucherNumber ? 'ledger.detail.receiptNumber' : 'ledger.detail.voucherNumber';
}

/** The "Linked to" line: "Fee payment · 1a2b3c4d", the type alone with no id, or "Not linked (…)" for old entries. */
export function linkedDocumentText(
  tx: Pick<LedgerTransaction, 'documentType' | 'documentId'>,
  t: TFunction
): string {
  if (!tx.documentType) return t('ledger.detail.notLinked');
  const type = documentTypeLabel(tx.documentType, t);
  return tx.documentId ? t('ledger.detail.linkedValue', { type, id: tx.documentId.slice(0, 8) }) : type;
}

/**
 * The reverse dialog's warning: "This adds a reversal entry of ₹X dated today. Receipt N will show
 * as cancelled. This can't be undone." The middle sentence is left out when the entry has no number.
 */
export function reverseConfirmText(
  tx: Pick<LedgerTransaction, 'amount' | 'receiptNumber' | 'voucherNumber'>,
  t: TFunction
): string {
  const parts = [t('ledger.reverse.body', { amount: formatRupees(tx.amount) })];
  if (tx.receiptNumber) parts.push(t('ledger.reverse.receiptCancelled', { number: tx.receiptNumber }));
  else if (tx.voucherNumber) parts.push(t('ledger.reverse.voucherCancelled', { number: tx.voucherNumber }));
  parts.push(t('ledger.reverse.cannotUndo'));
  return parts.join(' ');
}
