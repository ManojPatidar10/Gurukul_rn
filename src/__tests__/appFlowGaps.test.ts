import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StaffAttendanceEntry, StudentResult } from '../api/types';
import { endSessionOnServer } from '../push/pushLogout';
import { clearPushRegistration, getLastExpoPushToken, updatePushStatus } from '../push/pushStatus';
import { buildResultsPayload } from '../utils/assessmentResults';
import { changedStaffAttendanceRecords } from '../utils/staffAttendance';

jest.mock('expo-notifications', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function student(id: string, saved: Partial<StudentResult> = {}): StudentResult {
  return { studentId: id, studentName: `Student ${id}`, rollNumber: id, marksObtained: null, absent: false, remarks: null, ...saved };
}

describe('buildResultsPayload', () => {
  it('leaves out blank rows that were never saved', () => {
    const { results, invalid } = buildResultsPayload(
      [student('1'), student('2'), student('3')],
      { '1': { marksText: '42', absent: false }, '2': { marksText: '  ', absent: false }, '3': { marksText: '', absent: true } },
      50
    );
    expect(invalid).toEqual([]);
    expect(results).toEqual([
      { studentId: '1', absent: false, marksObtained: 42 },
      { studentId: '3', absent: true },
    ]);
  });

  it('still sends a cleared row that had a saved mark, so the mark can be undone', () => {
    const { results } = buildResultsPayload(
      [student('1', { marksObtained: 30 }), student('2', { absent: true })],
      { '1': { marksText: '', absent: false }, '2': { marksText: '', absent: false } },
      50
    );
    expect(results).toEqual([
      { studentId: '1', absent: false },
      { studentId: '2', absent: false },
    ]);
  });

  it('keeps saved remarks, which the backend would otherwise overwrite', () => {
    const { results } = buildResultsPayload(
      [student('1', { marksObtained: 30, remarks: 'Improving' })],
      { '1': { marksText: '35', absent: false } },
      50
    );
    expect(results).toEqual([{ studentId: '1', absent: false, marksObtained: 35, remarks: 'Improving' }]);
  });

  it('flags marks that are not a number or are out of range', () => {
    const { invalid } = buildResultsPayload(
      [student('1'), student('2'), student('3'), student('4')],
      {
        '1': { marksText: '4o', absent: false },
        '2': { marksText: '-1', absent: false },
        '3': { marksText: '51', absent: false },
        '4': { marksText: '50', absent: false },
      },
      50
    );
    expect(invalid.map((s) => s.studentId)).toEqual(['1', '2', '3']);
  });
});

function staff(id: string, saved: Partial<StaffAttendanceEntry> = {}): StaffAttendanceEntry {
  return { employeeId: id, employeeName: `Staff ${id}`, designation: 'Teacher', status: null, remarks: null, selfMarked: false, method: null, ...saved };
}

describe('changedStaffAttendanceRecords', () => {
  it('sends only rows whose status changed, carrying their remarks', () => {
    const entries = [
      staff('a', { status: 'PRESENT', selfMarked: true }),
      staff('b', { status: 'PRESENT', remarks: 'Left early' }),
      staff('c'),
      staff('d'),
    ];
    expect(changedStaffAttendanceRecords(entries, { a: 'PRESENT', b: 'HALF_DAY', c: 'ABSENT' })).toEqual([
      { employeeId: 'b', status: 'HALF_DAY', remarks: 'Left early' },
      { employeeId: 'c', status: 'ABSENT', remarks: undefined },
    ]);
  });
});

describe('endSessionOnServer', () => {
  let calls: { url: string; init: any }[];

  beforeEach(async () => {
    calls = [];
    clearPushRegistration();
    await AsyncStorage.clear();
  });

  it('unregisters the push token with the old access token before revoking the session', async () => {
    globalThis.fetch = jest.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 204, headers: { get: () => null }, json: async () => ({}) };
    }) as any;
    updatePushStatus({ expoPushToken: 'ExponentPushToken[abc]' });

    await endSessionOnServer({ accessToken: 'access-1', refreshToken: 'refresh-1', schoolId: 'school-1' });

    expect(calls.map((c) => c.init.method)).toEqual(['DELETE', 'POST']);
    expect(calls[0].url).toContain('/api/v1/notifications/device-token?expoPushToken=ExponentPushToken%5Babc%5D');
    expect(calls[0].init.headers).toMatchObject({ Authorization: 'Bearer access-1', 'X-School-Id': 'school-1' });
    expect(JSON.parse(calls[0].init.body)).toEqual({ expoPushToken: 'ExponentPushToken[abc]' });
    expect(calls[1].url).toContain('/api/v1/auth/logout');
    await expect(getLastExpoPushToken()).resolves.toBeNull();
  });

  it('still logs out when the server lacks the endpoint or is unreachable', async () => {
    globalThis.fetch = jest.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      if (init.method === 'DELETE') throw new TypeError('Network request failed');
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
    }) as any;
    updatePushStatus({ expoPushToken: 'ExponentPushToken[abc]' });

    await expect(endSessionOnServer({ accessToken: 'access-1', refreshToken: 'refresh-1' })).resolves.toBeUndefined();
    expect(calls.map((c) => c.init.method)).toEqual(['DELETE', 'POST']);
  });

  it('skips the unregister when this phone never got a push token', async () => {
    globalThis.fetch = jest.fn(async (url: string, init: any) => {
      calls.push({ url, init });
      return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({}) };
    }) as any;

    await endSessionOnServer({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(calls.map((c) => c.init.method)).toEqual(['POST']);
  });
});
