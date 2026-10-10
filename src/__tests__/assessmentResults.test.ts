import type { StudentResult } from '../api/types';
import {
  buildResultsPayload,
  isResultsDirty,
  parseMarks,
  resultsGridMode,
  rowFromResult,
  summarizeResults,
  type ResultRowState,
} from '../utils/assessmentResults';
import { isPassingMark, passMarkFromScale } from '../utils/gradingScale';

function student(id: string, saved: Partial<StudentResult> = {}): StudentResult {
  return { studentId: id, studentName: `Student ${id}`, rollNumber: id, marksObtained: null, absent: false, remarks: null, ...saved };
}

function row(marksText: string, absent = false, remarksText = ''): ResultRowState {
  return { marksText, absent, remarksText };
}

describe('parseMarks', () => {
  it('accepts up to 3 digits with up to 2 decimal places, ignoring surrounding spaces', () => {
    expect(parseMarks('0')).toBe(0);
    expect(parseMarks('42')).toBe(42);
    expect(parseMarks(' 12.5 ')).toBe(12.5);
    expect(parseMarks('999.99')).toBe(999.99);
    expect(parseMarks('7.05')).toBe(7.05);
  });

  it('refuses what Number() would wrongly accept, and anything the server would refuse', () => {
    expect(parseMarks('')).toBeNull();
    expect(parseMarks('   ')).toBeNull();
    expect(parseMarks('1e1')).toBeNull();
    expect(parseMarks('0x10')).toBeNull();
    expect(parseMarks('-1')).toBeNull();
    expect(parseMarks('12.345')).toBeNull();
    expect(parseMarks('.5')).toBeNull();
    expect(parseMarks('5.')).toBeNull();
    expect(parseMarks('1000')).toBeNull();
    expect(parseMarks('4o')).toBeNull();
    expect(parseMarks('1,5')).toBeNull();
  });
});

describe('buildResultsPayload', () => {
  it('refuses marks above max marks but accepts exactly max', () => {
    const { results, invalid } = buildResultsPayload(
      [student('1'), student('2')],
      { '1': row('25.5'), '2': row('25.51') },
      25.5
    );
    expect(results).toEqual([{ studentId: '1', absent: false, marksObtained: 25.5 }]);
    expect(invalid.map((s) => s.studentId)).toEqual(['2']);
  });

  it('treats a missing grid row as unchanged rather than cleared', () => {
    const { results } = buildResultsPayload([student('1', { marksObtained: 30, remarks: 'Good' })], {}, 50);
    expect(results).toEqual([{ studentId: '1', absent: false, marksObtained: 30, remarks: 'Good' }]);
  });

  it('ignores marks typed before Absent was ticked', () => {
    const { results, invalid } = buildResultsPayload([student('1')], { '1': row('abc', true) }, 50);
    expect(invalid).toEqual([]);
    expect(results).toEqual([{ studentId: '1', absent: true }]);
  });
});

describe('isResultsDirty', () => {
  const roster = [student('1', { marksObtained: 30, remarks: 'Good' }), student('2', { absent: true }), student('3')];
  const loaded = () => Object.fromEntries(roster.map((r) => [r.studentId, rowFromResult(r)]));

  it('is clean right after loading', () => {
    expect(isResultsDirty(roster, loaded())).toBe(false);
  });

  it('is clean when the same mark is written differently, or only spaces were added', () => {
    expect(isResultsDirty(roster, { ...loaded(), '1': row('30.0', false, 'Good ') })).toBe(false);
    expect(isResultsDirty(roster, { ...loaded(), '3': row('  ') })).toBe(false);
  });

  it('is dirty when marks, Absent or a remark changed', () => {
    expect(isResultsDirty(roster, { ...loaded(), '1': row('31', false, 'Good') })).toBe(true);
    expect(isResultsDirty(roster, { ...loaded(), '1': row('', false, 'Good') })).toBe(true);
    expect(isResultsDirty(roster, { ...loaded(), '2': row('', false) })).toBe(true);
    expect(isResultsDirty(roster, { ...loaded(), '3': row('', true) })).toBe(true);
    expect(isResultsDirty(roster, { ...loaded(), '3': row('', false, 'Late') })).toBe(true);
    expect(isResultsDirty(roster, { ...loaded(), '3': row('abc') })).toBe(true);
  });

  it('ignores the marks box of a row that is absent both before and after', () => {
    expect(isResultsDirty(roster, { ...loaded(), '2': row('12', true) })).toBe(false);
  });
});

// The server's built-in grading scale.
const DEFAULT_BANDS = [
  { minPercentage: 90, maxPercentage: 100, label: 'A+' },
  { minPercentage: 75, maxPercentage: 90, label: 'A' },
  { minPercentage: 60, maxPercentage: 75, label: 'B' },
  { minPercentage: 45, maxPercentage: 60, label: 'C' },
  { minPercentage: 33, maxPercentage: 45, label: 'D' },
  { minPercentage: 0, maxPercentage: 33, label: 'F' },
];

describe('passMarkFromScale', () => {
  it('is 33 with the built-in scale', () => {
    expect(passMarkFromScale(DEFAULT_BANDS)).toBe(33);
  });

  it('follows a school that changed its scale, whatever order the bands come in', () => {
    expect(
      passMarkFromScale([{ minPercentage: 40 }, { minPercentage: 70 }, { minPercentage: 0 }])
    ).toBe(40);
  });

  it('is null with fewer than 2 bands - no pass/fail line, and no 33% guess', () => {
    expect(passMarkFromScale([{ minPercentage: 0 }])).toBeNull();
    expect(passMarkFromScale([])).toBeNull();
  });
});

describe('isPassingMark', () => {
  it('passes on the pass mark itself, after rounding to 2 places like the server', () => {
    expect(isPassingMark(33, 100, 33)).toBe(true);
    expect(isPassingMark(32.99, 100, 33)).toBe(false);
    // 16.5 / 50 = 33%.
    expect(isPassingMark(16.5, 50, 33)).toBe(true);
    // 1 / 3 = 33.333...% rounds to 33.33.
    expect(isPassingMark(1, 3, 33.33)).toBe(true);
  });
});

describe('summarizeResults', () => {
  const roster = [
    student('1', { marksObtained: 40 }),
    student('2', { marksObtained: 10 }),
    student('3', { absent: true }),
    student('4'),
  ];

  it('counts entered rows and pass/fail against the pass mark', () => {
    expect(summarizeResults(roster, 50, 33)).toEqual({
      entered: 3,
      total: 4,
      average: 25,
      highest: 40,
      lowest: 10,
      passCount: 1,
      failCount: 1,
    });
  });

  it('leaves pass/fail out when there is no pass mark', () => {
    const summary = summarizeResults(roster, 50, null);
    expect(summary.passCount).toBeNull();
    expect(summary.failCount).toBeNull();
    expect(summary.average).toBe(25);
  });

  it('has no stats before any marks are entered', () => {
    expect(summarizeResults([student('1', { absent: true }), student('2')], 50, 33)).toEqual({
      entered: 1,
      total: 2,
      average: null,
      highest: null,
      lowest: null,
      passCount: null,
      failCount: null,
    });
  });
});

describe('resultsGridMode', () => {
  it('takes input when the term is open and the caller may enter marks', () => {
    expect(resultsGridMode({ locked: false, readOnly: false, saving: false })).toEqual({ editable: true, inputsEnabled: true });
  });

  it('freezes the inputs during a save, since its response replaces every row, but keeps the grid in edit mode', () => {
    expect(resultsGridMode({ locked: false, readOnly: false, saving: true })).toEqual({ editable: true, inputsEnabled: false });
  });

  it('is read-only for a published term or a caller who may only view', () => {
    expect(resultsGridMode({ locked: true, readOnly: false, saving: false })).toEqual({ editable: false, inputsEnabled: false });
    expect(resultsGridMode({ locked: false, readOnly: true, saving: false })).toEqual({ editable: false, inputsEnabled: false });
  });
});
