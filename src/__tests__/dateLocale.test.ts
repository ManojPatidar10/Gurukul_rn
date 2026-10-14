import { dateLocale } from '../i18n/dateLocale';

describe('dateLocale', () => {
  it('formats dates in Hindi when the app is in Hindi', () => {
    expect(dateLocale('hi')).toBe('hi');
    expect(dateLocale('hi-IN')).toBe('hi');
  });

  it("keeps the phone's own locale otherwise, so English dates don't change", () => {
    expect(dateLocale('en')).toBeUndefined();
    expect(dateLocale('en-IN')).toBeUndefined();
    expect(dateLocale(undefined)).toBeUndefined();
    expect(dateLocale('')).toBeUndefined();
  });

  it('gives Hindi month names in Hindi, and exactly the old text in English', () => {
    const date = new Date(2026, 9, 14);
    const options: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };
    expect(date.toLocaleDateString(dateLocale('hi'), options)).toBe(date.toLocaleDateString('hi', options));
    expect(date.toLocaleDateString(dateLocale('hi'), options)).toMatch(/[ऀ-ॿ]/);
    expect(date.toLocaleDateString(dateLocale('en'), options)).toBe(date.toLocaleDateString(undefined, options));
  });
});
