import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LoginResponse } from './types';

const SESSION_KEY = 'gurukul.session';

export type Session = LoginResponse;

export async function getStoredSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function setStoredSession(session: Session) {
  return AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  return AsyncStorage.removeItem(SESSION_KEY);
}
