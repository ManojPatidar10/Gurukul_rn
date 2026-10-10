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

/**
 * The term a staff screen should open on: the latest published one, else the first, else null when
 * the section has no terms yet. "Latest" is the last in the server's order, which is by term name
 * (Term 2 after Term 1), not by publish date: terms carry no dates yet, so "Annual" sorts before
 * "Term 1" and "Term 10" before "Term 2". Picking by date needs publishedAt on TermSummary, or the
 * school-wide dated term list in specs/report-card-publish-safety/questions.md Q1.
 */
export function defaultSectionTerm(terms: TermSummary[]): string | null {
  const published = terms.filter((t) => t.published);
  if (published.length > 0) return published[published.length - 1].term;
  return terms[0]?.term ?? null;
}
