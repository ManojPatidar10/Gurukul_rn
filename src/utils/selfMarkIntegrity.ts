import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { LocationIntegrity } from '../../modules/location-integrity';
import { ApiError } from '../api/client';
import { getSelfMarkNonce } from '../api/staffAttendance';
import type { SelfMarkAttendanceRequest, SelfMarkNonce } from '../api/types';
import { SelfMarkLocationError } from './selfMarkLocation';

const INTEGRITY_MESSAGES: Record<string, string> = {
  ERR_INTEGRITY_PLAY_OUTDATED: 'Update Google Play services and the Google Play Store app on this phone, then try again.',
  ERR_INTEGRITY_PLAY_MISSING:
    "Self check-in needs the Google Play Store and Google Play services, signed in with a Google account. Ask an admin to mark your attendance if this phone doesn't have them.",
  ERR_INTEGRITY_NETWORK: 'Check your internet connection, then try again.',
  ERR_INTEGRITY_TRANSIENT: "Google's security check is busy. Wait a minute, then try again.",
  ERR_INTEGRITY_APP_NOT_INSTALLED: 'Install Smart Gurukul from the Play Store, then try again.',
};

const DEFAULT_INTEGRITY_MESSAGE =
  "Smart Gurukul couldn't check this phone. Update Smart Gurukul from the Play Store, then try again.";

/** What to tell the user when the phone couldn't get a Play Integrity token (the native module's reject code). */
export function integrityErrorMessage(code: unknown): string {
  return (typeof code === 'string' && INTEGRITY_MESSAGES[code]) || DEFAULT_INTEGRITY_MESSAGE;
}

/**
 * The server refused the check-in over Play Integrity (INTEGRITY_TOKEN_MISSING, INTEGRITY_UNAVAILABLE,
 * ...). Its message is written for the teacher and says what to do, so it's shown as sent.
 */
export function isIntegrityRefusal(error: unknown): error is ApiError {
  return error instanceof ApiError && !!error.errorCode?.startsWith('INTEGRITY_') && !!error.message;
}

export interface PlayIntegrityDeps {
  platform: 'android' | 'ios';
  /** Null when the server has no nonce endpoint (an older backend). */
  fetchNonce: () => Promise<SelfMarkNonce | null>;
  /** Null when the native module is missing or predates Play Integrity. */
  requestToken: ((nonce: string, cloudProjectNumber: string) => Promise<string>) | null;
  cloudProjectNumber: string | null;
}

/** The code an Expo native module rejected with, e.g. 'ERR_INTEGRITY_NETWORK'. */
function rejectCode(error: unknown): unknown {
  return typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
}

async function requestIntegrityToken(nonce: string, deps: PlayIntegrityDeps): Promise<string> {
  if (!deps.requestToken) throw new SelfMarkLocationError(integrityErrorMessage('ERR_INTEGRITY_UNSUPPORTED'));
  if (!deps.cloudProjectNumber) throw new SelfMarkLocationError(integrityErrorMessage('ERR_INTEGRITY_CONFIG'));
  let token: string;
  try {
    token = await deps.requestToken(nonce, deps.cloudProjectNumber);
  } catch (e) {
    throw new SelfMarkLocationError(integrityErrorMessage(rejectCode(e)));
  }
  if (typeof token !== 'string' || !token) throw new SelfMarkLocationError(integrityErrorMessage('ERR_INTEGRITY_UNKNOWN'));
  return token;
}

/**
 * Adds the platform and, on Android when the server asks for it, a Play Integrity token bound to a
 * fresh server nonce. The server makes the real decision; this only gets the token and explains
 * what went wrong on the phone. In REPORT mode a failed token never stops the check-in; in ENFORCE
 * (or a mode this build doesn't know) it does, because the server would refuse it anyway.
 */
export async function withPlayIntegrity(
  request: SelfMarkAttendanceRequest,
  deps: PlayIntegrityDeps
): Promise<SelfMarkAttendanceRequest> {
  if (deps.platform === 'ios') return { ...request, platform: 'ios' };

  const withPlatform: SelfMarkAttendanceRequest = { ...request, platform: 'android' };
  const nonce = await deps.fetchNonce();
  if (!nonce || nonce.integrityMode === 'OFF') return withPlatform;

  if (nonce.integrityMode === 'REPORT') {
    try {
      const integrityToken = await requestIntegrityToken(nonce.nonce, deps);
      return { ...withPlatform, integrityToken, integrityNonce: nonce.nonce };
    } catch {
      return withPlatform;
    }
  }

  const integrityToken = await requestIntegrityToken(nonce.nonce, deps);
  return { ...withPlatform, integrityToken, integrityNonce: nonce.nonce };
}

function configuredCloudProjectNumber(): string | null {
  const value: unknown = Constants.expoConfig?.extra?.playIntegrityCloudProjectNumber;
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nativeTokenRequester(): PlayIntegrityDeps['requestToken'] {
  const native = LocationIntegrity;
  return native?.requestIntegrityToken ? native.requestIntegrityToken.bind(native) : null;
}

/** The real dependencies: this phone's OS, the nonce endpoint, the native module and app.json's project number. */
export function defaultIntegrityDeps(schoolId: string): PlayIntegrityDeps {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    fetchNonce: () =>
      getSelfMarkNonce(schoolId).catch((e: unknown) => {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }),
    requestToken: nativeTokenRequester(),
    cloudProjectNumber: configuredCloudProjectNumber(),
  };
}
