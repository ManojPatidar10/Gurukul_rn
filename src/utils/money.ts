/**
 * Rupee amounts: reading what someone typed, and showing an amount. The maths is done in whole paise
 * so 0.1 + 0.2 is 0.3, and nothing here uses Intl, so the output is the same on the phone (Hermes)
 * as in Jest. New screens should use this rather than toLocaleString('en-IN').
 */

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

/** Rupees to whole paise, rounded to the nearest paisa. */
export function toPaise(rupees: number): number {
  const paise = Math.round(Math.abs(rupees) * 100);
  return rupees < 0 && paise !== 0 ? -paise : paise;
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

/** The total of several rupee amounts, added in paise. */
export function sumRupees(amounts: readonly number[]): number {
  return fromPaise(amounts.reduce((total, amount) => total + toPaise(amount), 0));
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
  const paise = toPaise(amount);
  const absolute = Math.abs(paise);
  const fraction = absolute % 100;
  const whole = `${paise < 0 ? '-' : ''}${Math.floor(absolute / 100)}`;
  return fraction === 0 ? whole : `${whole}.${String(fraction).padStart(2, '0')}`;
}
