import type { AcademicTerm, AcademicTermRequest, PublishedTerm, TermSummary } from '../api/types';
import { compareTermsLatestFirst, findExistingTerm } from './assessmentTerms';

/** The server's limits (AcademicTermService). */
export const MAX_TERM_NAME_LENGTH = 50;
export const MAX_ACADEMIC_YEAR_LENGTH = 20;

/** Two names with the same key are the same term: the server's name_key, lower(trim(name)). */
export function termKey(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/**
 * True when GET /academic-terms failed because the server has no such endpoint (an older server):
 * that means "no terms set up", not an error to show.
 */
export function isTermListMissing(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === 404;
}

/** The Terms screen's add/edit form. Dates are 'YYYY-MM-DD', or '' when not set. */
export interface TermDraft {
  name: string;
  startDate: string;
  endDate: string;
  academicYear: string;
}

export function termDraft(term?: AcademicTerm | null): TermDraft {
  return {
    name: term?.name ?? '',
    startDate: term?.startDate ?? '',
    endDate: term?.endDate ?? '',
    academicYear: term?.academicYear ?? '',
  };
}

/** The request for a draft. PUT is a full replace, so an empty date or year is sent as null to clear it. */
export function termRequest(draft: TermDraft): AcademicTermRequest {
  return {
    name: draft.name.trim(),
    startDate: draft.startDate.trim() || null,
    endDate: draft.endDate.trim() || null,
    academicYear: draft.academicYear.trim() || null,
  };
}

/**
 * Null if the draft can be saved, otherwise an i18n key saying why not (`academicTerms.errors.*`;
 * `duplicate` takes `{ name }`). The same rules as the server: a name of at most 50 characters
 * that no other term of the school has (ignoring case), both dates or neither, the end on or after
 * the start, and an academic year of at most 20 characters.
 */
export function validateTermDraft(draft: TermDraft, terms: AcademicTerm[], editingId: string | null): string | null {
  const name = draft.name.trim();
  if (!name) return 'academicTerms.errors.nameRequired';
  if (name.length > MAX_TERM_NAME_LENGTH) return 'academicTerms.errors.nameTooLong';
  const key = termKey(name);
  if (terms.some((t) => t.id !== editingId && termKey(t.name) === key)) return 'academicTerms.errors.duplicate';
  const start = draft.startDate.trim();
  const end = draft.endDate.trim();
  if (!start !== !end) return 'academicTerms.errors.bothDates';
  // ISO dates compare correctly as text.
  if (start && end && end < start) return 'academicTerms.errors.endBeforeStart';
  if (draft.academicYear.trim().length > MAX_ACADEMIC_YEAR_LENGTH) return 'academicTerms.errors.yearTooLong';
  return null;
}

/** Assessments or publications use the term, so the server refuses renaming or deleting it. */
export function termInUse(term: Pick<AcademicTerm, 'assessmentCount' | 'publishedSectionCount'>): boolean {
  return (term.assessmentCount ?? 0) > 0 || (term.publishedSectionCount ?? 0) > 0;
}

function localDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

/** "1 Apr – 30 Sep 2026" (the year once when both dates share it), or null for an undated term. */
export function formatTermDates(
  term: { startDate?: string | null; endDate?: string | null },
  locale?: string
): string | null {
  if (!term.startDate || !term.endDate) return null;
  const start = localDate(term.startDate);
  const end = localDate(term.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const withYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const sameYear = start.getFullYear() === end.getFullYear();
  const from = start.toLocaleDateString(locale, sameYear ? { day: 'numeric', month: 'short' } : withYear);
  return `${from} – ${end.toLocaleDateString(locale, withYear)}`;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The server's order: start date ascending (undated terms last), then name ignoring case. */
export function sortTerms<T extends { name: string; startDate: string | null }>(terms: T[]): T[] {
  return [...terms].sort((a, b) => {
    if (a.startDate !== b.startDate) {
      if (!a.startDate) return 1;
      if (!b.startDate) return -1;
      return compareText(a.startDate, b.startDate);
    }
    return compareText(a.name.toLowerCase(), b.name.toLowerCase());
  });
}

/** The listed term this term is, ignoring case and stray spaces, or null. */
export function matchListedTerm(term: string | null | undefined, listed: AcademicTerm[]): AcademicTerm | null {
  const key = termKey(term);
  if (!key) return null;
  return listed.find((t) => termKey(t.name) === key) ?? null;
}

/** A term chip on the assessment form or the publish screen. */
export interface TermChoice {
  /** What to save or publish: the section's own spelling when it already has one, else the listed name. */
  term: string;
  /** The school's listed term, or null for an old term that isn't on the list. */
  listed: AcademicTerm | null;
  /** The section's summary of the term, or null when none of its assessments use it. */
  summary: TermSummary | null;
  /** Report cards for the term are published in this section, so it's locked. */
  published: boolean;
  /** Some assessment in the section uses the term. */
  hasAssessments: boolean;
}

function listedChoice(listed: AcademicTerm, sectionTerms: TermSummary[]): TermChoice {
  const key = termKey(listed.name);
  // A section that spelt the term before the list existed ("term 1") keeps its spelling: the server
  // saves that one too, and one section must never hold two spellings of a term.
  const spelling = findExistingTerm(listed.name, sectionTerms.map((t) => t.term));
  const summary = spelling === null ? null : (sectionTerms.find((t) => t.term === spelling) ?? null);
  return {
    term: spelling ?? listed.name,
    listed,
    summary,
    published: sectionTerms.some((t) => t.published && termKey(t.term) === key),
    hasAssessments: summary !== null,
  };
}

function oldChoice(summary: TermSummary): TermChoice {
  return { term: summary.term, listed: null, summary, published: summary.published, hasAssessments: true };
}

/**
 * The assessment form's term chips once the school has a term list: every listed term in order,
 * marked published from the section's terms, plus the assessment's current term when it's an old
 * one not on the list (the server keeps it on edit).
 */
export function formTermChoices(
  listed: AcademicTerm[],
  sectionTerms: TermSummary[],
  currentTerm: string | null | undefined
): TermChoice[] {
  const choices = sortTerms(listed).map((t) => listedChoice(t, sectionTerms));
  if (currentTerm && currentTerm.trim() && !matchListedTerm(currentTerm, listed)) {
    const key = termKey(currentTerm);
    const summary =
      sectionTerms.find((t) => t.term === currentTerm) ?? sectionTerms.find((t) => termKey(t.term) === key) ?? null;
    // The stored spelling is sent back as it is: the server keeps an old term only when it's unchanged.
    choices.push({
      term: currentTerm,
      listed: null,
      summary,
      published: summary?.published ?? false,
      hasAssessments: true,
    });
  }
  return choices;
}

/**
 * The publish screen's term chips. With a term list: the listed terms in order (a listed term no
 * assessment here uses can't be published), then the section's old terms that aren't listed.
 * Without one: the section's terms, as before.
 */
export function publishTermChoices(listed: AcademicTerm[], sectionTerms: TermSummary[]): TermChoice[] {
  if (listed.length === 0) return sectionTerms.map(oldChoice);
  const listedKeys = new Set(listed.map((t) => termKey(t.name)));
  return [
    ...sortTerms(listed).map((t) => listedChoice(t, sectionTerms)),
    ...sectionTerms.filter((t) => !listedKeys.has(termKey(t.term))).map(oldChoice),
  ];
}

/**
 * The published term the report card opens on. The server already sends them latest first; this
 * also orders an older server's list, which has no dates.
 */
export function latestPublishedTerm(publishedTerms: PublishedTerm[]): PublishedTerm | null {
  if (publishedTerms.length === 0) return null;
  return [...publishedTerms].sort(compareTermsLatestFirst)[0];
}

/**
 * A published term's chip label: the term, plus its class when the same term was published for
 * more than one of the student's classes, or it's from an earlier class (after promotion).
 */
export function publishedTermLabel(entry: PublishedTerm, all: PublishedTerm[]): string {
  const key = termKey(entry.term);
  const repeated = all.filter((other) => termKey(other.term) === key).length > 1;
  if ((repeated || entry.current === false) && entry.className) {
    return `${entry.term} · ${[entry.className, entry.section].filter(Boolean).join(' ')}`;
  }
  return entry.term;
}

/** One term chip on the report card screen. */
export interface ReportCardTermChip {
  /** `classSectionId:term` - the same term can be published for two of the student's classes. */
  key: string;
  term: string;
  /** The class the card is for. Left out, the server picks (it prefers the current class). */
  sectionId?: string;
  label: string;
  published: boolean;
}

export function termChipKey(term: string, sectionId?: string | null): string {
  return `${sectionId ?? ''}:${term}`;
}

/**
 * The report card's term chips: every published term (students and parents get only these), and
 * for staff also the listed terms not published in the student's current class, which open a draft.
 */
export function reportCardTermChips(
  publishedTerms: PublishedTerm[],
  listed: AcademicTerm[],
  includeDrafts: boolean
): ReportCardTermChip[] {
  const chips: ReportCardTermChip[] = publishedTerms.map((entry) => ({
    key: termChipKey(entry.term, entry.classSectionId),
    term: entry.term,
    sectionId: entry.classSectionId,
    label: publishedTermLabel(entry, publishedTerms),
    published: true,
  }));
  if (!includeDrafts) return chips;
  // An older server leaves `current` out: it lists only the current class's publications.
  const publishedHere = new Set(publishedTerms.filter((e) => e.current !== false).map((e) => termKey(e.term)));
  sortTerms(listed)
    .filter((t) => !publishedHere.has(termKey(t.name)))
    .forEach((t) => chips.push({ key: termChipKey(t.name), term: t.name, label: t.name, published: false }));
  return chips;
}
