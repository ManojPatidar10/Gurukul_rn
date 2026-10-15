import type { PublishedTerm, ReportCard, SubjectResult } from '../api/types';
import { isNotableDelta } from '../utils/classComparison';
import {
  shortSubjectLabel,
  deltaAxisBound,
  deltaRanking,
  strengths,
  subjectComparison,
  termTrend,
  weaknesses,
} from '../utils/overallStatus';

function subject(name: string, percentage: number | null, classAverage?: number | null): SubjectResult {
  const delta = percentage != null && classAverage != null ? percentage - classAverage : null;
  return {
    subjectId: name,
    subjectName: name,
    subjectCode: name.slice(0, 3).toUpperCase(),
    maxMarks: 100,
    marksObtained: percentage ?? 0,
    percentage,
    grade: null,
    classAveragePercentage: classAverage ?? null,
    deltaFromClassAverage: delta,
  };
}

function card(term: string, overall: number | null, subjects: SubjectResult[] = [], classAverage: number | null = null): ReportCard {
  return {
    studentId: 's1',
    studentName: 'Aarav',
    rollNumber: '1',
    className: 'Grade 7',
    section: 'A',
    academicYear: '2026-27',
    term,
    subjects,
    totalMaxMarks: 500,
    totalMarksObtained: 0,
    overallPercentage: overall,
    overallGrade: null,
    missingMarksCount: 0,
    attendancePercentage: null,
    classAveragePercentage: classAverage,
    published: true,
    publishedAt: null,
  };
}

function published(term: string, startDate: string | null): PublishedTerm {
  return { term, publishedAt: '2026-04-01T00:00:00Z', startDate };
}

describe('termTrend', () => {
  it('reads left to right as time, oldest term first', () => {
    const entries = [
      { term: published('Half Yearly', '2026-09-01'), card: card('Half Yearly', 71) },
      { term: published('Term 1', '2026-04-01'), card: card('Term 1', 64) },
    ];

    expect(termTrend(entries).map((p) => p.label)).toEqual(['Term 1', 'Half Yearly']);
  });

  it('drops a term with no overall rather than plotting it as zero', () => {
    // A term with no marks entered is not a term the student scored nothing in, and a line
    // dropping to the floor says exactly that to a parent.
    const entries = [
      { term: published('Term 1', '2026-04-01'), card: card('Term 1', 64) },
      { term: published('Term 2', '2026-07-01'), card: card('Term 2', null) },
    ];

    expect(termTrend(entries).map((p) => p.label)).toEqual(['Term 1']);
  });

  it('carries the class average alongside, and null when there is none', () => {
    const entries = [
      { term: published('Term 1', '2026-04-01'), card: card('Term 1', 64, [], 70) },
      { term: published('Term 2', '2026-07-01'), card: card('Term 2', 66, [], null) },
    ];

    expect(termTrend(entries).map((p) => p.classAverage)).toEqual([70, null]);
  });
});

describe('subjectComparison', () => {
  it('keeps the card order so the chart does not change shape between terms', () => {
    const result = subjectComparison(card('Term 1', 70, [
      subject('English', 88, 73),
      subject('Mathematics', 54, 71),
    ]));

    expect(result.map((s) => s.label)).toEqual(['English', 'Mathematics']);
    expect(result[1]).toMatchObject({ percentage: 54, classAverage: 71 });
  });

  it('leaves out a subject with no percentage', () => {
    const result = subjectComparison(card('Term 1', 70, [subject('Art', null), subject('English', 88, 73)]));

    expect(result.map((s) => s.label)).toEqual(['English']);
  });

  it('is empty rather than throwing when there is no card yet', () => {
    expect(subjectComparison(null)).toEqual([]);
  });
});

describe('deltaRanking', () => {
  const ranked = deltaRanking(card('Term 1', 70, [
    subject('Mathematics', 54, 70.8),
    subject('English', 88, 73.2),
    subject('Social Science', 72, 72.3),
  ]));

  it('ranks strongest first, so the extremes are the ends', () => {
    expect(ranked.map((p) => p.label)).toEqual(['English', 'Social Science', 'Mathematics']);
  });

  it('leaves out a subject with no class to compare against', () => {
    const result = deltaRanking(card('Term 1', 70, [subject('Art', 90), subject('English', 88, 73)]));

    expect(result.map((p) => p.label)).toEqual(['English']);
  });

  it('marks a gap inside the noise band as not notable', () => {
    // Social Science is -0.3 from its class. It still gets a bar, because the number is real -
    // it just is not called a weakness.
    const socialScience = ranked.find((p) => p.label === 'Social Science');

    expect(socialScience?.delta).toBe(-0.3);
    expect(socialScience?.notable).toBe(false);
  });

  it('names only the notable ones as strengths and weaknesses', () => {
    expect(strengths(ranked).map((p) => p.label)).toEqual(['English']);
    expect(weaknesses(ranked).map((p) => p.label)).toEqual(['Mathematics']);
  });

  it('lists weaknesses weakest first, the order a student should work through them', () => {
    const worst = deltaRanking(card('Term 1', 50, [
      subject('Mathematics', 54, 70.8),
      subject('Science', 63, 73.5),
    ]));

    expect(weaknesses(worst).map((p) => p.label)).toEqual(['Mathematics', 'Science']);
  });
});

describe('deltaAxisBound', () => {
  it('is symmetric and rounded up to a whole step', () => {
    const ranking = deltaRanking(card('Term 1', 70, [subject('Mathematics', 54, 70.8)]));

    // -16.8 rounds the axis out to 20, so the labels come out whole.
    expect(deltaAxisBound(ranking)).toBe(20);
  });

  it('never collapses to zero when every subject sits on its class average', () => {
    // A zero-height axis would make every bar full width, turning "no gaps at all" into a chart
    // that looks like enormous gaps.
    const ranking = deltaRanking(card('Term 1', 70, [subject('English', 73, 73)]));

    expect(deltaAxisBound(ranking)).toBe(5);
    expect(deltaAxisBound([])).toBe(5);
  });
});

describe('isNotableDelta', () => {
  it('judges what is displayed, not the unrounded value', () => {
    // -1.04 is shown as "-1.0", and calling that a weakness contradicts the number beside it.
    expect(isNotableDelta(-1.04)).toBe(false);
    expect(isNotableDelta(-1.0)).toBe(false);
    expect(isNotableDelta(1.2)).toBe(true);
    expect(isNotableDelta(null)).toBe(false);
  });
});

describe('shortSubjectLabel', () => {
  it('leaves a name that already fits alone', () => {
    expect(shortSubjectLabel('English')).toBe('English');
    expect(shortSubjectLabel('Science')).toBe('Science');
  });

  it('keeps every word of a long multi-word name, so it stays recognisable', () => {
    // Full length overlaps the subject beside it on a phone, which costs both labels.
    expect(shortSubjectLabel('Social Science')).toBe('Soc Sci');
    expect(shortSubjectLabel('Physical Education')).toBe('Phy Edu');
  });

  it('truncates a long single word rather than dropping it', () => {
    expect(shortSubjectLabel('Mathematics')).toBe('Mathem.');
    expect(shortSubjectLabel('Mathematics')).toHaveLength(7);
  });

  it('is not confused by stray spacing', () => {
    expect(shortSubjectLabel('  Social   Science  ')).toBe('Soc Sci');
  });
});
