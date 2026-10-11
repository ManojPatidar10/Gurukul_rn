/**
 * Rupee amounts, typed and shown one way across the app. Sums are done in whole paise (0.1 + 0.2 is
 * 0.3), digits use Indian grouping, and nothing here uses toLocaleString/Intl, so Hermes, Android and
 * Jest all print the same. New screens should use this rather than toLocaleString('en-IN').
 *
 * Two families live here, from two finance fixes, sharing toPaise/fromPaise:
 * - expenses, vendors and payroll (specs/expenses-and-vendors D9): parseInrAmount (a reason for every
 *   refusal), formatInr / formatAmount (always 2 decimals), sumInr, amountInputText.
 *   src/utils/payroll.ts re-exports toPaise/formatAmount/formatInr and reads amounts with parseInrAmount.
 * - fee payments (specs/fee-payments-in-app D7): parseRupees (null when it isn't a plain amount),
 *   formatRupees (paise only when there are some, or always), sumRupees, rupeesInputValue.
 */

/** The most a DECIMAL(12,2) column holds - ₹99,99,99,99,999.99 - in paise. */
export const MAX_AMOUNT_PAISE = 999_999_999_999;

/**
 * Rupees to whole paise, rounded to the nearest paisa, so sums don't pick up float error
 * (0.1 + 0.2 is 0.30000000000000004). Rounds the size, then signs it, so a negative amount that
 * rounds to nothing is 0, never -0.
 */
export function toPaise(amount: number): number {
  const paise = Math.round(Math.abs(amount) * 100);
  return amount < 0 && paise !== 0 ? -paise : paise;
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** Adds rupee amounts in paise. Null and missing values count as 0. */
export function sumInr(values: readonly (number | null | undefined)[]): number {
  return fromPaise(values.reduce<number>((total, value) => total + toPaise(value ?? 0), 0));
}

/** 412500 -> "4,12,500.00": Indian digit grouping, always 2 decimals. */
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

/** 412500 -> "₹4,12,500.00", -500 -> "-₹500.00", and `empty` ("—") when there's no amount. */
export function formatInr(amount: number | null | undefined, empty = '—'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return empty;
  const text = formatAmount(amount);
  return text.startsWith('-') ? `-₹${text.slice(1)}` : `₹${text}`;
}

export type AmountProblem = 'empty' | 'invalid' | 'negative' | 'zero' | 'decimals' | 'tooLarge';

export type ParsedInrAmount = { ok: true; value: number; paise: number } | { ok: false; problem: AmountProblem };

export interface ParseInrOptions {
  /** The largest amount accepted, in paise. Defaults to MAX_AMOUNT_PAISE. */
  maxPaise?: number;
  /** Accept 0 (otherwise it's the 'zero' problem). */
  allowZero?: boolean;
}

/**
 * A typed amount, like "15000", "15,000", "₹ 1,23,456.5" or "Rs. 2500". Spaces, commas and a
 * leading ₹/Rs/Rs. are ignored. Only digits with an optional decimal part are accepted - no "1e5",
 * "0x10" or letters - and at most 2 decimals once trailing zeros are dropped ("100.500" is fine).
 */
export function parseInrAmount(
  text: string,
  { maxPaise = MAX_AMOUNT_PAISE, allowZero = false }: ParseInrOptions = {}
): ParsedInrAmount {
  let cleaned = (text ?? '').replace(/[\s,]/g, '');
  if (cleaned === '') return { ok: false, problem: 'empty' };

  let negative = false;
  if (cleaned.startsWith('-')) {
    negative = true;
    cleaned = cleaned.slice(1);
  }
  cleaned = cleaned.replace(/^(₹|rs\.?)/i, '');
  if (!negative && cleaned.startsWith('-')) {
    negative = true;
    cleaned = cleaned.slice(1);
  }

  const match = /^(\d*)(?:\.(\d*))?$/.exec(cleaned);
  if (!match || (!match[1] && !match[2])) return { ok: false, problem: 'invalid' };
  const [, whole, rawFraction = ''] = match;
  const fraction = rawFraction.replace(/0+$/, '');
  const paise = Number(whole || '0') * 100 + Number(fraction.padEnd(2, '0').slice(0, 2));

  if (negative && paise > 0) return { ok: false, problem: 'negative' };
  if (fraction.length > 2) return { ok: false, problem: 'decimals' };
  if (paise === 0 && !allowZero) return { ok: false, problem: 'zero' };
  if (paise > maxPaise) return { ok: false, problem: 'tooLarge' };
  return { ok: true, value: fromPaise(paise), paise };
}

/** The i18n key that says what's wrong with a typed amount. */
export function amountProblemKey(problem: AmountProblem): string {
  return `money.errors.${problem}`;
}

/** An amount for prefilling an input: 15000 -> "15000", 15000.5 -> "15000.50", none -> "". */
export function amountInputText(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return '';
  const paise = toPaise(amount);
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const fraction = abs % 100;
  const text = fraction === 0 ? String(rupees) : `${rupees}.${String(fraction).padStart(2, '0')}`;
  return paise < 0 ? `-${text}` : text;
}

// ---- Fee payments (specs/fee-payments-in-app D7) ----

// Up to 10 rupee digits (the backend's DECIMAL(12, 2)) and at most 2 paise digits.
const AMOUNT = /^\d{1,10}(\.\d{1,2})?$/;
// A leading ₹, "Rs" or "Rs." that people often type or paste along with the number.
const CURRENCY_PREFIX = /^(₹|rs\.?)/i;

/**
 * The amount someone typed, in rupees, or null when it isn't a plain amount. Accepts "15000",
 * "15,000", "1,50,000.5" and " ₹ 2,500 "; refuses more than 2 decimals ("100.555"), signs,
 * exponents, hex and anything else - an amount is never silently rounded. "0" parses to 0, so
 * callers still check the minimum.
 */
export function parseRupees(input: string | null | undefined): number | null {
  if (input == null) return null;
  const cleaned = String(input).trim().replace(CURRENCY_PREFIX, '').replace(/[,\s]/g, '');
  if (!AMOUNT.test(cleaned)) return null;
  const [whole, fraction = ''] = cleaned.split('.');
  return fromPaise(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}

/** The total of several rupee amounts, added in paise. */
export function sumRupees(amounts: readonly number[]): number {
  return sumInr(amounts);
}

/** "12345678" -> "1,23,45,678": the last 3 digits, then groups of 2 (lakh and crore). */
function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const groups = [digits.slice(-3)];
  let rest = digits.slice(0, -3);
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return groups.join(',');
}

export interface FormatRupeesOptions {
  /** 'auto' (default) shows paise only when there are some; 'always' shows ".00" too. */
  decimals?: 'auto' | 'always';
  /** Include the ₹ sign (default true). Pass false where the text around it already has one. */
  symbol?: boolean;
}

/**
 * An amount for display, rounded to the paisa first: 1500 -> "₹1,500", 1500.5 -> "₹1,500.50",
 * 12345678.9 -> "₹1,23,45,678.90", -2500 -> "-₹2,500". A missing amount shows as "—".
 */
export function formatRupees(amount: number | null | undefined, options: FormatRupeesOptions = {}): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const { decimals = 'auto', symbol = true } = options;
  const paise = toPaise(amount);
  const absolute = Math.abs(paise);
  const fraction = absolute % 100;
  let text = groupIndian(String(Math.floor(absolute / 100)));
  if (decimals === 'always' || fraction !== 0) text += `.${String(fraction).padStart(2, '0')}`;
  return `${paise < 0 ? '-' : ''}${symbol ? '₹' : ''}${text}`;
}

/** An amount as an input's starting text, with no grouping: 15000 -> "15000", 15000.5 -> "15000.50". */
export function rupeesInputValue(amount: number): string {
  return amountInputText(amount);
}
