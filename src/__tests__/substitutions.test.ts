import { ApiError } from '../api/client';
import type { FreeTeacher, TimetableOverride, UncoveredPeriod } from '../api/timetable';
import {
  coverCount,
  freshLists,
  groupUncoveredByTeacher,
  noRoomMeansRegular,
  overrideKindVariant,
  overrideSummary,
  overrideUpdateFromExisting,
  reloadAfterFailedWrite,
  sortFreeTeachers,
  uncoveredAction,
  uncoveredOverrideKind,
} from '../utils/substitutions';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const free = (name: string, periodsThatDay: number, teachesSection: boolean): FreeTeacher => ({
  teacherId: name.toLowerCase(),
  name,
  designation: 'TGT',
  periodsThatDay,
  attendanceStatus: null,
  teachesSection,
});

const uncovered = (teacherName: string, periodNumber: number, extra: Partial<UncoveredPeriod> = {}): UncoveredPeriod => ({
  date: '2026-10-14',
  teacherId: teacherName.toLowerCase(),
  teacherName,
  attendanceStatus: 'ABSENT',
  sectionId: `sec-${periodNumber}`,
  className: 'Grade 5',
  section: 'A',
  periodNumber,
  startTime: '09:00',
  endTime: '09:40',
  subjectId: 'maths',
  subjectName: 'Maths',
  roomId: null,
  roomName: null,
  overrideId: null,
  ...extra,
});

const override = (extra: Partial<TimetableOverride>): TimetableOverride => ({
  id: 'o1',
  date: '2026-10-14',
  dayOfWeek: 'WEDNESDAY',
  sectionId: 'sec',
  className: 'Grade 5',
  section: 'A',
  periodNumber: 3,
  startTime: '09:20',
  endTime: '10:00',
  kind: 'SUBSTITUTE',
  originalTeacherId: 'sunita',
  originalTeacherName: 'Sunita',
  originalSubjectId: 'maths',
  originalSubjectName: 'Maths',
  substituteTeacherId: 'ravi',
  substituteTeacherName: 'Ravi',
  subjectId: 'maths',
  subjectName: 'Maths',
  roomId: null,
  roomName: null,
  reason: 'On leave',
  createdAt: null,
  updatedAt: null,
  ...extra,
});

describe('sortFreeTeachers', () => {
  it('puts the fewest periods that day first, then those who teach the class, then by name', () => {
    const sorted = sortFreeTeachers([
      free('Zoya', 1, false),
      free('Amit', 3, true),
      free('Bela', 1, false),
      free('Chetan', 1, true),
      free('asha', 0, false),
    ]);
    expect(sorted.map((t) => t.name)).toEqual(['asha', 'Chetan', 'Bela', 'Zoya', 'Amit']);
  });

  it('does not change the list it was given', () => {
    const list = [free('B', 2, false), free('A', 1, false)];
    sortFreeTeachers(list);
    expect(list.map((t) => t.name)).toEqual(['B', 'A']);
  });
});

describe('groupUncoveredByTeacher', () => {
  it('groups by teacher in name order, with each teacher periods in order and their attendance chip', () => {
    const groups = groupUncoveredByTeacher([
      uncovered('Sunita', 5),
      uncovered('Ravi', 2, { attendanceStatus: 'HALF_DAY' }),
      uncovered('Sunita', 1),
      uncovered('Ravi', 1, { attendanceStatus: 'HALF_DAY' }),
    ]);
    expect(groups.map((g) => [g.teacherName, g.attendanceStatus, g.periods.map((p) => p.periodNumber)])).toEqual([
      ['Ravi', 'HALF_DAY', [1, 2]],
      ['Sunita', 'ABSENT', [1, 5]],
    ]);
  });

  it('shows Absent when one teacher rows ever disagree', () => {
    const groups = groupUncoveredByTeacher([
      uncovered('Ravi', 1, { attendanceStatus: 'HALF_DAY' }),
      uncovered('Ravi', 2, { attendanceStatus: 'ABSENT' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].attendanceStatus).toBe('ABSENT');
  });

  it('is empty when nobody is away', () => {
    expect(groupUncoveredByTeacher([])).toEqual([]);
  });
});

describe('uncoveredAction', () => {
  it('makes a new change for a regular period, and edits the cover of an absent substitute', () => {
    expect(uncoveredAction(uncovered('Ravi', 1))).toBe('create');
    expect(uncoveredAction(uncovered('Ravi', 1, { overrideId: 'o9' }))).toBe('edit');
  });
});

describe('overrideSummary', () => {
  it('reads a substitution from the original teacher to the substitute', () => {
    expect(overrideSummary(override({}))).toEqual({ kind: 'SUBSTITUTE', from: 'Sunita', to: 'Ravi', subject: 'Maths' });
  });

  it('reads a cancelled period as taken from the original teacher, with no one taking it', () => {
    expect(
      overrideSummary(override({ kind: 'CANCELLED', substituteTeacherId: null, substituteTeacherName: null, subjectId: null, subjectName: null }))
    ).toEqual({ kind: 'CANCELLED', from: 'Sunita', to: null, subject: 'Maths' });
  });

  it('reads an extra class as given to a teacher, taken from no one', () => {
    expect(
      overrideSummary(
        override({
          kind: 'EXTRA',
          originalTeacherId: null,
          originalTeacherName: null,
          originalSubjectId: null,
          originalSubjectName: null,
          subjectId: 'sci',
          subjectName: 'Science',
        })
      )
    ).toEqual({ kind: 'EXTRA', from: null, to: 'Ravi', subject: 'Science' });
  });
});

describe('coverCount', () => {
  it('counts each class period once', () => {
    expect(coverCount([])).toBe(0);
    expect(coverCount([uncovered('Ravi', 1), uncovered('Ravi', 2), uncovered('Sunita', 3)])).toBe(3);
    expect(coverCount([uncovered('Ravi', 1), uncovered('Ravi', 1)])).toBe(1);
  });
});

describe('overrideUpdateFromExisting', () => {
  it('keeps the regular subject as null rather than pinning it', () => {
    expect(overrideUpdateFromExisting(override({}), { substituteTeacherId: 'amit', roomId: null, reason: '  On leave ' })).toEqual({
      substituteTeacherId: 'amit',
      subjectId: null,
      roomId: null,
      reason: 'On leave',
    });
  });

  it("keeps the change's own subject and the new room", () => {
    expect(
      overrideUpdateFromExisting(override({ subjectId: 'sci', subjectName: 'Science' }), {
        substituteTeacherId: 'amit',
        roomId: 'lab-1',
        reason: '   ',
      })
    ).toEqual({ substituteTeacherId: 'amit', subjectId: 'sci', roomId: 'lab-1', reason: null });
  });
});

describe('uncoveredOverrideKind', () => {
  const substitute = override({ id: 'sub', kind: 'SUBSTITUTE' });
  const extra = override({ id: 'extra', kind: 'EXTRA', originalTeacherId: null, originalTeacherName: null });

  it('is null for a weekly period that has no change yet', () => {
    expect(uncoveredOverrideKind(uncovered('Ravi', 1), [substitute, extra])).toBeNull();
  });

  it("uses the change's own kind, so an extra class isn't called a substitution", () => {
    expect(uncoveredOverrideKind(uncovered('Ravi', 1, { overrideId: 'sub' }), [substitute, extra])).toBe('SUBSTITUTE');
    expect(uncoveredOverrideKind(uncovered('Ravi', 1, { overrideId: 'extra' }), [substitute, extra])).toBe('EXTRA');
  });

  it("doesn't guess when the change isn't in the day's list", () => {
    expect(uncoveredOverrideKind(uncovered('Ravi', 1, { overrideId: 'gone' }), [substitute])).toBeNull();
    expect(uncoveredOverrideKind(uncovered('Ravi', 1, { overrideId: 'sub' }), null)).toBeNull();
  });
});

describe('overrideKindVariant', () => {
  it('colours each kind of change', () => {
    expect(overrideKindVariant('CANCELLED')).toBe('error');
    expect(overrideKindVariant('EXTRA')).toBe('success');
    expect(overrideKindVariant('SUBSTITUTE')).toBe('warning');
  });
});

describe('noRoomMeansRegular', () => {
  it('keeps the regular room only for a substitution; an extra class has none', () => {
    expect(noRoomMeansRegular('SUBSTITUTE')).toBe(true);
    expect(noRoomMeansRegular('EXTRA')).toBe(false);
    expect(noRoomMeansRegular('CANCELLED')).toBe(false);
  });
});

describe('freshLists', () => {
  it('shows nothing before the first load', () => {
    expect(freshLists(null, '2026-10-14', null)).toEqual({ day: false, teacher: false });
  });

  it('shows the lists loaded for the date and teacher picked', () => {
    expect(freshLists({ date: '2026-10-14', teacherId: null }, '2026-10-14', null)).toEqual({ day: true, teacher: true });
    expect(freshLists({ date: '2026-10-14', teacherId: 'ravi' }, '2026-10-14', 'ravi')).toEqual({ day: true, teacher: true });
  });

  it("hides every list once another date is picked, until that date's lists arrive", () => {
    expect(freshLists({ date: '2026-10-14', teacherId: 'ravi' }, '2026-10-15', 'ravi')).toEqual({ day: false, teacher: false });
  });

  it("keeps the day's lists but not the old teacher's periods when another teacher is picked", () => {
    expect(freshLists({ date: '2026-10-14', teacherId: 'ravi' }, '2026-10-14', 'sunita')).toEqual({ day: true, teacher: false });
    expect(freshLists({ date: '2026-10-14', teacherId: null }, '2026-10-14', 'sunita')).toEqual({ day: true, teacher: false });
  });
});

describe('reloadAfterFailedWrite', () => {
  it('reloads when the period already has a change', () => {
    const exists = new ApiError('This period already has a change.', 409, 'TIMETABLE_OVERRIDE_EXISTS', { overrideId: 'o1' });
    expect(reloadAfterFailedWrite(exists)).toBe(true);
  });

  it('reloads when the change is gone', () => {
    expect(reloadAfterFailedWrite(new ApiError('Not found', 404, 'NOT_FOUND'))).toBe(true);
  });

  it('keeps the lists for a clash or any other error', () => {
    expect(reloadAfterFailedWrite(new ApiError('Busy', 409, 'TIMETABLE_CLASH', []))).toBe(false);
    expect(reloadAfterFailedWrite(new ApiError('Bad', 400, 'TIMETABLE_INVALID', { rule: 'PAST_DATE' }))).toBe(false);
    expect(reloadAfterFailedWrite(new Error('Network'))).toBe(false);
    expect(reloadAfterFailedWrite(null)).toBe(false);
  });
});
