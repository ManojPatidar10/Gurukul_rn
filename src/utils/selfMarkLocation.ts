import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { LocationIntegrity, type DeviceChecks } from '../../modules/location-integrity';
import type { SelfMarkAttendanceRequest } from '../api/types';

/**
 * Why self-marking stopped on the phone, before anything was sent. The message is the English
 * wording; `code` says which problem it was - a SelfMarkProblemCode, or the ERR_INTEGRITY_* code of a
 * Play Integrity failure - so the screen can say it in the app's language (selfMarkMessages.ts).
 */
export class SelfMarkLocationError extends Error {
  constructor(
    message: string,
    readonly code?: string
  ) {
    super(message);
  }
}

export type DeviceCheckProblemCode = 'NO_CHECKS' | 'APP_CLONED' | 'ROOTED' | 'DEVELOPER_OPTIONS';

/** A device-check failure (deviceCheckProblemCode) or a mocked fix. */
export type SelfMarkProblemCode = DeviceCheckProblemCode | 'MOCKED';

export const MOCKED_LOCATION_MESSAGE =
  'Your phone is using a fake (mock) location. Turn off any fake GPS app and try again.';

/**
 * Which problem in these device checks rules out self-marking, or null when they're clean. A missing
 * native module means an app build from before these checks, which can't prove anything about the
 * phone. The order matters: it's the one reason the teacher is told.
 */
export function deviceCheckProblemCode(checks: DeviceChecks | null): DeviceCheckProblemCode | null {
  if (!checks) return 'NO_CHECKS';
  if (checks.appCloned) return 'APP_CLONED';
  if (checks.rooted) return 'ROOTED';
  if (checks.developerOptionsEnabled) return 'DEVELOPER_OPTIONS';
  return null;
}

const DEVICE_CHECK_MESSAGES: Record<DeviceCheckProblemCode, string> = {
  NO_CHECKS: 'This version of the app can’t verify your location. Update Smart Gurukul and try again.',
  APP_CLONED:
    'Smart Gurukul is running inside a cloner app (like Parallel Space or Dual Space). Open it directly from your home screen and try again.',
  ROOTED:
    'Attendance can’t be self-marked from a rooted or jailbroken phone, because the location can be faked. Ask an admin to mark it for you.',
  DEVELOPER_OPTIONS:
    'Turn off Developer options in your phone’s Settings, then try again. Fake GPS apps work through Developer options, so check-in is blocked while they’re on.',
};

/** Why these device checks rule out self-marking, in English, or null when they're clean. */
export function deviceCheckProblem(checks: DeviceChecks | null): string | null {
  const code = deviceCheckProblemCode(checks);
  return code ? DEVICE_CHECK_MESSAGES[code] : null;
}

/**
 * Takes a fresh fix plus the device checks, refusing anything that could be faked. The server
 * repeats every check, so this is for a clear message, not the security boundary.
 */
export async function readSelfMarkLocation(): Promise<SelfMarkAttendanceRequest> {
  const deviceChecks = LocationIntegrity?.getDeviceChecks() ?? null;
  const problem = deviceCheckProblemCode(deviceChecks);
  if (problem || !deviceChecks) {
    throw new SelfMarkLocationError(deviceCheckProblem(deviceChecks) ?? '', problem ?? undefined);
  }

  let fix: { latitude: number; longitude: number; accuracy?: number; timestamp: number; mocked: boolean };
  if (Platform.OS === 'ios' && LocationIntegrity?.getCurrentFix) {
    // expo-location never reports mock locations on iOS; the native reading does.
    fix = await LocationIntegrity.getCurrentFix();
  } else {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    fix = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
      timestamp: position.timestamp,
      mocked: position.mocked ?? false,
    };
  }
  if (fix.mocked) {
    throw new SelfMarkLocationError(MOCKED_LOCATION_MESSAGE, 'MOCKED' satisfies SelfMarkProblemCode);
  }

  return {
    latitude: fix.latitude,
    longitude: fix.longitude,
    accuracy: fix.accuracy,
    mocked: fix.mocked,
    fixTimestamp: fix.timestamp,
    deviceChecks,
  };
}
