import type { TFunction } from 'i18next';

import type { UserRole } from '../api/types';

/**
 * A student's or staff member's record status: ACTIVE, ALUMNI or WITHDRAWN for a student (the
 * backend's StudentStatus), ACTIVE or INACTIVE for staff (EmployeeStatus). The API types it as a
 * plain string, so this names the values the app knows.
 */
export type PersonStatus = 'ACTIVE' | 'INACTIVE' | 'ALUMNI' | 'WITHDRAWN';

/** The values the backend's Gender enum sends for a student or an admission. */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

/**
 * The words for a record status, on status chips and the ID card: "Active", "Inactive", "Alumni",
 * "Withdrawn". Full keys, so the label test can check every one resolves.
 */
export const PERSON_STATUS_KEYS: Record<PersonStatus, string> = {
  ACTIVE: 'common.active',
  INACTIVE: 'common.inactive',
  ALUMNI: 'auth.alumniBadge',
  WITHDRAWN: 'auth.withdrawnBadge',
};

/** The words for a gender: "Male", "Female", "Other" - the labels the student and admission forms offer. */
export const GENDER_KEYS: Record<Gender, string> = {
  MALE: 'common.male',
  FEMALE: 'common.female',
  OTHER: 'common.other',
};

/** The words for the signed-in role on the Profile screen: "Teacher", "Parent", "Bus driver", ... */
export const ROLE_KEYS: Record<UserRole, string> = {
  ADMIN: 'profile.roles.ADMIN',
  TEACHER: 'profile.roles.TEACHER',
  STUDENT: 'profile.roles.STUDENT',
  PARENT: 'profile.roles.PARENT',
  DRIVER: 'profile.roles.DRIVER',
};

/** A value from one of the maps above in words; one the app doesn't know (a newer server's) shows as sent. */
function label(keys: Record<string, string>, value: string, t: TFunction): string {
  const key = Object.prototype.hasOwnProperty.call(keys, value) ? keys[value] : undefined;
  return key ? t(key) : value;
}

/** A record status in words. */
export function personStatusLabel(status: string, t: TFunction): string {
  return label(PERSON_STATUS_KEYS, status, t);
}

/** A gender in words. A blank value stays blank, so the detail row shows its usual dash. */
export function genderLabel(gender: string, t: TFunction): string {
  return label(GENDER_KEYS, gender, t);
}

/** A signed-in role in words. */
export function roleLabel(role: string, t: TFunction): string {
  return label(ROLE_KEYS, role, t);
}
