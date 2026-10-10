import type { ReportCardPublishCheck, TermSummary } from '../api/types';
import { canonicalTerm, defaultSectionTerm, findExistingTerm } from '../utils/assessmentTerms';
import { formatOverallGrade, formatOverallPercentage, missingMarksCount } from '../utils/reportCardDisplay';
import { canPublish, nothingToPublishMessage, publishConfirmation, publishWarnings } from '../utils/reportCardPublish';

const check = (overrides: Partial<ReportCardPublishCheck> = {}): ReportCardPublishCheck => ({
  term: 'Term 1',
  assessmentCount: 8,
  untermedAssessmentCount: 0,
  studentCount: 30,
  studentsWithMissingMarks: 0,
  missingMarksCount: 0,
  alreadyPublished: false,
  publishedAt: null,
  ...overrides,
});

const formatDate = (iso: string) => `<${iso}>`;

describe('term canonicalisation', () => {
  const existing = ['Annual', 'Term 1', 'Term 2'];

  it('snaps a different case or stray spaces to the spelling the section already uses', () => {
    expect(findExistingTerm(' term 1 ', existing)).toBe('Term 1');
    expect(canonicalTerm('TERM 2', existing)).toBe('Term 2');
    expect(canonicalTerm('annual', existing)).toBe('Annual');
  });

  it('keeps a new term as typed, trimmed', () => {
    expect(findExistingTerm('Term1', existing)).toBeNull();
    expect(canonicalTerm('  Half yearly ', existing)).toBe('Half yearly');
    expect(canonicalTerm('   ', existing)).toBe('');
    expect(findExistingTerm('', existing)).toBeNull();
  });
});

describe('defaultSectionTerm', () => {
  const terms = (...list: [string, boolean][]): TermSummary[] => list.map(([term, published]) => ({ term, published }));

  it('opens on the latest published term', () => {
    expect(defaultSectionTerm(terms(['Term 1', true], ['Term 2', true], ['Term 3', false]))).toBe('Term 2');
  });

  it('falls back to the first term when none is published', () => {
    expect(defaultSectionTerm(terms(['Term 1', false], ['Term 2', false]))).toBe('Term 1');
  });

  it('is null when the section has no terms - never a guessed "Term 1"', () => {
    expect(defaultSectionTerm([])).toBeNull();
  });
});

describe('report card display', () => {
  it('shows a dash, not 0% or F, when there is no overall result', () => {
    expect(formatOverallPercentage(null)).toBe('—');
    expect(formatOverallPercentage(undefined)).toBe('—');
    expect(formatOverallGrade(null)).toBe('—');
    expect(formatOverallGrade('')).toBe('—');
  });

  it('shows real values as they are, including a real 0%', () => {
    expect(formatOverallPercentage(0)).toBe('0%');
    expect(formatOverallPercentage(72.5)).toBe('72.5%');
    expect(formatOverallGrade('F')).toBe('F');
  });

  it('reads a missing or bad missingMarksCount as none', () => {
    expect(missingMarksCount(3)).toBe(3);
    expect(missingMarksCount(0)).toBe(0);
    expect(missingMarksCount(undefined)).toBe(0);
    expect(missingMarksCount(null)).toBe(0);
    expect(missingMarksCount(-1)).toBe(0);
  });
});

describe('publish check', () => {
  it('refuses a term no assessment uses', () => {
    expect(canPublish(check({ assessmentCount: 0 }))).toBe(false);
    expect(canPublish(check())).toBe(true);
    expect(nothingToPublishMessage(check({ assessmentCount: 0 }))).toContain('"Term 1"');
  });

  it('has no warnings for a complete, first-time publish', () => {
    expect(publishWarnings(check())).toEqual([]);
  });

  it('warns about missing marks, un-termed assessments, an empty section and a re-publish', () => {
    expect(
      publishWarnings(
        check({
          studentCount: 0,
          studentsWithMissingMarks: 3,
          missingMarksCount: 5,
          untermedAssessmentCount: 2,
          alreadyPublished: true,
          publishedAt: '2026-10-01T10:00:00Z',
        })
      )
    ).toEqual([
      { code: 'noStudents' },
      { code: 'missingMarks', students: 3, marks: 5 },
      { code: 'untermedAssessments', count: 2 },
      { code: 'alreadyPublished', publishedAt: '2026-10-01T10:00:00Z' },
    ]);
  });
});

describe('publishConfirmation', () => {
  it('gives the counts and says families are notified, marks lock and there is no undo', () => {
    const { title, message } = publishConfirmation(check(), formatDate);
    expect(title).toBe('Publish "Term 1" report cards?');
    expect(message).toContain('30 students · 8 assessments in "Term 1".');
    expect(message).toContain('Every student and parent in this section will be notified.');
    expect(message).toContain('Marks for every assessment in "Term 1" will be locked.');
    expect(message).toContain("There's no undo yet");
    expect(message).not.toContain('•');
  });

  it('spells out each warning', () => {
    const { message } = publishConfirmation(
      check({ studentsWithMissingMarks: 1, missingMarksCount: 1, untermedAssessmentCount: 2 }),
      formatDate
    );
    expect(message).toContain('• 1 student has marks missing (1 mark in all).');
    expect(message).toContain('• 2 assessments in this section have no term');
    expect(message).toContain('use "Fix assessments missing a term" first');
  });

  it('says a re-publish notifies nobody and gives the first publish date', () => {
    const { message } = publishConfirmation(
      check({ alreadyPublished: true, publishedAt: '2026-10-01T10:00:00Z' }),
      formatDate
    );
    expect(message).toContain('"Term 1" was already published on <2026-10-01T10:00:00Z>.');
    expect(message).toContain('Students and parents are not notified again.');
    expect(message).not.toContain('will be notified');
    expect(message).toContain('stay locked');
  });

  it('uses singular wording for one of each', () => {
    const { message } = publishConfirmation(check({ studentCount: 1, assessmentCount: 1, untermedAssessmentCount: 1 }), formatDate);
    expect(message).toContain('1 student · 1 assessment in "Term 1".');
    expect(message).toContain('1 assessment in this section has no term, so its marks');
  });
});
