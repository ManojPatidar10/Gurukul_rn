import { linkChildNumber, linkedChildSummary } from '../utils/linkChild';

describe('linkChildNumber', () => {
  it('trims the typed or pasted number', () => {
    expect(linkChildNumber('  2026000123 \n')).toBe('2026000123');
    expect(linkChildNumber('2026000123')).toBe('2026000123');
  });

  it('is empty for a blank value, so there is nothing to send', () => {
    expect(linkChildNumber('')).toBe('');
    expect(linkChildNumber('   ')).toBe('');
  });
});

describe('linkedChildSummary', () => {
  it("names the linked child and their class from the backend's reply", () => {
    expect(linkedChildSummary({ name: 'Asha Verma', classSectionLabel: 'Class 6 - A' })).toEqual({
      name: 'Asha Verma',
      classSection: 'Class 6 - A',
    });
  });

  it('is null for a backend that returns no child, so the generic confirmation shows', () => {
    expect(linkedChildSummary(null)).toBeNull();
    expect(linkedChildSummary(undefined)).toBeNull();
  });

  it('is null when the name or class is missing, rather than showing an empty name or "()"', () => {
    expect(linkedChildSummary({ name: 'Asha', classSectionLabel: '' })).toBeNull();
    expect(linkedChildSummary({ name: ' ', classSectionLabel: 'Class 6 - A' })).toBeNull();
    expect(linkedChildSummary({ name: 'Asha', classSectionLabel: null as unknown as string })).toBeNull();
  });
});
