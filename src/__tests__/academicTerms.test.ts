import { ApiError } from '../api/client';
import type { AcademicTerm, TermSummary } from '../api/types';
import {
  formatTermDates,
  formTermChoices,
  isTermListMissing,
  matchListedTerm,
  publishTermChoices,
  sortTerms,
  termDraft,
  termInUse,
  termRequest,
  validateTermDraft,
  type TermDraft,
} from '../utils/academicTerms';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function term(name: string, overrides: Partial<AcademicTerm> = {}): AcademicTerm {
  return {
    id: `id-${name}`,
    name,
    startDate: null,
    endDate: null,
    academicYear: null,
    assessmentCount: 0,
    publishedSectionCount: 0,
    ...overrides,
  };
}

function summary(name: string, published = false, overrides: Partial<TermSummary> = {}): TermSummary {
  return { term: name, published, ...overrides };
}

function draft(overrides: Partial<TermDraft> = {}): TermDraft {
  return { name: 'Term 3', startDate: '', endDate: '', academicYear: '', ...overrides };
}

const TERMS = [
  term('Term 1', { startDate: '2026-04-01', endDate: '2026-09-30' }),
  term('Term 2', { startDate: '2026-10-01', endDate: '2027-03-31' }),
];

describe('validateTermDraft', () => {
  it('accepts a new name with both dates or neither', () => {
    expect(validateTermDraft(draft(), TERMS, null)).toBeNull();
    expect(validateTermDraft(draft({ startDate: '2027-04-01', endDate: '2027-04-01' }), TERMS, null)).toBeNull();
    expect(validateTermDraft(draft({ academicYear: ' 2026-27 ' }), TERMS, null)).toBeNull();
  });

  it('wants a name of at most 50 characters', () => {
    expect(validateTermDraft(draft({ name: '   ' }), TERMS, null)).toBe('academicTerms.errors.nameRequired');
    expect(validateTermDraft(draft({ name: 'x'.repeat(50) }), TERMS, null)).toBeNull();
    expect(validateTermDraft(draft({ name: ` ${'x'.repeat(50)} ` }), TERMS, null)).toBeNull();
    expect(validateTermDraft(draft({ name: 'x'.repeat(51) }), TERMS, null)).toBe('academicTerms.errors.nameTooLong');
  });

  it("refuses another term's name ignoring case and spaces, but not the term's own", () => {
    expect(validateTermDraft(draft({ name: ' term 1 ' }), TERMS, null)).toBe('academicTerms.errors.duplicate');
    expect(validateTermDraft(draft({ name: 'TERM 2' }), TERMS, 'id-Term 1')).toBe('academicTerms.errors.duplicate');
    expect(validateTermDraft(draft({ name: 'term 1' }), TERMS, 'id-Term 1')).toBeNull();
  });

  it('wants both dates or neither, ending on or after the start', () => {
    expect(validateTermDraft(draft({ startDate: '2027-04-01' }), TERMS, null)).toBe('academicTerms.errors.bothDates');
    expect(validateTermDraft(draft({ endDate: '2027-09-30' }), TERMS, null)).toBe('academicTerms.errors.bothDates');
    expect(validateTermDraft(draft({ startDate: '2027-04-02', endDate: '2027-04-01' }), TERMS, null)).toBe(
      'academicTerms.errors.endBeforeStart'
    );
  });

  it('wants an academic year of at most 20 characters', () => {
    expect(validateTermDraft(draft({ academicYear: 'x'.repeat(20) }), TERMS, null)).toBeNull();
    expect(validateTermDraft(draft({ academicYear: 'x'.repeat(21) }), TERMS, null)).toBe('academicTerms.errors.yearTooLong');
  });
});

describe('term requests', () => {
  it('trims, and sends a cleared date or year as null since PUT replaces everything', () => {
    expect(termRequest(draft({ name: ' Term 3 ', academicYear: '  ' }))).toEqual({
      name: 'Term 3',
      startDate: null,
      endDate: null,
      academicYear: null,
    });
    expect(termRequest(termDraft(term('Term 1', { startDate: '2026-04-01', endDate: '2026-09-30', academicYear: '2026-27' })))).toEqual({
      name: 'Term 1',
      startDate: '2026-04-01',
      endDate: '2026-09-30',
      academicYear: '2026-27',
    });
  });

  it('treats a term as in use when assessments or publications use it', () => {
    expect(termInUse(term('A'))).toBe(false);
    expect(termInUse(term('A', { assessmentCount: 1 }))).toBe(true);
    expect(termInUse(term('A', { publishedSectionCount: 2 }))).toBe(true);
    expect(termInUse(term('A', { assessmentCount: null, publishedSectionCount: null }))).toBe(false);
  });
});

describe('formatTermDates', () => {
  it('gives the range, with the year once when both dates share it', () => {
    expect(formatTermDates({ startDate: '2026-04-01', endDate: '2026-09-30' }, 'en-IN')).toBe(`1 Apr – 30 ${formatMonth(8)} 2026`);
    expect(formatTermDates({ startDate: '2026-10-01', endDate: '2027-03-31' }, 'en-IN')).toBe('1 Oct 2026 – 31 Mar 2027');
  });

  it('is null for an undated or half-dated term', () => {
    expect(formatTermDates({ startDate: null, endDate: null })).toBeNull();
    expect(formatTermDates({ startDate: '2026-04-01', endDate: null })).toBeNull();
  });
});

// Node's ICU spells September "Sep" or "Sept" depending on its version.
function formatMonth(monthIndex: number): string {
  return new Date(2026, monthIndex, 1).toLocaleDateString('en-IN', { month: 'short' });
}

describe('sortTerms', () => {
  it('orders by start date, undated terms last, then by name ignoring case', () => {
    const sorted = sortTerms([
      term('annual'),
      term('Term 2', { startDate: '2026-10-01' }),
      term('Half-yearly'),
      term('Term 1', { startDate: '2026-04-01' }),
      term('Term 1b', { startDate: '2026-04-01' }),
    ]);
    expect(sorted.map((t) => t.name)).toEqual(['Term 1', 'Term 1b', 'Term 2', 'annual', 'Half-yearly']);
  });
});

describe('matchListedTerm', () => {
  it('matches ignoring case and stray spaces', () => {
    expect(matchListedTerm(' term 1 ', TERMS)?.name).toBe('Term 1');
    expect(matchListedTerm('Term 3', TERMS)).toBeNull();
    expect(matchListedTerm('', TERMS)).toBeNull();
    expect(matchListedTerm(null, TERMS)).toBeNull();
  });
});

describe('formTermChoices', () => {
  it('offers every listed term in order, marked published from the section', () => {
    const choices = formTermChoices([TERMS[1], TERMS[0]], [summary('Term 1', true)], null);
    expect(choices.map((c) => [c.term, c.published, c.hasAssessments])).toEqual([
      ['Term 1', true, true],
      ['Term 2', false, false],
    ]);
  });

  it("uses the section's own spelling of a listed term, as the server saves it", () => {
    const [first] = formTermChoices(TERMS, [summary('term 1')], 'term 1');
    expect(first.term).toBe('term 1');
    expect(first.listed?.name).toBe('Term 1');
  });

  it("adds the assessment's old term when it isn't on the list, as it was stored", () => {
    const choices = formTermChoices(TERMS, [summary('Half yearly', true), summary('Term 1')], 'Half yearly');
    expect(choices.map((c) => c.term)).toEqual(['Term 1', 'Term 2', 'Half yearly']);
    expect(choices[2]).toMatchObject({ listed: null, published: true });
  });

  it("doesn't repeat a current term that is listed in another case", () => {
    expect(formTermChoices(TERMS, [summary('TERM 2')], 'TERM 2').map((c) => c.term)).toEqual(['Term 1', 'TERM 2']);
  });
});

describe('publishTermChoices', () => {
  it("is just the section's terms when the school has no term list", () => {
    const choices = publishTermChoices([], [summary('Term 1', true), summary('Unit test')]);
    expect(choices.map((c) => [c.term, c.listed, c.published, c.hasAssessments])).toEqual([
      ['Term 1', null, true, true],
      ['Unit test', null, false, true],
    ]);
  });

  it('lists the listed terms in order, then old terms not on the list', () => {
    const choices = publishTermChoices(TERMS, [summary('Old term'), summary('term 2', true)]);
    expect(choices.map((c) => [c.term, c.listed?.name ?? null, c.published, c.hasAssessments])).toEqual([
      // No assessment here uses Term 1, so it can't be published (it would be empty).
      ['Term 1', 'Term 1', false, false],
      ['term 2', 'Term 2', true, true],
      ['Old term', null, false, true],
    ]);
  });
});

describe('isTermListMissing', () => {
  it('reads a 404 (an older server with no term list) as "not set up", not an error', () => {
    expect(isTermListMissing(new ApiError('Not found', 404))).toBe(true);
    expect(isTermListMissing(new ApiError('Forbidden', 403))).toBe(false);
    expect(isTermListMissing(new ApiError('Server error', 500))).toBe(false);
    expect(isTermListMissing(new Error('Network request failed'))).toBe(false);
    expect(isTermListMissing(null)).toBe(false);
  });
});
