import type { TFunction } from 'i18next';

import type { GradingBand } from '../api/types';

/** An editable row of the Grading Scale screen - the numbers are still the text the admin typed. */
export interface GradingBandRow {
  minPercentage: string;
  maxPercentage: string;
  label: string;
}

/** The grading_bands.label column is VARCHAR(10). */
export const MAX_GRADE_LABEL_LENGTH = 10;

/** `band` is the row's 1-based position on screen, so the message can point at it. */
export type GradingBandError =
  | { code: 'empty' }
  | { code: 'missingLabel'; band: number }
  | { code: 'labelTooLong'; band: number; max: number }
  | { code: 'duplicateLabel'; label: string }
  | { code: 'badNumber'; band: number }
  | { code: 'outOfRange'; band: number }
  | { code: 'minAboveMax'; band: number }
  | { code: 'overlap'; label: string; otherLabel: string }
  | { code: 'gap'; from: number; to: number };

const DECIMAL = /^(\d+(\.\d*)?|\.\d+)$/;
const SIGNED_DECIMAL = /^-(\d+(\.\d*)?|\.\d+)$/;

/**
 * A typed percentage, or null if it isn't a plain decimal number. Number() alone would accept
 * "1e2", "0x10" or "" (as 0). A negative number parses, so it's reported as out of range rather
 * than "not a number".
 */
export function parsePercentage(text: string): number | null {
  const trimmed = text.trim();
  if (!DECIMAL.test(trimmed) && !SIGNED_DECIMAL.test(trimmed)) return null;
  return Number(trimmed);
}

/** Percentages are stored and compared to 2 decimal places, so work in whole hundredths. */
function toHundredths(value: number): number {
  return Math.round(value * 100);
}

function round2(value: number): number {
  return toHundredths(value) / 100;
}

/**
 * Mirrors the server's checks on PUT /grading-scale, so the admin sees the problem before saving:
 * at least one band; each band has a label of at most 10 characters (no two the same, ignoring
 * case); min and max are numbers from 0 to 100 with min no more than max; and together the bands
 * cover 0-100 with no overlaps or gaps. Neighbouring bands may share a boundary (75-90 and 90-100,
 * like the built-in defaults: a percentage on the boundary gets the higher band) or be 0.01 apart
 * (75-89.99 and 90-100). Returns null when valid.
 */
export function validateGradingBands(rows: GradingBandRow[]): GradingBandError | null {
  if (rows.length === 0) return { code: 'empty' };

  const bands: { min: number; max: number; label: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const band = i + 1;
    const label = rows[i].label.trim();
    if (!label) return { code: 'missingLabel', band };
    if (label.length > MAX_GRADE_LABEL_LENGTH) return { code: 'labelTooLong', band, max: MAX_GRADE_LABEL_LENGTH };
    const min = parsePercentage(rows[i].minPercentage);
    const max = parsePercentage(rows[i].maxPercentage);
    if (min === null || max === null) return { code: 'badNumber', band };
    if (min < 0 || min > 100 || max < 0 || max > 100) return { code: 'outOfRange', band };
    if (toHundredths(min) > toHundredths(max)) return { code: 'minAboveMax', band };
    bands.push({ min: toHundredths(min), max: toHundredths(max), label });
  }

  const seen = new Set<string>();
  for (const { label } of bands) {
    const key = label.toLowerCase();
    if (seen.has(key)) return { code: 'duplicateLabel', label };
    seen.add(key);
  }

  const sorted = [...bands].sort((a, b) => a.min - b.min || a.max - b.max);
  if (sorted[0].min > 0) return { code: 'gap', from: 0, to: sorted[0].min / 100 };
  for (let i = 1; i < sorted.length; i++) {
    const lower = sorted[i - 1];
    const upper = sorted[i];
    if (upper.min < lower.max || upper.min === lower.min) {
      return { code: 'overlap', label: upper.label, otherLabel: lower.label };
    }
    if (upper.min - lower.max > 1) return { code: 'gap', from: lower.max / 100, to: upper.min / 100 };
  }
  const top = sorted[sorted.length - 1];
  if (top.max < 10000) return { code: 'gap', from: top.max / 100, to: 100 };
  return null;
}

/** The PUT /grading-scale body: numbers rounded to 2 places, labels trimmed, highest band first. */
export function gradingBandRowsToRequest(rows: GradingBandRow[]): Omit<GradingBand, 'id'>[] {
  return rows
    .map((r) => ({
      minPercentage: round2(parsePercentage(r.minPercentage) ?? 0),
      maxPercentage: round2(parsePercentage(r.maxPercentage) ?? 0),
      label: r.label.trim(),
    }))
    .sort((a, b) => b.minPercentage - a.minPercentage);
}

export function gradingBandErrorMessage(error: GradingBandError, t: TFunction): string {
  switch (error.code) {
    case 'empty':
      return t('gradingScale.errors.empty');
    case 'missingLabel':
      return t('gradingScale.errors.missingLabel', { band: error.band });
    case 'labelTooLong':
      return t('gradingScale.errors.labelTooLong', { band: error.band, max: error.max });
    case 'duplicateLabel':
      return t('gradingScale.errors.duplicateLabel', { label: error.label });
    case 'badNumber':
      return t('gradingScale.errors.badNumber', { band: error.band });
    case 'outOfRange':
      return t('gradingScale.errors.outOfRange', { band: error.band });
    case 'minAboveMax':
      return t('gradingScale.errors.minAboveMax', { band: error.band });
    case 'overlap':
      return t('gradingScale.errors.overlap', { label: error.label, otherLabel: error.otherLabel });
    case 'gap':
      return t('gradingScale.errors.gap', { from: error.from, to: error.to });
  }
}

/**
 * The pass mark, as a percentage, from the school's grading scale. The lowest band is "fail" and
 * every other band is a pass, so it's the second-lowest band's minimum - the server grades with the
 * highest band whose minimum is at or below the percentage. 33 with the built-in scale. Null when
 * the scale has fewer than 2 bands: there's no pass/fail line to draw, and guessing 33% would be wrong
 * for a school that changed its scale.
 */
export function passMarkFromScale(bands: Pick<GradingBand, 'minPercentage'>[]): number | null {
  if (bands.length < 2) return null;
  const sorted = [...bands].sort((a, b) => a.minPercentage - b.minPercentage);
  return sorted[1].minPercentage;
}

/** Whether `marks` out of `maxMarks` reaches the pass mark, with the percentage rounded to 2 places. */
export function isPassingMark(marks: number, maxMarks: number, passMark: number): boolean {
  return round2((marks * 100) / maxMarks) >= passMark;
}

/** One line per band, highest first ("A+  90-100%"), for the save confirmation. */
export function describeGradingBands(bands: Omit<GradingBand, 'id'>[]): string {
  return bands.map((b) => `${b.label}  ${b.minPercentage}-${b.maxPercentage}%`).join('\n');
}
