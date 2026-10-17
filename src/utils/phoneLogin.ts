import type { SchoolSearchResult } from '../api/types';

/**
 * The typed number as the school would have saved it. People type "+91 70679 35654" or
 * "070679-35654"; the schools store ten plain digits, and the server matches the string exactly.
 * Only a prefix that leaves a 10-digit number is dropped - anything else is sent as typed, so a
 * number stored in some other shape still has a chance of matching.
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[\s\-().]/g, '').replace(/^\+/, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

export type PhoneLookupOutcome =
  | { kind: 'none' }
  | { kind: 'single'; school: SchoolSearchResult }
  | { kind: 'choose'; schools: SchoolSearchResult[] };

/**
 * Where the phone-first login goes after the server says which schools know the number: nowhere
 * (not registered anywhere), straight to that one school's OTP, or a choice between schools.
 */
export function phoneLookupOutcome(schools: SchoolSearchResult[]): PhoneLookupOutcome {
  if (schools.length === 0) return { kind: 'none' };
  if (schools.length === 1) return { kind: 'single', school: schools[0] };
  return { kind: 'choose', schools };
}
