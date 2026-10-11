import type { TFunction } from 'i18next';

import type {
  PayrollLine,
  PayrollLineStatus,
  PayrollLineWarning,
  PayrollLineWarningCode,
  PayrollPaymentMethod,
  PayrollPayRequest,
  PayrollRunDetail,
  PayrollRunStatus,
  PayrollSkipReason,
  PayrollSkippedEmployee,
  Payslip,
  SalaryStructure,
} from '../api/types';

/**
 * Payroll decisions the screens share (specs/payroll-runs): money maths in whole paise, the words
 * for every status, reason and warning, which run actions show, and the payment date limits. Pure,
 * so it's unit-tested in src/__tests__/payroll.test.ts.
 */

/** How salary can be recorded as paid: the backend's PaymentMethod enum. No card - salaries aren't paid by card. */
export const PAYROLL_PAYMENT_METHODS: readonly PayrollPaymentMethod[] = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE'];

// The fee screens' labels for the same methods.
const PAYMENT_METHOD_KEYS: Record<PayrollPaymentMethod, string> = {
  CASH: 'fees.paymentMethods.cash',
  UPI: 'fees.paymentMethods.upi',
  BANK_TRANSFER: 'fees.paymentMethods.bankTransfer',
  CHEQUE: 'fees.paymentMethods.cheque',
};

/** "Bank transfer" for BANK_TRANSFER. A method a newer server adds shows as sent. */
export function paymentMethodLabel(method: string | null | undefined, t: TFunction): string {
  if (!method) return '';
  const key = PAYMENT_METHOD_KEYS[method as PayrollPaymentMethod] as string | undefined;
  return key ? t(key) : method;
}

export function paymentMethodOptions(t: TFunction): { label: string; value: PayrollPaymentMethod }[] {
  return PAYROLL_PAYMENT_METHODS.map((value) => ({ label: t(PAYMENT_METHOD_KEYS[value]), value }));
}

// ---------------------------------------------------------------------------------------------
// Money

/** Rupees to whole paise, so sums don't pick up float error (0.1 + 0.2 is 0.30000000000000004). */
export function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

/** basic + allowances - deductions in rupees, added up in paise. Null parts count as 0. */
export function structureNet(basic: number, allowances?: number | null, deductions?: number | null): number {
  return (toPaise(basic) + toPaise(allowances ?? 0) - toPaise(deductions ?? 0)) / 100;
}

/** 412500 -> "4,12,500.00": Indian digit grouping, always 2 decimals, done by hand so every engine agrees. */
export function formatAmount(amount: number): string {
  const paise = toPaise(amount);
  const abs = Math.abs(paise);
  const rupees = String(Math.floor(abs / 100));
  const fraction = String(abs % 100).padStart(2, '0');
  const lastThree = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  return `${paise < 0 ? '-' : ''}${grouped}.${fraction}`;
}

/** 412500 -> "₹4,12,500.00", -500 -> "-₹500.00". */
export function formatInr(amount: number): string {
  const text = formatAmount(amount);
  return text.startsWith('-') ? `-₹${text.slice(1)}` : `₹${text}`;
}

// ---------------------------------------------------------------------------------------------
// Salary structure form

/** The most one part of a structure can be: ₹10,00,000 a month, in paise (the server's limit). */
export const MAX_STRUCTURE_AMOUNT_PAISE = 100_000_000;

export type StructureAmountField = 'basic' | 'allowances' | 'deductions';

/** The three amounts as typed. Blank allowances or deductions mean 0. */
export interface StructureAmountInput {
  basic: string;
  allowances: string;
  deductions: string;
}

/** `key` is an i18n key; it may use {{field}}, the field's label (see structureErrorText). */
export interface StructureAmountError {
  field: StructureAmountField | 'net';
  key: string;
}

type ParsedAmount =
  | { ok: true; paise: number }
  | { ok: false; problem: 'empty' | 'invalid' | 'negative' | 'decimals' | 'tooLarge' };

/** A typed amount, like "25000", "25,000" or "2500.50". Commas and spaces are ignored. */
export function parseAmount(text: string): ParsedAmount {
  const cleaned = text.replace(/[\s,]/g, '');
  if (cleaned === '') return { ok: false, problem: 'empty' };
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (!match[2] && !match[3])) return { ok: false, problem: 'invalid' };
  const [, sign, whole, rawFraction = ''] = match;
  const fraction = rawFraction.replace(/0+$/, '');
  const paise = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));
  if (sign && paise > 0) return { ok: false, problem: 'negative' };
  if (fraction.length > 2) return { ok: false, problem: 'decimals' };
  if (paise > MAX_STRUCTURE_AMOUNT_PAISE) return { ok: false, problem: 'tooLarge' };
  return { ok: true, paise };
}

const FORM_ERRORS = 'payroll.salaryStructureForm.errors';

function amountError(field: StructureAmountField, parsed: ParsedAmount): StructureAmountError | null {
  if (parsed.ok) return field === 'basic' && parsed.paise === 0 ? { field, key: `${FORM_ERRORS}.basic` } : null;
  switch (parsed.problem) {
    case 'empty':
      return field === 'basic' ? { field, key: `${FORM_ERRORS}.basic` } : null;
    case 'negative':
      return { field, key: `${FORM_ERRORS}.${field}` };
    case 'decimals':
      return { field, key: `${FORM_ERRORS}.decimals` };
    case 'tooLarge':
      return { field, key: `${FORM_ERRORS}.tooLarge` };
    default:
      return { field, key: `${FORM_ERRORS}.notANumber` };
  }
}

/**
 * What's wrong with the amounts, as the server would refuse them: basic more than 0, nothing
 * negative, at most 2 decimals, each at most ₹10,00,000, and net pay more than 0. Empty when they're fine.
 */
export function validateStructureAmounts(input: StructureAmountInput): StructureAmountError[] {
  const fields: StructureAmountField[] = ['basic', 'allowances', 'deductions'];
  const errors = fields
    .map((field) => amountError(field, parseAmount(input[field])))
    .filter((e): e is StructureAmountError => e !== null);
  if (errors.length > 0) return errors;
  const net = structureNetPreview(input);
  return net !== null && net <= 0 ? [{ field: 'net', key: `${FORM_ERRORS}.netNotPositive` }] : [];
}

/** Net pay in rupees for the live preview, or null until basic and the other parts are numbers. */
export function structureNetPreview(input: StructureAmountInput): number | null {
  const paise = (text: string, blankIsZero: boolean): number | null => {
    const parsed = parseAmount(text);
    if (parsed.ok) return parsed.paise;
    if (parsed.problem === 'empty') return blankIsZero ? 0 : null;
    if (parsed.problem === 'negative') {
      const positive = parseAmount(text.replace('-', ''));
      return positive.ok ? -positive.paise : null;
    }
    return null;
  };
  const basic = paise(input.basic, false);
  const allowances = paise(input.allowances, true);
  const deductions = paise(input.deductions, true);
  if (basic === null || allowances === null || deductions === null) return null;
  return (basic + allowances - deductions) / 100;
}

/** The amounts to send, once validateStructureAmounts finds nothing wrong. */
export function structureAmounts(input: StructureAmountInput): { basic: number; allowances: number; deductions: number } | null {
  if (validateStructureAmounts(input).length > 0) return null;
  const rupees = (text: string) => {
    const parsed = parseAmount(text);
    return parsed.ok ? parsed.paise / 100 : 0;
  };
  return { basic: rupees(input.basic), allowances: rupees(input.allowances), deductions: rupees(input.deductions) };
}

/** An amount from a saved structure, as the form shows it: "25000" or "2500.5". */
export function amountInputText(amount: number | null | undefined): string {
  return amount == null ? '' : String(toPaise(amount) / 100);
}

export function structureErrorText(error: StructureAmountError, t: TFunction): string {
  const field = error.field === 'net' ? '' : t(`payroll.salaryStructureForm.${error.field}`);
  return t(error.key, { field });
}

/** The structure a "Fix salary structure" should open for editing, or null to add a new one instead. */
export function structureToEdit(structures: SalaryStructure[], structureId: string | null): SalaryStructure | null {
  if (!structureId) return null;
  const found = structures.find((s) => s.id === structureId);
  return found && found.editable ? found : null;
}

// ---------------------------------------------------------------------------------------------
// Words for statuses, reasons and warnings

export const PAYROLL_RUN_STATUSES: readonly PayrollRunStatus[] = ['DRAFT', 'PROCESSED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
export const PAYROLL_LINE_STATUSES: readonly PayrollLineStatus[] = ['PAID', 'PENDING', 'ON_HOLD'];
export const PAYROLL_SKIP_REASONS: readonly PayrollSkipReason[] = [
  'NO_STRUCTURE',
  'STRUCTURE_STARTS_AFTER_MONTH',
  'NET_NOT_POSITIVE',
  'NOT_IN_RUN',
];
export const PAYROLL_WARNING_CODES: readonly PayrollLineWarningCode[] = [
  'STRUCTURE_STARTS_MID_MONTH',
  'STRUCTURE_CHANGED_MID_MONTH',
  'JOINED_MID_MONTH',
  'JOINED_AFTER_MONTH',
  'NEGATIVE_COMPONENT',
];

/** StatusChip's variants. */
export type PayrollChipVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

/** "June", or the number for a month outside 1-12. */
export function monthName(month: number, t: TFunction): string {
  return Number.isInteger(month) && month >= 1 && month <= 12 ? t(`payroll.run.months.${month}`) : String(month);
}

/** "June 2026". */
export function runMonthLabel(month: number, year: number, t: TFunction): string {
  return `${monthName(month, t)} ${year}`;
}

/** "2026-07-01" -> "1 July 2026". Anything that isn't a YYYY-MM-DD date shows as sent. */
export function formatPayrollDate(iso: string, t: TFunction): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${monthName(Number(match[2]), t)} ${match[1]}`;
}

/** "Ready to pay" for PROCESSED. A status a newer server adds shows as sent. */
export function runStatusLabel(status: string, t: TFunction): string {
  return (PAYROLL_RUN_STATUSES as readonly string[]).includes(status) ? t(`payroll.runStatus.${status}`) : status;
}

export function runStatusVariant(status: string): PayrollChipVariant {
  switch (status) {
    case 'PROCESSED':
      return 'info';
    case 'PARTIALLY_PAID':
      return 'warning';
    case 'PAID':
      return 'success';
    case 'CANCELLED':
      return 'error';
    default:
      return 'neutral';
  }
}

/**
 * "Paid", "Not paid yet" or "On hold". Only an admin is told a line is on hold (`showHold`):
 * to the employee it's simply not paid yet.
 */
export function lineStatusLabel(status: string, t: TFunction, showHold = true): string {
  const shown = status === 'ON_HOLD' && !showHold ? 'PENDING' : status;
  return (PAYROLL_LINE_STATUSES as readonly string[]).includes(shown) ? t(`payroll.lineStatus.${shown}`) : status;
}

export function lineStatusVariant(status: string, showHold = true): PayrollChipVariant {
  if (status === 'PAID') return 'success';
  if (status === 'ON_HOLD' && showHold) return 'neutral';
  return 'warning';
}

/** Why an active employee was left out of the run, in plain words. */
export function skipReasonText(skipped: PayrollSkippedEmployee, t: TFunction): string {
  if (!(PAYROLL_SKIP_REASONS as readonly string[]).includes(skipped.reason)) return skipped.reason;
  return t(`payroll.run.skipReason.${skipped.reason}`, {
    date: skipped.date ? formatPayrollDate(skipped.date, t) : '—',
    net: formatInr(skipped.net ?? 0),
  });
}

/** A line's warning in plain words, with its date. An unknown code shows as sent. */
export function lineWarningText(warning: PayrollLineWarning, t: TFunction): string {
  if (!(PAYROLL_WARNING_CODES as readonly string[]).includes(warning.code)) return warning.code;
  return t(`payroll.run.warning.${warning.code}`, {
    date: warning.date ? formatPayrollDate(warning.date, t) : '—',
  });
}

/** "Paid on 1 July 2026", or "Not paid yet" (an admin sees "On hold" for a held line). */
export function payslipStatusText(payslip: Pick<Payslip, 'status' | 'paidOn'>, isAdmin: boolean, t: TFunction): string {
  if (payslip.status === 'PAID' && payslip.paidOn) {
    return t('payroll.payslip.paidOn', { date: formatPayrollDate(payslip.paidOn, t) });
  }
  return lineStatusLabel(payslip.status, t, isAdmin);
}

// ---------------------------------------------------------------------------------------------
// Run screen

type RunState = Pick<PayrollRunDetail, 'status' | 'paidLineCount' | 'payableLineCount' | 'paymentDateMin' | 'paymentDateMax'>;

export interface RunActions {
  /** A legacy run for a month that hasn't started, not cancelled yet: it can only be cancelled. */
  futureMonth: boolean;
  process: boolean;
  recalculate: boolean;
  cancel: boolean;
  /** Create the cancelled month's run again (the server reopens the same run as a draft). */
  runAgain: boolean;
  /** A cancelled run for a month that hasn't started: it can be run again once the month starts. */
  runAgainLater: boolean;
  /** Hold or release unpaid lines. */
  hold: boolean;
  pay: boolean;
}

/**
 * Which buttons and notes the run screen shows, matching what the server allows. A run with paid
 * salary can't be cancelled or recalculated once fully paid - but a legacy PAID run with no paid
 * lines moved no money, so it can be either.
 */
export function runActions(run: RunState): RunActions {
  const future = run.paymentDateMin > run.paymentDateMax;
  const cancelled = run.status === 'CANCELLED';
  const payable = run.status === 'PROCESSED' || run.status === 'PARTIALLY_PAID';
  return {
    futureMonth: future && !cancelled,
    process: run.status === 'DRAFT' && !future,
    recalculate: !future && (payable || (run.status === 'PAID' && run.paidLineCount === 0)),
    cancel: !cancelled && run.paidLineCount === 0,
    runAgain: cancelled && !future,
    runAgainLater: cancelled && future,
    hold: payable,
    pay: payable && run.payableLineCount > 0 && !future,
  };
}

/**
 * The Hold / Release button on a line, or null when the line can't be held (it's paid, or the run
 * doesn't allow holds). `label` names the employee, for screen readers.
 */
export function lineHoldButton(
  line: Pick<PayrollLine, 'employeeName' | 'held' | 'status'>,
  actions: Pick<RunActions, 'hold'>,
  t: TFunction
): { text: string; label: string } | null {
  if (!actions.hold || line.status === 'PAID') return null;
  return line.held
    ? { text: t('payroll.run.release'), label: t('payroll.run.releaseFor', { name: line.employeeName }) }
    : { text: t('payroll.run.hold'), label: t('payroll.run.holdFor', { name: line.employeeName }) };
}

export interface PaymentDateBounds {
  /** The run month's 1st. */
  min: string;
  /** Today in India. */
  max: string;
  /** False for a future-month run: no date is allowed. */
  valid: boolean;
  /** `today` kept within min..max. */
  defaultDate: string;
}

/** The dates salary for this run can be recorded as paid on. `today` is localToday(). */
export function paymentDateBounds(run: Pick<PayrollRunDetail, 'paymentDateMin' | 'paymentDateMax'>, today: string): PaymentDateBounds {
  const min = run.paymentDateMin;
  const max = run.paymentDateMax;
  const defaultDate = today < min ? min : today > max ? max : today;
  return { min, max, valid: min <= max, defaultDate };
}

/** The months payroll can be run for: this year and the two before, and no month after today's. Newest year first. */
export function runMonthOptions(today: string): { year: number; months: number[] }[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return [year, year - 1, year - 2].map((y) => ({
    year: y,
    months: Array.from({ length: y === year ? month : 12 }, (_, i) => i + 1),
  }));
}

/** The pay call for what the confirmation showed, so the server refuses it if the run changed since. */
export function payRequest(
  run: Pick<PayrollRunDetail, 'payableLineCount' | 'payableNet'>,
  paymentMethod: PayrollPaymentMethod,
  paymentReference: string,
  transactionDate: string
): PayrollPayRequest {
  const reference = paymentReference.trim();
  return {
    paymentMethod,
    paymentReference: reference ? reference : null,
    transactionDate,
    expectedPayableLineCount: run.payableLineCount,
    expectedPayableNet: run.payableNet,
  };
}

/** The pay confirmation: the total, how many staff, the method and date, and who's on hold. */
export function payConfirmation(
  run: Pick<PayrollRunDetail, 'payableLineCount' | 'payableNet' | 'heldLineCount'>,
  paymentMethod: PayrollPaymentMethod,
  transactionDate: string,
  t: TFunction
): { title: string; body: string } {
  const parts = [
    t('payroll.run.payConfirmBody', {
      total: formatInr(run.payableNet),
      count: run.payableLineCount,
      method: paymentMethodLabel(paymentMethod, t),
      date: formatPayrollDate(transactionDate, t),
    }),
  ];
  if (run.heldLineCount > 0) parts.push(t('payroll.run.payConfirmHeld', { count: run.heldLineCount }));
  parts.push(t('payroll.run.payConfirmUndo'));
  return { title: t('payroll.run.payConfirmTitle'), body: parts.join(' ') };
}

export type SkippedAction = 'ADD_STRUCTURE' | 'FIX_STRUCTURE' | 'RECALCULATE' | null;

/** What the "Left out" row offers: add a structure, fix the one that's wrong, or recalculate to add them. */
export function skippedAction(skipped: PayrollSkippedEmployee, actions: RunActions): SkippedAction {
  switch (skipped.reason) {
    case 'NO_STRUCTURE':
      return 'ADD_STRUCTURE';
    case 'NET_NOT_POSITIVE':
    case 'STRUCTURE_STARTS_AFTER_MONTH':
      return 'FIX_STRUCTURE';
    case 'NOT_IN_RUN':
      return actions.recalculate ? 'RECALCULATE' : null;
    default:
      return null;
  }
}

/**
 * The `data` of a refusal carrying this errorCode (an ApiError from the client), {} when it sent
 * none, or null for any other error. Structural, so this file needn't import the API client.
 */
export function conflictData(error: unknown, errorCode: string): Record<string, unknown> | null {
  if (!error || typeof error !== 'object' || (error as { errorCode?: unknown }).errorCode !== errorCode) return null;
  const data = (error as { data?: unknown }).data;
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
}
