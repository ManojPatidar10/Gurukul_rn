/**
 * Rupee amounts, typed and shown one way on the expense, vendor and payroll screens
 * (specs/expenses-and-vendors D9): sums in whole paise, Indian digit grouping, always 2 decimals.
 * Done by hand rather than with toLocaleString/Intl, so Hermes, Android and Jest all print the same.
 * The format and parse rules match formatInr/parseAmount in fix 2's src/utils/payroll.ts.
 */

/** The most a DECIMAL(12,2) column holds - ₹99,99,99,99,999.99 - in paise. */
export const MAX_AMOUNT_PAISE = 999_999_999_999;

/** Rupees to whole paise, so sums don't pick up float error (0.1 + 0.2 is 0.30000000000000004). */
export function toPaise(amount: number): number {
  return Math.round(amount * 100);
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
