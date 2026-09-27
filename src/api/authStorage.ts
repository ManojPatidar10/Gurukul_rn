import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import type { LoginResponse } from './types';

const SESSION_KEY = 'gurukul.session';
// The refresh token outlives the access token by days and can mint new ones, so it goes in the
// OS keychain/keystore rather than AsyncStorage's plain on-disk JSON. The rest of the session
// (including the short-lived access token) stays where it always was.
const REFRESH_TOKEN_KEY = 'gurukul.refreshToken';

export type Session = LoginResponse;

export async function getStoredSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  const session = JSON.parse(raw) as Session;
  const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null);
  return refreshToken ? { ...session, refreshToken } : session;
}

/** Call after every login, refresh and profile switch - the refresh token rotates each time. */
export async function setStoredSession(session: Session) {
  const { refreshToken, ...rest } = session;
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(rest));
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  }
}

export async function clearStoredSession() {
  await Promise.all([AsyncStorage.removeItem(SESSION_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)]);
}
