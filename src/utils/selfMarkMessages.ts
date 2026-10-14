import type { TFunction } from 'i18next';

import type { SelfMarkLocationError } from './selfMarkLocation';

/**
 * The words for each reason self check-in stopped on the phone, by SelfMarkProblemCode or
 * ERR_INTEGRITY_* code. The English values in en.json are the helpers' own messages, word for word
 * (deviceCheckProblem, MOCKED_LOCATION_MESSAGE, integrityErrorMessage); selfMarkMessages.test.ts
 * holds them to that.
 */
const PROBLEM_KEYS: Partial<Record<string, string>> = {
  NO_CHECKS: 'staffAttendance.selfMark.problems.noChecks',
  APP_CLONED: 'staffAttendance.selfMark.problems.appCloned',
  ROOTED: 'staffAttendance.selfMark.problems.rooted',
  DEVELOPER_OPTIONS: 'staffAttendance.selfMark.problems.developerOptions',
  MOCKED: 'staffAttendance.selfMark.problems.mocked',
  ERR_INTEGRITY_PLAY_OUTDATED: 'staffAttendance.selfMark.problems.playOutdated',
  ERR_INTEGRITY_PLAY_MISSING: 'staffAttendance.selfMark.problems.playMissing',
  ERR_INTEGRITY_NETWORK: 'staffAttendance.selfMark.problems.network',
  ERR_INTEGRITY_TRANSIENT: 'staffAttendance.selfMark.problems.busy',
  ERR_INTEGRITY_TIMEOUT: 'staffAttendance.selfMark.problems.busy',
  ERR_INTEGRITY_APP_NOT_INSTALLED: 'staffAttendance.selfMark.problems.appNotInstalled',
};

/** Every other Play Integrity code (ERR_INTEGRITY_UNKNOWN, _UNSUPPORTED, _CONFIG, a new one) gets the general advice. */
const UNKNOWN_INTEGRITY_KEY = 'staffAttendance.selfMark.problems.unknown';

/**
 * What to tell the teacher when self check-in stopped on the phone, in the app's language, chosen by
 * the error's code. An error without a code (or with one this build has no words for) shows its own
 * English message, never a raw key.
 */
export function selfMarkErrorText(error: SelfMarkLocationError, t: TFunction): string {
  const { code } = error;
  if (!code) return error.message;
  const key = Object.prototype.hasOwnProperty.call(PROBLEM_KEYS, code)
    ? PROBLEM_KEYS[code]
    : code.startsWith('ERR_')
      ? UNKNOWN_INTEGRITY_KEY
      : undefined;
  return key ? t(key) : error.message;
}
