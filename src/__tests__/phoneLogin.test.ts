import type { SchoolSearchResult } from '../api/types';
import { normalizePhone, phoneLookupOutcome } from '../utils/phoneLogin';

const school = (id: string, name = `School ${id}`): SchoolSearchResult => ({ id, name, city: 'Jaipur', state: 'Rajasthan' });

describe('normalizePhone', () => {
  it('drops the spaces, dashes and brackets people type between digit groups', () => {
    expect(normalizePhone(' 70679 35654 ')).toBe('7067935654');
    expect(normalizePhone('70679-35654')).toBe('7067935654');
    expect(normalizePhone('(070) 679.35654')).toBe('07067935654'.slice(1));
  });

  it('drops a country code or trunk zero only when a 10-digit number is left', () => {
    expect(normalizePhone('+91 7067935654')).toBe('7067935654');
    expect(normalizePhone('917067935654')).toBe('7067935654');
    expect(normalizePhone('07067935654')).toBe('7067935654');
    // Not a 10-digit Indian mobile underneath: sent as typed, since the school may store it that way.
    expect(normalizePhone('+1 415 555 0100')).toBe('14155550100');
    expect(normalizePhone('9000')).toBe('9000');
  });
});

describe('phoneLookupOutcome', () => {
  it('goes straight to the one school that knows the number', () => {
    expect(phoneLookupOutcome([school('a')])).toEqual({ kind: 'single', school: school('a') });
  });

  it('asks which school when the number is on file at several', () => {
    const schools = [school('a'), school('b')];
    expect(phoneLookupOutcome(schools)).toEqual({ kind: 'choose', schools });
  });

  it('reports a number registered nowhere', () => {
    expect(phoneLookupOutcome([])).toEqual({ kind: 'none' });
  });
});
