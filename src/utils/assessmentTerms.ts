import type { TermSummary } from '../api/types';

/**
 * The spelling a section already uses for this term, or null if the section has no such term yet.
 * Same rule as the server (AssessmentTerms.findExisting): the trimmed input exactly first, otherwise
 * the first term equal to it ignoring case ("term 1 " -> "Term 1"). The exact match must win: a
 * section can already hold old case variants ("Term 1" and "term 1"), and picking a different one
 * from the server would quietly move an assessment between them.
 */
export function findExistingTerm(input: string, existing: string[]): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const key = trimmed.toLowerCase();
  return existing.find((term) => term === trimmed) ?? existing.find((term) => term.toLowerCase() === key) ?? null;
}

/**
 * What to save as an assessment's term: the section's existing spelling when one matches, else the
 * trimmed input. The server does the same, so "Term 1" and "term 1" never become two report cards.
 */
export function canonicalTerm(input: string, existing: string[]): string {
  return findExistingTerm(input, existing) ?? input.trim();
}

function isoLocalDate(instant: string): string {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function instantMillis(instant: string | null | undefined): number {
  const millis = instant ? Date.parse(instant) : NaN;
  return Number.isNaN(millis) ? -Infinity : millis;
}

/**
 * Latest first: by the term's start date, or the local date it was published when the term has no
 * dates, then by when it was published. So re-publishing Term 1 after Term 2 still puts Term 2
 * first (audit L2).
 */
export function compareTermsLatestFirst(
  a: { startDate?: string | null; publishedAt?: string | null },
  b: { startDate?: string | null; publishedAt?: string | null }
): number {
  const dateA = a.startDate || (a.publishedAt ? isoLocalDate(a.publishedAt) : '');
  const dateB = b.startDate || (b.publishedAt ? isoLocalDate(b.publishedAt) : '');
  if (dateA !== dateB) return dateA < dateB ? 1 : -1;
  const millisA = instantMillis(a.publishedAt);
  const millisB = instantMillis(b.publishedAt);
  return millisA === millisB ? 0 : millisA < millisB ? 1 : -1;
}

/**
 * The term a staff screen should open on: the latest published one, else the first, else null when
 * the section has no terms yet. "Latest" goes by the term's start date, or its publish date when it
 * has no dates (compareTermsLatestFirst). An older server sends neither, so there it's the last
 * published term in the server's order, which is by name ("Annual" before "Term 1").
 */
export function defaultSectionTerm(terms: TermSummary[]): string | null {
  const published = terms.filter((t) => t.published);
  if (published.length > 0) {
    if (!published.some((t) => t.startDate || t.publishedAt)) return published[published.length - 1].term;
    return [...published].sort(compareTermsLatestFirst)[0].term;
  }
  return terms[0]?.term ?? null;
}
