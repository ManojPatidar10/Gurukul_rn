import AsyncStorage from '@react-native-async-storage/async-storage';

import { revokeSession } from '../api/client';
import { clearPushRegistration, getLastExpoPushToken, updatePushStatus } from '../push/pushStatus';

jest.mock('expo-notifications', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

let bodies: any[];

beforeEach(async () => {
  bodies = [];
  globalThis.fetch = jest.fn(async (_url: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  }) as any;
  clearPushRegistration();
  await AsyncStorage.clear();
});

describe('revokeSession', () => {
  it('sends the push token with the refresh token so the backend unbinds this phone', () => {
    revokeSession({ refreshToken: 'refresh-1', expoPushToken: 'ExponentPushToken[abc]' });
    expect(bodies).toEqual([{ refreshToken: 'refresh-1', expoPushToken: 'ExponentPushToken[abc]' }]);
  });

  it('still unbinds the phone for a session saved before refresh tokens existed', () => {
    revokeSession({ refreshToken: null, expoPushToken: 'ExponentPushToken[abc]' });
    expect(bodies).toEqual([{ expoPushToken: 'ExponentPushToken[abc]' }]);
  });

  it('sends nothing when there is nothing to revoke', () => {
    revokeSession({ refreshToken: null, expoPushToken: null });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe('getLastExpoPushToken', () => {
  it('returns the token registered this launch', async () => {
    updatePushStatus({ expoPushToken: 'ExponentPushToken[now]' });
    await expect(getLastExpoPushToken()).resolves.toBe('ExponentPushToken[now]');
  });

  it('falls back to the token saved on an earlier launch', async () => {
    await AsyncStorage.setItem('gurukul.expoPushToken', 'ExponentPushToken[before]');
    await expect(getLastExpoPushToken()).resolves.toBe('ExponentPushToken[before]');
  });

  it('forgets the token after logout', async () => {
    updatePushStatus({ expoPushToken: 'ExponentPushToken[now]' });
    clearPushRegistration();
    await new Promise((r) => setTimeout(r, 0));
    await expect(getLastExpoPushToken()).resolves.toBeNull();
  });
});
