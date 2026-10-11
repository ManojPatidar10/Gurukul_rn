import { parseRupees, toPaise } from './money';

export interface FeeStructureLineDraft {
  feeCategoryId: string;
  /** What the admin typed: "15000", "15,000" or "15,000.50". */
  amount: string;
}

/**
 * Checks a new fee structure's lines before it's sent: at least one line, a category on every line,
 * a readable amount of at least 0.01 with at most 2 decimals on every line, and no category twice
 * (the backend refuses that with a 400 too). Returns the first problem as an i18n key, or the parsed
 * amounts in line order when there's none.
 */
export function validateFeeStructureLines(lines: readonly FeeStructureLineDraft[]): {
  error: string | null;
  amounts: number[];
} {
  if (lines.length === 0) return { error: 'fees.structureForm.errors.noLines', amounts: [] };
  if (lines.some((line) => !line.feeCategoryId)) return { error: 'fees.structureForm.errors.missingCategory', amounts: [] };

  const amounts = lines.map((line) => parseRupees(line.amount));
  if (amounts.some((amount) => amount === null || toPaise(amount) < 1)) {
    return { error: 'fees.structureForm.errors.invalidAmount', amounts: [] };
  }

  const categories = new Set(lines.map((line) => line.feeCategoryId));
  if (categories.size !== lines.length) return { error: 'fees.structureForm.errors.duplicateCategory', amounts: [] };

  return { error: null, amounts: amounts as number[] };
}
