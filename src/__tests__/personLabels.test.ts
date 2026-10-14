import type { UserRole } from '../api/types';
import hi from '../i18n/locales/hi.json';
import { tEn, tHi } from '../testUtils/i18nFixture';
import {
  GENDER_KEYS,
  PERSON_STATUS_KEYS,
  ROLE_KEYS,
  genderLabel,
  personStatusLabel,
  roleLabel,
  type Gender,
  type PersonStatus,
} from '../utils/personLabels';

const STATUSES: PersonStatus[] = ['ACTIVE', 'INACTIVE', 'ALUMNI', 'WITHDRAWN'];
const GENDERS: Gender[] = ['MALE', 'FEMALE', 'OTHER'];
const ROLES: UserRole[] = ['ADMIN', 'TEACHER', 'STUDENT', 'PARENT', 'DRIVER'];

describe('personStatusLabel', () => {
  it('has a key for every student and staff status, and each key is in the locale files', () => {
    expect(Object.keys(PERSON_STATUS_KEYS).sort()).toEqual([...STATUSES].sort());
    for (const key of Object.values(PERSON_STATUS_KEYS)) expect(tEn(key)).not.toBe(key);
  });

  it('names each status in words, not the raw code', () => {
    expect(STATUSES.map((s) => personStatusLabel(s, tEn))).toEqual(['Active', 'Inactive', 'Alumni', 'Withdrawn']);
    expect(STATUSES.map((s) => personStatusLabel(s, tHi))).toEqual([
      hi.common.active,
      hi.common.inactive,
      hi.auth.alumniBadge,
      hi.auth.withdrawnBadge,
    ]);
  });

  it('shows a status a newer server adds as sent, and never a raw key', () => {
    expect(personStatusLabel('SUSPENDED', tHi)).toBe('SUSPENDED');
    expect(personStatusLabel('toString', tEn)).toBe('toString');
  });
});

describe('genderLabel', () => {
  it('has a key for every gender the backend sends', () => {
    expect(Object.keys(GENDER_KEYS).sort()).toEqual([...GENDERS].sort());
  });

  it('names each gender with the words the student form offers', () => {
    expect(GENDERS.map((g) => genderLabel(g, tEn))).toEqual(['Male', 'Female', 'Other']);
    expect(GENDERS.map((g) => genderLabel(g, tHi))).toEqual([hi.common.male, hi.common.female, hi.common.other]);
  });

  it('keeps a blank or unknown value as it is', () => {
    expect(genderLabel('', tHi)).toBe('');
    expect(genderLabel('NON_BINARY', tHi)).toBe('NON_BINARY');
  });
});

describe('roleLabel', () => {
  it('has a key for every role a session can have', () => {
    expect(Object.keys(ROLE_KEYS).sort()).toEqual([...ROLES].sort());
  });

  it('names each role in words', () => {
    expect(ROLES.map((r) => roleLabel(r, tEn))).toEqual(['Principal/Admin', 'Teacher', 'Student', 'Parent', 'Bus driver']);
    expect(ROLES.map((r) => roleLabel(r, tHi))).toEqual(ROLES.map((r) => hi.profile.roles[r]));
  });

  it('shows a role a newer server adds as sent', () => {
    expect(roleLabel('ACCOUNTANT', tHi)).toBe('ACCOUNTANT');
  });
});
