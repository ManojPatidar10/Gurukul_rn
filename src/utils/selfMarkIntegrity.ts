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
  ERR_INTEGRITY_TIMEOUT: "Google's security check is busy. Wait a minute, then try again.",
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

/**
 * How long to wait for Google Play before giving up. Play can stall on a broken Play install, and the
 * wait counts against the server's 2-minute limit on the age of the location fix taken before it.
 */
export const INTEGRITY_TOKEN_TIMEOUT_MS = 20 * 1000;

export interface PlayIntegrityDeps {
  platform: 'android' | 'ios';
  /** Null when the server has no nonce endpoint (an older backend). */
  fetchNonce: () => Promise<SelfMarkNonce | null>;
  /** Null when the native module is missing or predates Play Integrity. */
  requestToken: ((nonce: string, cloudProjectNumber: string) => Promise<string>) | null;
  cloudProjectNumber: string | null;
  /** Called just before Google Play is asked for a token, so the screen only says so when it happens. */
  onRequestingToken?: () => void;
  /** Defaults to INTEGRITY_TOKEN_TIMEOUT_MS. */
  tokenTimeoutMs?: number;
}

/**
 * The phone couldn't get a Play Integrity token. The message is for the teacher; `code` (an
 * ERR_INTEGRITY_* code) goes to the server in REPORT mode as `integrityClientError`.
 */
class IntegrityTokenError extends SelfMarkLocationError {
  constructor(public code: string) {
    super(integrityErrorMessage(code));
  }
}

// What the server may be sent as integrityClientError: short and log-safe (its limit is 64 characters).
const CLIENT_ERROR_CODE = /^ERR_[A-Z0-9_]{1,60}$/;

/** The code an Expo native module rejected with (e.g. 'ERR_INTEGRITY_NETWORK'), or ERR_INTEGRITY_UNKNOWN. */
function rejectCode(error: unknown): string {
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === 'string' && CLIENT_ERROR_CODE.test(code) ? code : 'ERR_INTEGRITY_UNKNOWN';
}

/** `promise`, or an ERR_INTEGRITY_TIMEOUT failure if it hasn't settled within `ms`. */
function withTokenTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new IntegrityTokenError('ERR_INTEGRITY_TIMEOUT')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function requestIntegrityToken(nonce: string, deps: PlayIntegrityDeps): Promise<string> {
  if (!deps.requestToken) throw new IntegrityTokenError('ERR_INTEGRITY_UNSUPPORTED');
  if (!deps.cloudProjectNumber) throw new IntegrityTokenError('ERR_INTEGRITY_CONFIG');
  deps.onRequestingToken?.();
  let token: string;
  try {
    token = await withTokenTimeout(
      deps.requestToken(nonce, deps.cloudProjectNumber),
      deps.tokenTimeoutMs ?? INTEGRITY_TOKEN_TIMEOUT_MS
    );
  } catch (e) {
    throw e instanceof IntegrityTokenError ? e : new IntegrityTokenError(rejectCode(e));
  }
  if (typeof token !== 'string' || !token) throw new IntegrityTokenError('ERR_INTEGRITY_UNKNOWN');
  return token;
}

/**
 * Adds the platform and, on Android when the server asks for it, a Play Integrity token bound to a
 * fresh server nonce. The server makes the real decision; this only gets the token and explains
 * what went wrong on the phone. In REPORT mode a failed token never stops the check-in, and its code
 * goes along as `integrityClientError` so the server's log can tell "this phone can't get a token"
 * from "an older app build"; in ENFORCE (or a mode this build doesn't know) it does stop it, because
 * the server would refuse it anyway.
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
    } catch (e) {
      return { ...withPlatform, integrityClientError: e instanceof IntegrityTokenError ? e.code : 'ERR_INTEGRITY_UNKNOWN' };
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

// How a backend without the nonce endpoint answers: GlobalExceptionHandler's unknown-path 404, or a 404
// without our JSON body. The endpoint's own 404 ("Employee not found") must reach the teacher instead.
const NO_NONCE_ENDPOINT = /^(Resource not found|Request failed with status 404$)/;

function isMissingNonceEndpoint(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404 && NO_NONCE_ENDPOINT.test(error.message);
}

/** The real dependencies: this phone's OS, the nonce endpoint, the native module and app.json's project number. */
export function defaultIntegrityDeps(schoolId: string): PlayIntegrityDeps {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    fetchNonce: () =>
      getSelfMarkNonce(schoolId).catch((e: unknown) => {
        if (isMissingNonceEndpoint(e)) return null;
        throw e;
      }),
    requestToken: nativeTokenRequester(),
    cloudProjectNumber: configuredCloudProjectNumber(),
  };
}
