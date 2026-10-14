import * as Location from 'expo-location';

import { LocationIntegrity, type DeviceChecks } from '../../modules/location-integrity';
import type { SelfMarkAttendanceRequest } from '../api/types';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import { integrityErrorMessage, withPlayIntegrity, type PlayIntegrityDeps } from '../utils/selfMarkIntegrity';
import {
  deviceCheckProblem,
  MOCKED_LOCATION_MESSAGE,
  readSelfMarkLocation,
  SelfMarkLocationError,
} from '../utils/selfMarkLocation';
import { selfMarkErrorText } from '../utils/selfMarkMessages';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../modules/location-integrity', () => ({
  LocationIntegrity: { getDeviceChecks: jest.fn() },
}));
jest.mock('../api/staffAttendance', () => ({ getSelfMarkNonce: jest.fn() }));

/**
 * The screen words a phone-side refusal by its code (selfMarkErrorText). These tests take each error
 * from the real helpers - readSelfMarkLocation and withPlayIntegrity - and hold the English to the
 * helpers' own message, so a message edited in one place but not the other fails here.
 */

const problems = hi.staffAttendance.selfMark.problems;
const clean: DeviceChecks = { developerOptionsEnabled: false, rooted: false, appCloned: false };
const getDeviceChecks = LocationIntegrity!.getDeviceChecks as jest.Mock;
const getCurrentPositionAsync = Location.getCurrentPositionAsync as jest.Mock;

const located: SelfMarkAttendanceRequest = {
  latitude: 26.9,
  longitude: 75.8,
  accuracy: 12,
  mocked: false,
  fixTimestamp: 1000,
  deviceChecks: clean,
};

async function refusal(attempt: Promise<unknown>): Promise<SelfMarkLocationError> {
  try {
    await attempt;
  } catch (e) {
    if (e instanceof SelfMarkLocationError) return e;
    throw e;
  }
  throw new Error('expected the attempt to be refused');
}

/** ENFORCE mode, so a failed Play Integrity token stops the check-in with an IntegrityTokenError. */
function enforce(overrides: Partial<PlayIntegrityDeps>): PlayIntegrityDeps {
  return {
    platform: 'android',
    fetchNonce: jest.fn().mockResolvedValue({ nonce: 'n', expiresAt: '2026-10-14T03:05:00Z', integrityMode: 'ENFORCE' }),
    requestToken: jest.fn().mockResolvedValue('token-123'),
    cloudProjectNumber: '855182407063',
    ...overrides,
  };
}

const rejectWith = (code: string) => jest.fn().mockRejectedValue(Object.assign(new Error('Play Integrity error'), { code }));

beforeEach(() => {
  jest.clearAllMocks();
  getDeviceChecks.mockReturnValue(clean);
  getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: 26.9, longitude: 75.8, accuracy: 12 },
    timestamp: 1000,
    mocked: false,
  });
});

describe('selfMarkErrorText: the phone checks', () => {
  it.each<[string, DeviceChecks | null, string]>([
    ['an app build without the native checks', null, problems.noChecks],
    ['a cloner app', { ...clean, appCloned: true }, problems.appCloned],
    ['a rooted phone', { ...clean, rooted: true }, problems.rooted],
    ['Developer options', { ...clean, developerOptionsEnabled: true }, problems.developerOptions],
  ])('words %s like the helper does, and in Hindi', async (_, checks, hindi) => {
    getDeviceChecks.mockReturnValue(checks);
    const error = await refusal(readSelfMarkLocation());
    expect(selfMarkErrorText(error, tEn)).toBe(deviceCheckProblem(checks));
    expect(selfMarkErrorText(error, tEn)).toBe(error.message);
    expect(selfMarkErrorText(error, tHi)).toBe(fill(hindi));
  });

  it('keeps the helper order: a cloner app is named before Developer options', async () => {
    getDeviceChecks.mockReturnValue({ developerOptionsEnabled: true, rooted: true, appCloned: true });
    const error = await refusal(readSelfMarkLocation());
    expect(error.code).toBe('APP_CLONED');
    expect(selfMarkErrorText(error, tHi)).toBe(fill(problems.appCloned));
  });

  it('words a mocked fix like the helper does, and in Hindi', async () => {
    getCurrentPositionAsync.mockResolvedValue({ coords: { latitude: 1, longitude: 2 }, timestamp: 1, mocked: true });
    const error = await refusal(readSelfMarkLocation());
    expect(selfMarkErrorText(error, tEn)).toBe(MOCKED_LOCATION_MESSAGE);
    expect(selfMarkErrorText(error, tHi)).toBe(fill(problems.mocked));
  });
});

describe('selfMarkErrorText: Play Integrity on the phone', () => {
  it.each<[string, string]>([
    ['ERR_INTEGRITY_PLAY_OUTDATED', problems.playOutdated],
    ['ERR_INTEGRITY_PLAY_MISSING', problems.playMissing],
    ['ERR_INTEGRITY_NETWORK', problems.network],
    ['ERR_INTEGRITY_TRANSIENT', problems.busy],
    ['ERR_INTEGRITY_APP_NOT_INSTALLED', problems.appNotInstalled],
    ['ERR_INTEGRITY_SOMETHING_NEW', problems.unknown],
  ])('words %s like the helper does, and in Hindi', async (code, hindi) => {
    const error = await refusal(withPlayIntegrity(located, enforce({ requestToken: rejectWith(code) })));
    expect(error.code).toBe(code);
    expect(selfMarkErrorText(error, tEn)).toBe(integrityErrorMessage(code));
    expect(selfMarkErrorText(error, tEn)).toBe(error.message);
    expect(selfMarkErrorText(error, tHi)).toBe(fill(hindi));
  });

  it.each<[string, Partial<PlayIntegrityDeps>, string]>([
    ['the native function is missing', { requestToken: null }, 'ERR_INTEGRITY_UNSUPPORTED'],
    ['the project number is missing', { cloudProjectNumber: null }, 'ERR_INTEGRITY_CONFIG'],
    ['the rejection has no code', { requestToken: jest.fn().mockRejectedValue(new Error('boom')) }, 'ERR_INTEGRITY_UNKNOWN'],
    ['Google Play never answers', { requestToken: () => new Promise<string>(() => {}), tokenTimeoutMs: 1 }, 'ERR_INTEGRITY_TIMEOUT'],
  ])('words the failure when %s like the helper does', async (_, overrides, code) => {
    const error = await refusal(withPlayIntegrity(located, enforce(overrides)));
    expect(error.code).toBe(code);
    expect(selfMarkErrorText(error, tEn)).toBe(integrityErrorMessage(code));
    expect(selfMarkErrorText(error, tHi)).toBe(
      fill(code === 'ERR_INTEGRITY_TIMEOUT' ? problems.busy : problems.unknown)
    );
  });
});

describe('selfMarkErrorText: anything else', () => {
  it('shows the error’s own message when it has no code, or one this build has no words for', () => {
    expect(selfMarkErrorText(new SelfMarkLocationError('Something new went wrong.'), tHi)).toBe('Something new went wrong.');
    expect(selfMarkErrorText(new SelfMarkLocationError('Something new went wrong.', 'BRAND_NEW'), tHi)).toBe(
      'Something new went wrong.'
    );
  });
});
