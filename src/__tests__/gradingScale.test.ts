import {
  describeGradingBands,
  gradingBandErrorMessage,
  gradingBandRowsToRequest,
  parsePercentage,
  validateGradingBands,
  type GradingBandRow,
} from '../utils/gradingScale';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from './i18nFixture';

const band = (min: string, max: string, label: string): GradingBandRow => ({
  minPercentage: min,
  maxPercentage: max,
  label,
});

// The server's built-in defaults: neighbours share a boundary.
const DEFAULTS = [
  band('90', '100', 'A+'),
  band('75', '90', 'A'),
  band('60', '75', 'B'),
  band('45', '60', 'C'),
  band('33', '45', 'D'),
  band('0', '33', 'F'),
];

describe('parsePercentage', () => {
  it('accepts plain decimals', () => {
    expect(parsePercentage('75')).toBe(75);
    expect(parsePercentage(' 32.99 ')).toBe(32.99);
    expect(parsePercentage('.5')).toBe(0.5);
    expect(parsePercentage('-5')).toBe(-5);
  });

  it('rejects what Number() would wrongly accept', () => {
    expect(parsePercentage('')).toBeNull();
    expect(parsePercentage('1e2')).toBeNull();
    expect(parsePercentage('0x10')).toBeNull();
    expect(parsePercentage('abc')).toBeNull();
    expect(parsePercentage('50%')).toBeNull();
  });
});

describe('validateGradingBands', () => {
  it('accepts the built-in defaults (shared boundaries), in any order', () => {
    expect(validateGradingBands(DEFAULTS)).toBeNull();
    expect(validateGradingBands([...DEFAULTS].reverse())).toBeNull();
  });

  it('accepts bands 0.01 apart, since percentages have 2 decimal places', () => {
    expect(
      validateGradingBands([band('0', '32.99', 'F'), band('33', '74.99', 'P'), band('75', '100', 'D')])
    ).toBeNull();
  });

  it('accepts a single band covering everything', () => {
    expect(validateGradingBands([band('0', '100', 'P')])).toBeNull();
  });

  it('refuses an empty scale', () => {
    expect(validateGradingBands([])).toEqual({ code: 'empty' });
  });

  it('refuses a missing, over-long or duplicate label', () => {
    expect(validateGradingBands([band('0', '100', '  ')])).toEqual({ code: 'missingLabel', band: 1 });
    expect(validateGradingBands([band('0', '100', 'Outstanding')])).toEqual({ code: 'labelTooLong', band: 1, max: 10 });
    expect(validateGradingBands([band('0', '50', 'A'), band('50', '100', 'a')])).toEqual({
      code: 'duplicateLabel',
      label: 'a',
    });
  });

  it('refuses numbers that are missing, not numbers, or outside 0-100', () => {
    expect(validateGradingBands([band('', '100', 'A')])).toEqual({ code: 'badNumber', band: 1 });
    expect(validateGradingBands([band('0', '50', 'B'), band('50', '1e2', 'A')])).toEqual({ code: 'badNumber', band: 2 });
    expect(validateGradingBands([band('-5', '100', 'A')])).toEqual({ code: 'outOfRange', band: 1 });
    expect(validateGradingBands([band('0', '120', 'A')])).toEqual({ code: 'outOfRange', band: 1 });
  });

  it('refuses min above max', () => {
    expect(validateGradingBands([band('0', '50', 'B'), band('100', '50', 'A')])).toEqual({ code: 'minAboveMax', band: 2 });
  });

  it('refuses overlapping bands', () => {
    expect(validateGradingBands([band('0', '60', 'B'), band('50', '100', 'A')])).toEqual({
      code: 'overlap',
      label: 'A',
      otherLabel: 'B',
    });
    expect(validateGradingBands([band('0', '100', 'B'), band('0', '100', 'A')])).toMatchObject({ code: 'overlap' });
  });

  it('refuses gaps, including integer bands like 0-32 then 33-100', () => {
    expect(validateGradingBands([band('0', '32', 'F'), band('33', '100', 'P')])).toEqual({ code: 'gap', from: 32, to: 33 });
    expect(validateGradingBands([band('10', '100', 'P')])).toEqual({ code: 'gap', from: 0, to: 10 });
    expect(validateGradingBands([band('0', '90', 'P')])).toEqual({ code: 'gap', from: 90, to: 100 });
  });

  it('compares at 2 decimal places', () => {
    expect(validateGradingBands([band('0', '32.999', 'F'), band('33', '100', 'P')])).toBeNull();
  });
});

describe('gradingBandRowsToRequest', () => {
  it('rounds to 2 places, trims labels and sorts highest band first', () => {
    expect(gradingBandRowsToRequest([band('0', '32.999', ' F '), band('33', '100', 'P')])).toEqual([
      { minPercentage: 33, maxPercentage: 100, label: 'P' },
      { minPercentage: 0, maxPercentage: 33, label: 'F' },
    ]);
  });
});

describe('grading scale messages', () => {
  it('says what to fix', () => {
    expect(gradingBandErrorMessage({ code: 'gap', from: 32, to: 33 }, tEn)).toContain('between 32% and 33%');
    expect(gradingBandErrorMessage({ code: 'labelTooLong', band: 2, max: 10 }, tEn)).toBe(
      'Band 2: a grade can be at most 10 characters.'
    );
    expect(gradingBandErrorMessage({ code: 'overlap', label: 'A', otherLabel: 'B' }, tEn)).toBe('Bands "B" and "A" overlap.');
  });

  it('keeps every message the same as before in English', () => {
    expect(gradingBandErrorMessage({ code: 'empty' }, tEn)).toBe('Add at least one grade band.');
    expect(gradingBandErrorMessage({ code: 'missingLabel', band: 1 }, tEn)).toBe('Band 1: enter a grade, e.g. A+.');
    expect(gradingBandErrorMessage({ code: 'duplicateLabel', label: 'a' }, tEn)).toBe(
      'Grade "a" is used for more than one band.'
    );
    expect(gradingBandErrorMessage({ code: 'badNumber', band: 2 }, tEn)).toBe(
      'Band 2: enter the min and max as numbers, e.g. 75 and 90.'
    );
    expect(gradingBandErrorMessage({ code: 'outOfRange', band: 1 }, tEn)).toBe(
      'Band 1: percentages must be between 0 and 100.'
    );
    expect(gradingBandErrorMessage({ code: 'minAboveMax', band: 2 }, tEn)).toBe(
      "Band 2: the min can't be more than the max."
    );
    expect(gradingBandErrorMessage({ code: 'gap', from: 32.5, to: 33 }, tEn)).toBe(
      'No band covers the percentages between 32.5% and 33%. Bands must cover 0-100% with no gaps.'
    );
  });

  it('keeps the numbers and labels, unescaped, in Hindi', () => {
    const gap = gradingBandErrorMessage({ code: 'gap', from: 32, to: 33 }, tHi);
    expect(gap).toBe(fill(hi.gradingScale.errors.gap, { from: 32, to: 33 }));
    expect(gap).toContain('32%');
    const overlap = gradingBandErrorMessage({ code: 'overlap', label: 'A', otherLabel: 'B' }, tHi);
    expect(overlap).toBe(fill(hi.gradingScale.errors.overlap, { label: 'A', otherLabel: 'B' }));
    expect(overlap).toContain('"B"');
    expect(overlap).not.toContain('&quot;');
  });

  it('lists the bands for the save confirmation', () => {
    expect(
      describeGradingBands([
        { minPercentage: 50, maxPercentage: 100, label: 'P' },
        { minPercentage: 0, maxPercentage: 50, label: 'F' },
      ])
    ).toBe('P  50-100%\nF  0-50%');
  });
});
