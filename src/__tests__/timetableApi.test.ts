import { api } from '../api/client';
import { createRoom, deactivateRoom, listRooms, updateRoom } from '../api/rooms';
import {
  clearTimetableCell,
  createOverride,
  deleteOverride,
  getDayTimetable,
  getFreeTeachers,
  getMyTimetable,
  getTeacherTimetable,
  getUncoveredPeriods,
  listOverrides,
  setTimetableCell,
  toQuery,
  updateOverride,
} from '../api/timetable';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('../api/client', () => {
  const actual = jest.requireActual('../api/client');
  return { ...actual, api: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } };
});

const get = api.get as jest.Mock;
const post = api.post as jest.Mock;
const put = api.put as jest.Mock;
const del = api.delete as jest.Mock;

beforeEach(() => {
  for (const mock of [get, post, put, del]) {
    mock.mockReset();
    mock.mockResolvedValue({});
  }
});

describe('toQuery', () => {
  it('keeps only the values that are set, encoded', () => {
    expect(toQuery({})).toBe('');
    expect(toQuery({ a: undefined, b: null, c: '' })).toBe('');
    expect(toQuery({ date: '2026-10-14', periodNumber: 3, dryRun: true })).toBe('?date=2026-10-14&periodNumber=3&dryRun=true');
    expect(toQuery({ q: 'a b&c' })).toBe('?q=a%20b%26c');
  });
});

describe('getMyTimetable', () => {
  it('keeps the old two-argument call unchanged', async () => {
    await getMyTimetable('school-1');
    await getMyTimetable('school-1', 'child-1');
    expect(get).toHaveBeenNthCalledWith(1, '/api/v1/timetable/me', 'school-1');
    expect(get).toHaveBeenNthCalledWith(2, '/api/v1/timetable/me?childId=child-1', 'school-1');
  });

  it('asks for one date', async () => {
    await getMyTimetable('school-1', undefined, '2026-10-14');
    await getMyTimetable('school-1', 'child-1', '2026-10-14');
    expect(get).toHaveBeenNthCalledWith(1, '/api/v1/timetable/me?date=2026-10-14', 'school-1');
    expect(get).toHaveBeenNthCalledWith(2, '/api/v1/timetable/me?childId=child-1&date=2026-10-14', 'school-1');
  });
});

describe('date views', () => {
  it('reads a section or a teacher day, and any teacher week or day', async () => {
    await getDayTimetable('school-1', '2026-10-14', { sectionId: 'sec-1' });
    await getDayTimetable('school-1', '2026-10-14', { teacherId: 't-1' });
    await getTeacherTimetable('school-1', 't-1');
    await getTeacherTimetable('school-1', 't-1', '2026-10-14');
    expect(get.mock.calls).toEqual([
      ['/api/v1/timetable/day?date=2026-10-14&sectionId=sec-1', 'school-1'],
      ['/api/v1/timetable/day?date=2026-10-14&teacherId=t-1', 'school-1'],
      ['/api/v1/teachers/t-1/timetable', 'school-1'],
      ['/api/v1/teachers/t-1/timetable?date=2026-10-14', 'school-1'],
    ]);
  });
});

describe('one-period edits', () => {
  it('saves and clears one period, with dry run only when asked', async () => {
    const body = { subjectId: 'sub', teacherId: 't', roomId: null, assignIfMissing: true };
    await setTimetableCell('school-1', 'sec-1', 'MONDAY', 3, body);
    await setTimetableCell('school-1', 'sec-1', 'MONDAY', 3, body, { dryRun: true });
    await clearTimetableCell('school-1', 'sec-1', 'FRIDAY', 2);
    expect(put.mock.calls).toEqual([
      ['/api/v1/class-sections/sec-1/timetable/slots/MONDAY/3', body, 'school-1'],
      ['/api/v1/class-sections/sec-1/timetable/slots/MONDAY/3?dryRun=true', body, 'school-1'],
    ]);
    expect(del).toHaveBeenCalledWith('/api/v1/class-sections/sec-1/timetable/slots/FRIDAY/2', 'school-1');
  });
});

describe('overrides and helpers', () => {
  it('lists, creates, changes and undoes one-day changes', async () => {
    await listOverrides('school-1');
    await listOverrides('school-1', { from: '2026-10-14', to: '2026-10-14' });
    const req = { date: '2026-10-14', sectionId: 'sec-1', periodNumber: 3, kind: 'SUBSTITUTE' as const, substituteTeacherId: 't-2' };
    await createOverride('school-1', req);
    await updateOverride('school-1', 'o-1', { substituteTeacherId: 't-3' });
    await deleteOverride('school-1', 'o-1');
    expect(get.mock.calls).toEqual([
      ['/api/v1/timetable/overrides', 'school-1'],
      ['/api/v1/timetable/overrides?from=2026-10-14&to=2026-10-14', 'school-1'],
    ]);
    expect(post).toHaveBeenCalledWith('/api/v1/timetable/overrides', req, 'school-1');
    expect(put).toHaveBeenCalledWith('/api/v1/timetable/overrides/o-1', { substituteTeacherId: 't-3' }, 'school-1');
    expect(del).toHaveBeenCalledWith('/api/v1/timetable/overrides/o-1', 'school-1');
  });

  it('reads the periods needing cover and the free teachers', async () => {
    await getUncoveredPeriods('school-1', '2026-10-14');
    await getFreeTeachers('school-1', '2026-10-14', 3);
    await getFreeTeachers('school-1', '2026-10-14', 3, 'sec-1');
    expect(get.mock.calls).toEqual([
      ['/api/v1/timetable/uncovered?date=2026-10-14', 'school-1'],
      ['/api/v1/timetable/free-teachers?date=2026-10-14&periodNumber=3', 'school-1'],
      ['/api/v1/timetable/free-teachers?date=2026-10-14&periodNumber=3&sectionId=sec-1', 'school-1'],
    ]);
  });
});

describe('rooms', () => {
  it('lists, adds, saves and takes rooms out of use', async () => {
    await listRooms('school-1');
    await listRooms('school-1', true);
    await createRoom('school-1', { name: 'Lab 1', capacity: 40 });
    await updateRoom('school-1', 'r-1', { name: 'Lab 1', capacity: null, active: true });
    await deactivateRoom('school-1', 'r-1');
    expect(get.mock.calls).toEqual([
      ['/api/v1/rooms', 'school-1'],
      ['/api/v1/rooms?includeInactive=true', 'school-1'],
    ]);
    expect(post).toHaveBeenCalledWith('/api/v1/rooms', { name: 'Lab 1', capacity: 40 }, 'school-1');
    expect(put).toHaveBeenCalledWith('/api/v1/rooms/r-1', { name: 'Lab 1', capacity: null, active: true }, 'school-1');
    expect(del).toHaveBeenCalledWith('/api/v1/rooms/r-1', 'school-1');
  });
});
