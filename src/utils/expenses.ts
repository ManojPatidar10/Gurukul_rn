import type { TFunction } from 'i18next';

import type {
  AmountAboveApprovedData,
  CategoryExistsData,
  DuplicateInvoiceData,
  ExpenseAction,
  ExpenseTimelineStep,
  InfraExpenseCategory,
  InfraExpenseRequest,
  InfraExpenseStatus,
  InfraPurchaseInfo,
  PaymentMethod,
} from '../api/expenseTypes';
import { formatInr, toPaise } from './money';

/**
 * Infra expense decisions the screens share (specs/expenses-and-vendors): the words for every
 * status and timeline step, which actions a request offers, the payment method picker, category
 * names, and reading the server's refusals. Pure, so it's unit-tested in src/__tests__/expenses.test.ts.
 */

/** The server's limit for a request description: the column size. */
export const DESCRIPTION_MAX_LENGTH = 1000;
/** The description counter shows from this many characters. */
export const DESCRIPTION_COUNTER_FROM = 900;
export const COMMENT_MAX_LENGTH = 500;
export const INVOICE_MAX_LENGTH = 100;
export const PAYMENT_REFERENCE_MAX_LENGTH = 100;
/** A rejection needs a reason of at least this many characters. */
export const REJECT_REASON_MIN_LENGTH = 3;

// ---------------------------------------------------------------------------------------------
// Payment method

/** How a vendor can be paid: the backend's PaymentMethod enum, without card. */
export const EXPENSE_PAYMENT_METHODS: readonly PaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

// The fee screens' labels for the same methods.
const PAYMENT_METHOD_KEYS: Record<PaymentMethod, string> = {
  CASH: 'fees.paymentMethods.cash',
  UPI: 'fees.paymentMethods.upi',
  BANK_TRANSFER: 'fees.paymentMethods.bankTransfer',
  CHEQUE: 'fees.paymentMethods.cheque',
};

/** "Bank transfer" for BANK_TRANSFER. A method a newer server adds shows as sent. */
export function paymentMethodLabel(method: string | null | undefined, t: TFunction): string {
  if (!method) return '';
  const key = PAYMENT_METHOD_KEYS[method as PaymentMethod] as string | undefined;
  return key ? t(key) : method;
}

export function paymentMethodOptions(t: TFunction): { label: string; value: PaymentMethod }[] {
  return EXPENSE_PAYMENT_METHODS.map((value) => ({ label: t(PAYMENT_METHOD_KEYS[value]), value }));
}

/** UPI, bank transfer and cheque need the UTR, transaction ID or cheque number; cash doesn't. */
export function needsPaymentReference(method: string | null | undefined): boolean {
  return method === 'UPI' || method === 'BANK_TRANSFER' || method === 'CHEQUE';
}

/**
 * The "Mark as paid" confirmation: what's paid, to whom, how and when. Paying writes the ledger
 * outflow, which the app can't undo, so it's confirmed like cancelling is.
 */
export function payConfirmation(
  purchase: Pick<InfraPurchaseInfo, 'actualAmount' | 'vendorName'>,
  method: PaymentMethod,
  transactionDate: string,
  t: TFunction,
  locale?: string
): { title: string; body: string } {
  return {
    title: t('infraExpenses.panels.payConfirmTitle'),
    body: t('infraExpenses.panels.payConfirmBody', {
      amount: formatInr(purchase.actualAmount),
      vendor: purchase.vendorName,
      method: paymentMethodLabel(method, t),
      date: formatExpenseDate(transactionDate, locale),
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Status

export type ChipVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

export const INFRA_STATUSES: readonly InfraExpenseStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PURCHASED',
  'PAID',
  'CANCELLED',
];

const STATUS_KEYS: Record<InfraExpenseStatus, string> = {
  DRAFT: 'infraExpenses.status.DRAFT',
  SUBMITTED: 'infraExpenses.status.SUBMITTED',
  APPROVED: 'infraExpenses.status.APPROVED',
  REJECTED: 'infraExpenses.status.REJECTED',
  PURCHASED: 'infraExpenses.status.PURCHASED',
  PAID: 'infraExpenses.status.PAID',
  CANCELLED: 'infraExpenses.status.CANCELLED',
};

const STATUS_VARIANTS: Record<InfraExpenseStatus, ChipVariant> = {
  DRAFT: 'neutral',
  SUBMITTED: 'warning',
  APPROVED: 'info',
  REJECTED: 'error',
  PURCHASED: 'info',
  PAID: 'success',
  CANCELLED: 'neutral',
};

/** "Waiting for approval" for SUBMITTED, and so on. A status a newer server adds shows as sent. */
export function infraStatusLabel(status: string, t: TFunction): string {
  const key = STATUS_KEYS[status as InfraExpenseStatus] as string | undefined;
  return key ? t(key) : status;
}

export function infraStatusVariant(status: string): ChipVariant {
  return STATUS_VARIANTS[status as InfraExpenseStatus] ?? 'neutral';
}

/** The list's filter chips; null is "All". */
export const INFRA_STATUS_FILTERS: readonly (InfraExpenseStatus | null)[] = [null, 'SUBMITTED', 'APPROVED', 'PURCHASED', 'PAID'];

// ---------------------------------------------------------------------------------------------
// Amounts and actions

/** What a bill may come to: the approved amount, or the amount asked for when there's none (legacy). */
export function approvedLimit(request: Pick<InfraExpenseRequest, 'approvedAmount' | 'estimatedAmount'>): number {
  return request.approvedAmount ?? request.estimatedAmount;
}

/** A recorded bill above its approval: it has to go back for approval before it can be paid. */
export function needsReapproval(request: InfraExpenseRequest): boolean {
  if (typeof request.needsReapproval === 'boolean') return request.needsReapproval;
  return !!request.purchase && toPaise(request.purchase.actualAmount) > toPaise(approvedLimit(request));
}

/** True when a bill of `bill` rupees is more than the request's approval allows. */
export function billAboveApproved(request: InfraExpenseRequest, bill: number): boolean {
  return toPaise(bill) > toPaise(approvedLimit(request));
}

/** The amount the revise panel starts with: the bill when it's above the approval, else the amount asked. */
export function defaultReviseAmount(request: InfraExpenseRequest): number {
  return needsReapproval(request) && request.purchase ? request.purchase.actualAmount : request.estimatedAmount;
}

export const EXPENSE_ACTIONS: readonly ExpenseAction[] = ['SUBMIT', 'APPROVE', 'REJECT', 'REVISE', 'RECORD_PURCHASE', 'PAY', 'CANCEL'];

/** The status table the server works from (spec 2b), for a server that doesn't send allowedActions. */
function fallbackActions(request: InfraExpenseRequest): ExpenseAction[] {
  const hasPurchase = !!request.purchase;
  switch (request.status) {
    case 'DRAFT':
      return ['SUBMIT', 'REVISE', 'CANCEL'];
    case 'SUBMITTED': {
      const actions: ExpenseAction[] = request.selfApprovalBlocked ? ['REJECT'] : ['APPROVE', 'REJECT'];
      return hasPurchase ? actions : [...actions, 'CANCEL'];
    }
    case 'APPROVED':
      return hasPurchase ? [] : ['RECORD_PURCHASE', 'REVISE', 'CANCEL'];
    case 'REJECTED':
      return hasPurchase ? ['SUBMIT', 'REVISE'] : ['SUBMIT', 'REVISE', 'CANCEL'];
    case 'PURCHASED':
      return needsReapproval(request) ? ['REVISE'] : ['PAY'];
    default:
      return [];
  }
}

/**
 * The steps to offer for this request: exactly the server's allowedActions (worked out for the
 * caller), or the status table when an older server doesn't send them. Actions this app has no
 * button for are left out.
 */
export function infraActions(request: InfraExpenseRequest): ExpenseAction[] {
  const actions = Array.isArray(request.allowedActions) ? request.allowedActions : fallbackActions(request);
  return actions.filter((action) => EXPENSE_ACTIONS.includes(action));
}

// ---------------------------------------------------------------------------------------------
// Timeline

const STEP_KEYS: Record<ExpenseTimelineStep, string> = {
  CREATED: 'infraExpenses.timeline.CREATED',
  SUBMITTED: 'infraExpenses.timeline.SUBMITTED',
  SENT_BACK: 'infraExpenses.timeline.SENT_BACK',
  APPROVED: 'infraExpenses.timeline.APPROVED',
  REJECTED: 'infraExpenses.timeline.REJECTED',
  CANCELLED: 'infraExpenses.timeline.CANCELLED',
  PURCHASE_RECORDED: 'infraExpenses.timeline.PURCHASE_RECORDED',
  PAID: 'infraExpenses.timeline.PAID',
};

/** "Sent back for approval" for SENT_BACK, and so on. A step a newer server adds shows as sent. */
export function timelineStepLabel(step: string, t: TFunction): string {
  const key = STEP_KEYS[step as ExpenseTimelineStep] as string | undefined;
  return key ? t(key) : step;
}

// ---------------------------------------------------------------------------------------------
// Categories

/** The categories every school starts with, by code, with their English names as the server stores them. */
export const DEFAULT_CATEGORY_NAMES: Readonly<Record<string, string>> = {
  LIBRARY: 'Library',
  LAB: 'Laboratory',
  SPORTS: 'Sports Equipment',
  FURNITURE: 'Furniture',
  CLASSROOM: 'Classroom Maintenance',
  IT: 'IT Equipment',
  OTHER: 'Other',
};

/**
 * A category's name in the app's language. A default category whose name hasn't been changed shows
 * the translated name; any other category - or a renamed default - shows the name the school gave it.
 */
export function categoryLabel(category: Pick<InfraExpenseCategory, 'code'> & { name?: string | null }, t: TFunction): string {
  const name = (category.name ?? '').trim();
  const defaultName = Object.prototype.hasOwnProperty.call(DEFAULT_CATEGORY_NAMES, category.code)
    ? DEFAULT_CATEGORY_NAMES[category.code]
    : undefined;
  if (defaultName && (name === '' || name === defaultName)) return t(`expenseCategories.defaultNames.${category.code}`);
  return name || category.code;
}

/**
 * A spend-history row's category, which the server sends by name only: a default category's English
 * name shows in the app's language, any other name as stored. Null when there's none.
 */
export function paymentCategoryLabel(name: string | null | undefined, t: TFunction): string | null {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return null;
  const code = Object.keys(DEFAULT_CATEGORY_NAMES).find((c) => DEFAULT_CATEGORY_NAMES[c] === trimmed);
  return code ? t(`expenseCategories.defaultNames.${code}`) : trimmed;
}

/** The request's category name (an older server sends only the code). */
export function requestCategoryLabel(request: InfraExpenseRequest, t: TFunction): string {
  return categoryLabel({ code: request.categoryCode, name: request.categoryName }, t);
}

/** "Library · Requested ₹5,000.00", then "· Bill ₹4,800.00" once bought, or "· Paid ₹4,800.00" once paid. */
export function infraRowSubtitle(request: InfraExpenseRequest, t: TFunction): string {
  const parts = [
    requestCategoryLabel(request, t),
    t('infraExpenses.list.requested', { amount: formatInr(request.estimatedAmount) }),
  ];
  if (request.payment) parts.push(t('infraExpenses.list.paid', { amount: formatInr(request.payment.amount) }));
  else if (request.purchase) parts.push(t('infraExpenses.list.bill', { amount: formatInr(request.purchase.actualAmount) }));
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------------------------
// Refusals

/** How a screen should react to a failed action. */
export type ExpenseErrorKind = 'stale' | 'aboveApproved' | 'selfApproval' | 'duplicateInvoice' | 'other';

// Read off the error by shape, so this file doesn't pull in the API client.
function errorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { errorCode?: unknown }).errorCode;
  return typeof code === 'string' ? code : undefined;
}

function errorData(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== 'object') return {};
  const data = (error as { data?: unknown }).data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
}

/**
 * EXPENSE_CHANGED, CONCURRENT_UPDATE and EXPENSE_WRONG_STATUS mean the screen is out of date
 * ('stale': show the message and reload). The others each have their own dialog.
 */
export function expenseErrorKind(error: unknown): ExpenseErrorKind {
  switch (errorCode(error)) {
    case 'EXPENSE_CHANGED':
    case 'CONCURRENT_UPDATE':
    case 'EXPENSE_WRONG_STATUS':
      return 'stale';
    case 'AMOUNT_ABOVE_APPROVED':
      return 'aboveApproved';
    case 'SELF_APPROVAL_NOT_ALLOWED':
      return 'selfApproval';
    case 'DUPLICATE_INVOICE':
      return 'duplicateInvoice';
    default:
      return 'other';
  }
}

const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** The amounts from a 409 AMOUNT_ABOVE_APPROVED, or null when they're missing. */
export function aboveApprovedData(error: unknown): AmountAboveApprovedData | null {
  const data = errorData(error);
  return isAmount(data.approvedAmount) && isAmount(data.actualAmount)
    ? { approvedAmount: data.approvedAmount, actualAmount: data.actualAmount }
    : null;
}

/** The admins a 403 SELF_APPROVAL_NOT_ALLOWED names, who can approve instead. */
export function otherAdminNames(error: unknown): string[] {
  const names = errorData(error).otherAdminNames;
  return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
}

/** The other expense a 409 DUPLICATE_INVOICE points at, or null when it isn't described. */
export function duplicateInvoiceData(error: unknown): DuplicateInvoiceData | null {
  const data = errorData(error);
  if (typeof data.invoiceNumber !== 'string' || typeof data.status !== 'string') return null;
  return {
    source: data.source === 'EVENT' ? 'EVENT' : 'INFRA',
    requestId: typeof data.requestId === 'string' ? data.requestId : '',
    eventId: typeof data.eventId === 'string' ? data.eventId : null,
    status: data.status,
    invoiceNumber: data.invoiceNumber,
  };
}

/** "Another admin has to approve this: Asha Verma." - or without names when the server sent none. */
export function selfApprovalMessage(error: unknown, t: TFunction): string {
  const names = otherAdminNames(error);
  return names.length > 0
    ? t('infraExpenses.errors.selfApprovalNamed', { names: names.join(', ') })
    : t('infraExpenses.errors.selfApproval');
}

/** The duplicate-invoice message, naming the other expense's status. Null when the server didn't describe it. */
export function duplicateInvoiceMessage(error: unknown, t: TFunction): string | null {
  const data = duplicateInvoiceData(error);
  if (!data) return null;
  return t(data.source === 'EVENT' ? 'infraExpenses.errors.duplicateInvoiceEvent' : 'infraExpenses.errors.duplicateInvoice', {
    invoice: data.invoiceNumber,
    status: infraStatusLabel(data.status, t),
  });
}

/** The body of the "send back for approval" dialog when a bill is more than the approval. */
export function aboveApprovedMessage(data: AmountAboveApprovedData, t: TFunction): string {
  return t('infraExpenses.aboveApproved.body', {
    bill: formatInr(data.actualAmount),
    approved: formatInr(data.approvedAmount),
  });
}

/** The existing category a 409 CATEGORY_EXISTS points at (so a turned-off one can be turned back on), or null. */
export function categoryExistsData(error: unknown): CategoryExistsData | null {
  if (errorCode(error) !== 'CATEGORY_EXISTS') return null;
  const data = errorData(error);
  return typeof data.id === 'string' && typeof data.name === 'string' && typeof data.active === 'boolean'
    ? { id: data.id, name: data.name, active: data.active }
    : null;
}

/** A 400 REVISED_AMOUNT_BELOW_BILL, naming the bill; null for any other error. */
export function reviseBelowBillMessage(error: unknown, t: TFunction): string | null {
  if (errorCode(error) !== 'REVISED_AMOUNT_BELOW_BILL') return null;
  const bill = errorData(error).actualAmount;
  return isAmount(bill) ? t('infraExpenses.errors.reviseBelowBill', { amount: formatInr(bill) }) : null;
}

/** Who did a step: their name, else their username, else null. */
export function actorLabel(name: string | null | undefined, username: string | null | undefined): string | null {
  return name?.trim() || username?.trim() || null;
}

// ---------------------------------------------------------------------------------------------
// Dates (in the app's language; the server sends YYYY-MM-DD dates and ISO instants)

/** "11 Oct 2026" for a YYYY-MM-DD date or an ISO instant; '' when there's none. */
export function formatExpenseDate(value: string | null | undefined, locale?: string): string {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "11 Oct 2026, 4:05 pm" for an ISO instant; '' when there's none. */
export function formatExpenseTime(value: string | null | undefined, locale?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
