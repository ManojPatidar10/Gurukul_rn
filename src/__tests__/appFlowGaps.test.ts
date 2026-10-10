import AsyncStorage from '@react-native-async-storage/async-storage';

import type { StaffAttendanceEntry, StudentResult } from '../api/types';
import { endSessionOnServer } from '../push/pushLogout';
import { clearPushRegistration, getLastExpoPushToken, updatePushStatus } from '../push/pushStatus';
import { buildResultsPayload, type ResultRowState } from '../utils/assessmentResults';
import { changedStaffAttendanceRecords } from '../utils/staffAttendance';

jest.mock('expo-notifications', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

function student(id: string, saved: Partial<StudentResult> = {}): StudentResult {
  return { studentId: id, studentName: `Student ${id}`, rollNumber: id, marksObtained: null, absent: false, remarks: null, ...saved };
}

function row(marksText: string, absent = false, remarksText = '', excused = false): ResultRowState {
  return { marksText, absent, excused, remarksText };
}

describe('buildResultsPayload', () => {
  it('leaves out blank rows that were never saved', () => {
    const { results, invalid } = buildResultsPayload(
      [student('1'), student('2'), student('3')],
      { '1': row('42'), '2': row('  '), '3': row('', true) },
      50
    );
    expect(invalid).toEqual([]);
    expect(results).toEqual([
      { studentId: '1', absent: false, marksObtained: 42 },
      { studentId: '3', absent: true },
    ]);
  });

  it('still sends a cleared row that had a saved mark, absence or remark, so it can be undone', () => {
    const { results } = buildResultsPayload(
      [student('1', { marksObtained: 30 }), student('2', { absent: true }), student('3', { remarks: 'Late' })],
      { '1': row(''), '2': row(''), '3': row('') },
      50
    );
    expect(results).toEqual([
      { studentId: '1', absent: false },
      { studentId: '2', absent: false },
      { studentId: '3', absent: false },
    ]);
  });

  it('sends the remark typed on the row, trimmed, since the backend replaces the stored one', () => {
    const { results } = buildResultsPayload(
      [student('1', { marksObtained: 30, remarks: 'Improving' })],
      { '1': row('35', false, '  Much improved  ') },
      50
    );
    expect(results).toEqual([{ studentId: '1', absent: false, marksObtained: 35, remarks: 'Much improved' }]);
  });

  it('sends a remark-only row, and an absent row with its remark', () => {
    const { results } = buildResultsPayload(
      [student('1'), student('2')],
      { '1': row('', false, 'Did not submit'), '2': row('12', true, 'Medical leave') },
      50
    );
    expect(results).toEqual([
      { studentId: '1', absent: false, remarks: 'Did not submit' },
      { studentId: '2', absent: true, remarks: 'Medical leave' },
    ]);
  });

  it('sends excused on every row only to a server that knows Excused', () => {
    const roster = [student('1'), student('2'), student('3', { excused: true }), student('4')];
    const rows = { '1': row('', false, '', true), '2': row('42'), '3': row(''), '4': row('', true) };
    // A server that sends `excused` back: an excused row goes like an absent one, with no marks,
    // and un-ticking a saved Excused sends the row blank so it can be undone.
    expect(buildResultsPayload(roster, rows, 50, { supportsExcused: true }).results).toEqual([
      { studentId: '1', absent: false, excused: true },
      { studentId: '2', absent: false, excused: false, marksObtained: 42 },
      { studentId: '3', absent: false, excused: false },
      { studentId: '4', absent: true, excused: false },
    ]);
    // An older server never gets the field.
    const { results } = buildResultsPayload([student('2'), student('4')], { '2': row('42'), '4': row('', true) }, 50);
    expect(results).toEqual([
      { studentId: '2', absent: false, marksObtained: 42 },
      { studentId: '4', absent: true },
    ]);
    expect(results.some((r) => 'excused' in r)).toBe(false);
  });

  it('flags marks that are not a strict number from 0 to max marks', () => {
    const { invalid } = buildResultsPayload(
      [student('1'), student('2'), student('3'), student('4'), student('5'), student('6')],
      {
        '1': row('4o'),
        '2': row('-1'),
        '3': row('51'),
        '4': row('50'),
        '5': row('1e1'),
        '6': row('12.345'),
      },
      50
    );
    expect(invalid.map((s) => s.studentId)).toEqual(['1', '2', '3', '5', '6']);
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
