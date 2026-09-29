import type { Period, TimetableSlot } from '../api/timetable';
import { ApiError } from '../api/client';
import { clashesFromError } from '../api/timetable';
import {
  addMinutes,
  cellsToSlotRequests,
  defaultDay,
  nextPeriodRow,
  normalizeTime,
  periodRowsToRequest,
  slotKey,
  slotsToCells,
  validatePeriodRows,
} from '../utils/timetable';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

const periods: Period[] = [
  { periodNumber: 1, startTime: '08:00', endTime: '08:40', breakPeriod: false, label: null },
  { periodNumber: 2, startTime: '08:40', endTime: '09:10', breakPeriod: true, label: 'Recess' },
  { periodNumber: 3, startTime: '09:10', endTime: '09:50', breakPeriod: false, label: null },
];

const slot = (day: TimetableSlot['dayOfWeek'], periodNumber: number): TimetableSlot => ({
  dayOfWeek: day,
  periodNumber,
  subjectId: 's1',
  subjectName: 'Maths',
  subjectCode: 'M',
  teacherId: 't1',
  teacherName: 'T',
  sectionId: 'sec',
  className: 'Grade 5',
  section: 'A',
});

describe('cellsToSlotRequests', () => {
  it('round-trips saved slots', () => {
    const cells = slotsToCells([slot('MONDAY', 1), slot('TUESDAY', 3)]);
    expect(cellsToSlotRequests(cells, ['MONDAY', 'TUESDAY'], periods)).toEqual([
      { dayOfWeek: 'MONDAY', periodNumber: 1, subjectId: 's1', teacherId: 't1' },
      { dayOfWeek: 'TUESDAY', periodNumber: 3, subjectId: 's1', teacherId: 't1' },
    ]);
  });

  it('drops cells on switched-off days and break periods', () => {
    const cells = {
      [slotKey('SATURDAY', 1)]: { subjectId: 's1', teacherId: 't1' },
      [slotKey('MONDAY', 2)]: { subjectId: 's1', teacherId: 't1' },
    };
    expect(cellsToSlotRequests(cells, ['MONDAY'], periods)).toEqual([]);
  });
});

describe('defaultDay', () => {
  it('picks today when it is a school day', () => {
    expect(defaultDay(['MONDAY', 'TUESDAY'], new Date(2026, 8, 29))).toBe('TUESDAY');
  });
  it('falls back to the first day on a weekend', () => {
    expect(defaultDay(['MONDAY', 'TUESDAY'], new Date(2026, 9, 4))).toBe('MONDAY');
  });
});

describe('time helpers', () => {
  it('normalizes times', () => {
    expect(normalizeTime('8:30')).toBe('08:30');
    expect(normalizeTime('13:05')).toBe('13:05');
    expect(normalizeTime('25:00')).toBeNull();
    expect(normalizeTime('8.30')).toBeNull();
  });
  it('adds minutes without passing midnight', () => {
    expect(addMinutes('08:40', 40)).toBe('09:20');
    expect(addMinutes('23:50', 40)).toBe('23:59');
  });
  it('suggests the next period after the last one', () => {
    expect(nextPeriodRow([{ startTime: '08:00', endTime: '08:40', breakPeriod: false, label: '' }])).toEqual({
      startTime: '08:40',
      endTime: '09:20',
      breakPeriod: false,
      label: '',
    });
  });
});

describe('validatePeriodRows', () => {
  const row = (startTime: string, endTime: string) => ({ startTime, endTime, breakPeriod: false, label: '' });
  it('accepts back-to-back periods', () => {
    expect(validatePeriodRows([row('08:00', '08:40'), row('08:40', '09:20')])).toBeNull();
  });
  it('rejects empty, bad times, reversed and overlapping periods', () => {
    expect(validatePeriodRows([])).toEqual({ code: 'empty' });
    expect(validatePeriodRows([row('8', '09:00')])).toEqual({ code: 'badTime', periodNumber: 1 });
    expect(validatePeriodRows([row('09:00', '08:00')])).toEqual({ code: 'endBeforeStart', periodNumber: 1 });
    expect(validatePeriodRows([row('08:00', '08:45'), row('08:40', '09:20')])).toEqual({
      code: 'overlap',
      periodNumber: 2,
      previous: 1,
    });
  });
  it('numbers periods by position and trims labels', () => {
    expect(periodRowsToRequest([{ startTime: '8:00', endTime: '08:40', breakPeriod: true, label: ' Lunch ' }])).toEqual([
      { periodNumber: 1, startTime: '08:00', endTime: '08:40', breakPeriod: true, label: 'Lunch' },
    ]);
  });
});

describe('clashesFromError', () => {
  it('extracts clashes from a TIMETABLE_CLASH error', () => {
    const clash = { dayOfWeek: 'MONDAY', periodNumber: 1, teacherId: 't', teacherName: 'T', conflictingSectionId: 'x', conflictingSectionLabel: '5 - B' };
    expect(clashesFromError(new ApiError('clash', 409, 'TIMETABLE_CLASH', [clash]))).toEqual([clash]);
  });
  it('returns null for other errors', () => {
    expect(clashesFromError(new ApiError('bad', 400))).toBeNull();
    expect(clashesFromError(new Error('x'))).toBeNull();
  });
});
