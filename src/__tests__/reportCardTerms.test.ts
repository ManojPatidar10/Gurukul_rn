import type { AcademicTerm, PublishedTerm, ReportCardAssessment, SubjectResult, TermSummary } from '../api/types';
import { latestPublishedTerm, publishedTermLabel, reportCardTermChips } from '../utils/academicTerms';
import { defaultSectionTerm } from '../utils/assessmentTerms';
import {
  assessmentMarkLabel,
  attendanceLabelKey,
  formatSubjectGrade,
  formatSubjectPercentage,
  gridSubjectCell,
  hasAbsentOrExcused,
  subjectCounts,
} from '../utils/reportCardDisplay';

// Midday UTC, so the local date is the same in any time zone the tests run in.
const at = (date: string) => `${date}T12:00:00Z`;

function published(term: string, overrides: Partial<PublishedTerm> = {}): PublishedTerm {
  return {
    term,
    publishedAt: at('2026-10-01'),
    classSectionId: 'sec-7a',
    className: 'Class 7',
    section: 'A',
    academicYear: '2026-27',
    current: true,
    startDate: null,
    endDate: null,
    ...overrides,
  };
}

function listed(name: string, startDate: string | null = null): AcademicTerm {
  return {
    id: `id-${name}`,
    name,
    startDate,
    endDate: startDate,
    academicYear: null,
    assessmentCount: null,
    publishedSectionCount: null,
  };
}

function subject(overrides: Partial<SubjectResult> = {}): SubjectResult {
  return {
    subjectId: 'maths',
    subjectName: 'Maths',
    subjectCode: 'MATH',
    maxMarks: 50,
    marksObtained: 40,
    percentage: 80,
    grade: 'A',
    ...overrides,
  };
}

function assessment(overrides: Partial<ReportCardAssessment> = {}): ReportCardAssessment {
  return {
    assessmentId: 'a1',
    title: 'Unit test 1',
    type: 'TEST',
    assessmentDate: '2026-07-10',
    maxMarks: 20,
    marksObtained: 18,
    status: 'MARKED',
    remarks: null,
    ...overrides,
  };
}

describe('latestPublishedTerm', () => {
  it('goes by the term dates, so re-publishing an earlier term does not make it the latest (L2)', () => {
    const term1 = published('Term 1', { startDate: '2026-04-01', publishedAt: at('2026-11-02') });
    const term2 = published('Term 2', { startDate: '2026-10-01', publishedAt: at('2026-10-20') });
    expect(latestPublishedTerm([term1, term2])).toBe(term2);
    expect(latestPublishedTerm([term2, term1])).toBe(term2);
  });

  it('uses the publish date for a term with no dates', () => {
    const dated = published('Term 2', { startDate: '2026-10-01', publishedAt: at('2026-10-20') });
    const annual = published('Annual', { startDate: null, publishedAt: at('2027-03-30') });
    const unitTest = published('Unit test', { startDate: null, publishedAt: at('2026-09-01') });
    expect(latestPublishedTerm([dated, annual])).toBe(annual);
    expect(latestPublishedTerm([unitTest, dated])).toBe(dated);
  });

  it("orders an older server's entries (no dates or classes) by when they were published", () => {
    const older = [
      { term: 'Term 1', publishedAt: at('2026-05-01') },
      { term: 'Term 2', publishedAt: at('2026-11-01') },
      { term: 'Annual', publishedAt: at('2026-08-01') },
    ];
    expect(latestPublishedTerm(older)?.term).toBe('Term 2');
    // Published the same day: the later one.
    const sameDay = [
      { term: 'A', publishedAt: '2026-05-01T09:00:00Z' },
      { term: 'B', publishedAt: '2026-05-01T10:00:00Z' },
    ];
    expect(latestPublishedTerm(sameDay)?.term).toBe('B');
  });

  it('is null when nothing is published', () => {
    expect(latestPublishedTerm([])).toBeNull();
  });
});

describe('publishedTermLabel', () => {
  it('is just the term for the current class', () => {
    const term1 = published('Term 1');
    expect(publishedTermLabel(term1, [term1])).toBe('Term 1');
  });

  it('names the class when the same term was published for two classes, or the class is an earlier one', () => {
    const old = published('Term 1', { classSectionId: 'sec-6a', className: 'Class 6', current: false });
    const now = published('Term 1');
    const all = [now, old];
    expect(publishedTermLabel(now, all)).toBe('Term 1 · Class 7 A');
    expect(publishedTermLabel(old, all)).toBe('Term 1 · Class 6 A');
    const earlierOnly = published('Term 2', { className: 'Class 6', current: false });
    expect(publishedTermLabel(earlierOnly, [earlierOnly])).toBe('Term 2 · Class 6 A');
  });

  it("is the term alone for an older server's entry", () => {
    const older = { term: 'Term 1', publishedAt: at('2026-05-01') };
    expect(publishedTermLabel(older, [older, older])).toBe('Term 1');
  });
});

describe('reportCardTermChips', () => {
  const old = published('Term 1', { classSectionId: 'sec-6a', className: 'Class 6', current: false });
  const now = published('Term 1');
  const list = [listed('Term 1', '2026-04-01'), listed('Term 2', '2026-10-01')];

  it('gives students and parents only the published terms, each loading its own class', () => {
    expect(reportCardTermChips([now, old], list, false)).toEqual([
      { key: 'sec-7a:Term 1', term: 'Term 1', sectionId: 'sec-7a', label: 'Term 1 · Class 7 A', published: true },
      { key: 'sec-6a:Term 1', term: 'Term 1', sectionId: 'sec-6a', label: 'Term 1 · Class 6 A', published: true },
    ]);
  });

  it('adds draft chips for staff, for listed terms not published in the current class', () => {
    const chips = reportCardTermChips([now, old], list, true);
    expect(chips.map((c) => [c.key, c.published])).toEqual([
      ['sec-7a:Term 1', true],
      ['sec-6a:Term 1', true],
      [':Term 2', false],
    ]);
    // Published only for an earlier class: today's class can still preview its draft.
    expect(reportCardTermChips([old], list, true).map((c) => c.key)).toEqual(['sec-6a:Term 1', ':Term 1', ':Term 2']);
  });
});

describe('defaultSectionTerm by date', () => {
  const summary = (term: string, overrides: Partial<TermSummary>): TermSummary => ({ term, published: true, ...overrides });

  it('opens on the latest published term by its dates, not the last published one', () => {
    const terms = [
      summary('Term 1', { startDate: '2026-04-01', publishedAt: at('2026-11-02') }),
      summary('Term 2', { startDate: '2026-10-01', publishedAt: at('2026-10-20') }),
      summary('Term 3', { startDate: '2027-01-01', published: false, publishedAt: null }),
    ];
    expect(defaultSectionTerm(terms)).toBe('Term 2');
  });

  it('uses the publish date for an undated term', () => {
    const terms = [
      summary('Annual', { publishedAt: at('2027-03-30'), startDate: null }),
      summary('Term 1', { startDate: '2026-04-01', publishedAt: at('2026-10-01') }),
    ];
    expect(defaultSectionTerm(terms)).toBe('Annual');
  });
});

describe('report card attendance label', () => {
  const formatDate = (iso: string) => `<${iso}>`;

  it('gives the term dates when attendance covers just the term', () => {
    expect(
      attendanceLabelKey({ attendanceBasis: 'TERM', attendanceFrom: '2026-04-01', attendanceTo: '2026-09-30' }, formatDate)
    ).toEqual({ key: 'reportCardDetail.attendanceTerm', params: { from: '<2026-04-01>', to: '<2026-09-30>' } });
  });

  it('says "to date" otherwise, including an older server that does not say', () => {
    const toDate = { key: 'reportCardDetail.attendanceToDate' };
    expect(attendanceLabelKey({ attendanceBasis: 'TO_DATE', attendanceFrom: null, attendanceTo: null })).toEqual(toDate);
    expect(attendanceLabelKey({ attendanceBasis: 'TERM', attendanceFrom: null, attendanceTo: null })).toEqual(toDate);
    expect(attendanceLabelKey({})).toEqual(toDate);
  });
});

describe('report card marks display', () => {
  it('labels each assessment by its status', () => {
    expect(assessmentMarkLabel(assessment())).toBe('18 / 20');
    expect(assessmentMarkLabel(assessment({ status: 'MARKED', marksObtained: 0 }))).toBe('0 / 20');
    expect(assessmentMarkLabel(assessment({ status: 'ABSENT', marksObtained: null }))).toBe('AB');
    expect(assessmentMarkLabel(assessment({ status: 'EXCUSED', marksObtained: null }))).toBe('EX');
    expect(assessmentMarkLabel(assessment({ status: 'MISSING', marksObtained: null }))).toBe('—');
  });

  it('shows a dash for an all-excused subject, never a made-up 0%', () => {
    expect(formatSubjectPercentage(null)).toBe('—');
    expect(formatSubjectGrade(null)).toBe('—');
    expect(formatSubjectPercentage(72.5)).toBe('72.5%');
    expect(formatSubjectGrade('B')).toBe('B');
    expect(gridSubjectCell(subject({ maxMarks: 0, marksObtained: 0, percentage: null, grade: null }))).toBe('EX');
    expect(gridSubjectCell(subject())).toBe('40/50');
  });

  it('reads missing absent and excused counts as none', () => {
    expect(subjectCounts(subject())).toEqual({ absent: 0, excused: 0 });
    expect(subjectCounts(subject({ absentCount: 2, excusedCount: 1 }))).toEqual({ absent: 2, excused: 1 });
  });

  it('needs the AB/EX legend only when the card has an absent or excused result', () => {
    expect(hasAbsentOrExcused({ subjects: [subject()] })).toBe(false);
    expect(hasAbsentOrExcused({ subjects: [subject({ absentCount: 1 })] })).toBe(true);
    expect(hasAbsentOrExcused({ subjects: [subject({ assessments: [assessment({ status: 'EXCUSED' })] })] })).toBe(true);
    expect(hasAbsentOrExcused({ subjects: [subject({ assessments: [assessment({ status: 'MISSING' })] })] })).toBe(false);
  });
});
