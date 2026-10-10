import Constants from 'expo-constants';

import { ApiError } from '../api/client';
import { getSelfMarkNonce } from '../api/staffAttendance';
import type { IntegrityMode, SelfMarkAttendanceRequest, SelfMarkNonce } from '../api/types';
import {
  defaultIntegrityDeps,
  integrityErrorMessage,
  isIntegrityRefusal,
  withPlayIntegrity,
  type PlayIntegrityDeps,
} from '../utils/selfMarkIntegrity';
import { SelfMarkLocationError } from '../utils/selfMarkLocation';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  getCurrentPositionAsync: jest.fn(),
}));
jest.mock('../../modules/location-integrity', () => ({
  LocationIntegrity: { getDeviceChecks: jest.fn(), requestIntegrityToken: jest.fn() },
}));
jest.mock('../api/staffAttendance', () => ({
  getSelfMarkNonce: jest.fn(),
}));
// The real app.json extra, so the test also catches the project number going missing from it.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { ...jest.requireActual('../../app.json').expo.extra } } },
}));

const DEFAULT_MESSAGE =
  "Smart Gurukul couldn't check this phone. Update Smart Gurukul from the Play Store, then try again.";

const located: SelfMarkAttendanceRequest = {
  latitude: 26.9,
  longitude: 75.8,
  accuracy: 12,
  mocked: false,
  fixTimestamp: 1000,
  deviceChecks: { developerOptionsEnabled: false, rooted: false, appCloned: false },
};

function nonce(integrityMode: IntegrityMode | string): SelfMarkNonce {
  return {
    nonce: 'Qm9vbXNoYWthbGFrYWJvb21zaGFrYWxh',
    expiresAt: '2026-10-10T03:05:00Z',
    integrityMode: integrityMode as IntegrityMode,
  };
}

/** A native rejection the way Expo modules deliver it: an Error carrying the reject code. */
function nativeError(code: string) {
  return Object.assign(new Error('Play Integrity error -3'), { code });
}

function deps(overrides: Partial<PlayIntegrityDeps> = {}): PlayIntegrityDeps {
  return {
    platform: 'android',
    fetchNonce: jest.fn().mockResolvedValue(nonce('ENFORCE')),
    requestToken: jest.fn().mockResolvedValue('token-123'),
    cloudProjectNumber: '855182407063',
    ...overrides,
  };
}

describe('integrityErrorMessage', () => {
  it.each([
    ['ERR_INTEGRITY_PLAY_OUTDATED', 'Update Google Play services and the Google Play Store app on this phone, then try again.'],
    [
      'ERR_INTEGRITY_PLAY_MISSING',
      "Self check-in needs the Google Play Store and Google Play services, signed in with a Google account. Ask an admin to mark your attendance if this phone doesn't have them.",
    ],
    ['ERR_INTEGRITY_NETWORK', 'Check your internet connection, then try again.'],
    ['ERR_INTEGRITY_TRANSIENT', "Google's security check is busy. Wait a minute, then try again."],
    ['ERR_INTEGRITY_APP_NOT_INSTALLED', 'Install Smart Gurukul from the Play Store, then try again.'],
  ])('words %s', (code, message) => {
    expect(integrityErrorMessage(code)).toBe(message);
  });

  it.each([['ERR_INTEGRITY_CONFIG'], ['ERR_INTEGRITY_UNKNOWN'], ['ERR_INTEGRITY_UNSUPPORTED'], ['SOMETHING_NEW'], [undefined], [42], [null]])(
    'falls back to "update the app" for %p',
    (code) => {
      expect(integrityErrorMessage(code)).toBe(DEFAULT_MESSAGE);
    }
  );
});

describe('isIntegrityRefusal', () => {
  it('matches the server integrity refusals, including the 503', () => {
    expect(isIntegrityRefusal(new ApiError('Self check-in can’t be verified', 503, 'INTEGRITY_UNAVAILABLE'))).toBe(true);
    expect(isIntegrityRefusal(new ApiError('Update Smart Gurukul', 400, 'INTEGRITY_TOKEN_MISSING'))).toBe(true);
  });

  it('leaves every other error to getErrorMessage', () => {
    expect(isIntegrityRefusal(new ApiError('Already set', 409, 'ATTENDANCE_SET_BY_ADMIN'))).toBe(false);
    expect(isIntegrityRefusal(new ApiError('Bad gateway', 503))).toBe(false);
    expect(isIntegrityRefusal(new ApiError('', 503, 'INTEGRITY_UNAVAILABLE'))).toBe(false);
    expect(isIntegrityRefusal(new Error('INTEGRITY_UNAVAILABLE'))).toBe(false);
  });
});

describe('withPlayIntegrity', () => {
  it('iOS: marks the platform and never asks for a nonce', async () => {
    const d = deps({ platform: 'ios' });
    await expect(withPlayIntegrity(located, d)).resolves.toEqual({ ...located, platform: 'ios' });
    expect(d.fetchNonce).not.toHaveBeenCalled();
    expect(d.requestToken).not.toHaveBeenCalled();
  });

  it('Android with an older backend (no nonce endpoint): sends the platform only', async () => {
    const d = deps({ fetchNonce: jest.fn().mockResolvedValue(null) });
    await expect(withPlayIntegrity(located, d)).resolves.toEqual({ ...located, platform: 'android' });
    expect(d.requestToken).not.toHaveBeenCalled();
  });

  it('Android in OFF mode: sends the platform only', async () => {
    const d = deps({ fetchNonce: jest.fn().mockResolvedValue(nonce('OFF')) });
    await expect(withPlayIntegrity(located, d)).resolves.toEqual({ ...located, platform: 'android' });
    expect(d.requestToken).not.toHaveBeenCalled();
  });

  it('Android in REPORT mode: attaches the token and its nonce', async () => {
    const d = deps({ fetchNonce: jest.fn().mockResolvedValue(nonce('REPORT')) });
    await expect(withPlayIntegrity(located, d)).resolves.toEqual({
      ...located,
      platform: 'android',
      integrityToken: 'token-123',
      integrityNonce: 'Qm9vbXNoYWthbGFrYWJvb21zaGFrYWxh',
    });
    expect(d.requestToken).toHaveBeenCalledWith('Qm9vbXNoYWthbGFrYWJvb21zaGFrYWxh', '855182407063');
  });

  it.each<[string, Partial<PlayIntegrityDeps>]>([
    ['the token request fails', { requestToken: jest.fn().mockRejectedValue(nativeError('ERR_INTEGRITY_NETWORK')) }],
    ['the native function is missing', { requestToken: null }],
    ['the project number is missing', { cloudProjectNumber: null }],
  ])('Android in REPORT mode: still checks in when %s', async (_, overrides) => {
    const d = deps({ fetchNonce: jest.fn().mockResolvedValue(nonce('REPORT')), ...overrides });
    await expect(withPlayIntegrity(located, d)).resolves.toEqual({ ...located, platform: 'android' });
  });

  it('Android in ENFORCE mode: attaches the token and its nonce', async () => {
    await expect(withPlayIntegrity(located, deps())).resolves.toEqual({
      ...located,
      platform: 'android',
      integrityToken: 'token-123',
      integrityNonce: 'Qm9vbXNoYWthbGFrYWJvb21zaGFrYWxh',
    });
  });

  it('Android in ENFORCE mode: a failed token request stops the check-in with the matching message', async () => {
    const d = deps({ requestToken: jest.fn().mockRejectedValue(nativeError('ERR_INTEGRITY_PLAY_OUTDATED')) });
    const attempt = withPlayIntegrity(located, d);
    await expect(attempt).rejects.toBeInstanceOf(SelfMarkLocationError);
    await expect(attempt).rejects.toThrow('Update Google Play services and the Google Play Store app on this phone, then try again.');
  });

  it('Android in ENFORCE mode: a rejection without a code gets the "update the app" message', async () => {
    const d = deps({ requestToken: jest.fn().mockRejectedValue(new Error('boom')) });
    await expect(withPlayIntegrity(located, d)).rejects.toThrow(DEFAULT_MESSAGE);
  });

  it('Android in ENFORCE mode: an empty token is a failure', async () => {
    const d = deps({ requestToken: jest.fn().mockResolvedValue('') });
    await expect(withPlayIntegrity(located, d)).rejects.toThrow(DEFAULT_MESSAGE);
  });

  it('Android in ENFORCE mode without the native function: asks for an app update', async () => {
    const attempt = withPlayIntegrity(located, deps({ requestToken: null }));
    await expect(attempt).rejects.toBeInstanceOf(SelfMarkLocationError);
    await expect(attempt).rejects.toThrow(DEFAULT_MESSAGE);
  });

  it('Android in ENFORCE mode without a project number: refuses before asking Play', async () => {
    const d = deps({ cloudProjectNumber: null });
    await expect(withPlayIntegrity(located, d)).rejects.toThrow(DEFAULT_MESSAGE);
    expect(d.requestToken).not.toHaveBeenCalled();
  });

  it('Android in a mode this build does not know: behaves like ENFORCE', async () => {
    const ok = deps({ fetchNonce: jest.fn().mockResolvedValue(nonce('STRICT')) });
    await expect(withPlayIntegrity(located, ok)).resolves.toMatchObject({ integrityToken: 'token-123' });

    const failing = deps({
      fetchNonce: jest.fn().mockResolvedValue(nonce('STRICT')),
      requestToken: jest.fn().mockRejectedValue(nativeError('ERR_INTEGRITY_TRANSIENT')),
    });
    await expect(withPlayIntegrity(located, failing)).rejects.toThrow(
      "Google's security check is busy. Wait a minute, then try again."
    );
  });

  it('lets nonce errors other than "no endpoint" through', async () => {
    const failure = new ApiError('Request failed with status 500', 500);
    const d = deps({ fetchNonce: jest.fn().mockRejectedValue(failure) });
    await expect(withPlayIntegrity(located, d)).rejects.toBe(failure);
  });
});

describe('defaultIntegrityDeps', () => {
  const getNonce = getSelfMarkNonce as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it('turns a 404 from the nonce endpoint into "no nonce"', async () => {
    getNonce.mockRejectedValue(new ApiError('Not found', 404));
    await expect(defaultIntegrityDeps('school-1').fetchNonce()).resolves.toBeNull();
    expect(getNonce).toHaveBeenCalledWith('school-1');
  });

  it('passes other nonce errors on', async () => {
    const failure = new ApiError('Forbidden', 403);
    getNonce.mockRejectedValue(failure);
    await expect(defaultIntegrityDeps('school-1').fetchNonce()).rejects.toBe(failure);
  });

  it('returns the nonce when the endpoint answers', async () => {
    getNonce.mockResolvedValue(nonce('REPORT'));
    await expect(defaultIntegrityDeps('school-1').fetchNonce()).resolves.toEqual(nonce('REPORT'));
  });

  it('wires up the native token request and the project number from app.json', () => {
    const d = defaultIntegrityDeps('school-1');
    expect(d.requestToken).toEqual(expect.any(Function));
    expect(d.cloudProjectNumber).toBe('855182407063');
  });

  it.each<[unknown, string | null]>([
    [855182407063, '855182407063'],
    [' 855182407063 ', '855182407063'],
    ['', null],
    [undefined, null],
  ])('reads the project number %p as %p', (configured, expected) => {
    const extra = Constants.expoConfig!.extra!;
    const original: unknown = extra.playIntegrityCloudProjectNumber;
    extra.playIntegrityCloudProjectNumber = configured;
    try {
      expect(defaultIntegrityDeps('school-1').cloudProjectNumber).toBe(expected);
    } finally {
      extra.playIntegrityCloudProjectNumber = original;
    }
  });
});
