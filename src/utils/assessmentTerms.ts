import type { TermSummary } from '../api/types';

/**
 * The spelling a section already uses for this term, matched case-insensitively after trimming
 * ("term 1 " -> "Term 1"), or null if the section has no such term yet.
 */
export function findExistingTerm(input: string, existing: string[]): string | null {
  const key = input.trim().toLowerCase();
  if (!key) return null;
  return existing.find((term) => term.trim().toLowerCase() === key) ?? null;
}

/**
 * What to save as an assessment's term: the section's existing spelling when one matches, else the
 * trimmed input. The server does the same, so "Term 1" and "term 1" never become two report cards.
 */
export function canonicalTerm(input: string, existing: string[]): string {
  return findExistingTerm(input, existing) ?? input.trim();
}

/**
 * The term a staff screen should open on: the latest published one, else the first, else null when
 * the section has no terms yet. "Latest" is by the server's order (term name, so Term 2 comes after
 * Term 1) - terms have no dates yet.
 */
export function defaultSectionTerm(terms: TermSummary[]): string | null {
  const published = terms.filter((t) => t.published);
  if (published.length > 0) return published[published.length - 1].term;
  return terms[0]?.term ?? null;
}
