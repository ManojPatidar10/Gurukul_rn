import { validateFeeStructureLines } from '../utils/feeStructureLines';

describe('validateFeeStructureLines', () => {
  it('parses every amount, grouped or not, in line order', () => {
    expect(
      validateFeeStructureLines([
        { feeCategoryId: 'tuition', amount: '15,000' },
        { feeCategoryId: 'transport', amount: '2500.50' },
        { feeCategoryId: 'lab', amount: ' ₹ 1,200 ' },
      ])
    ).toEqual({ error: null, amounts: [15000, 2500.5, 1200] });
  });

  it('needs at least one line', () => {
    expect(validateFeeStructureLines([])).toEqual({ error: 'fees.structureForm.errors.noLines', amounts: [] });
  });

  it('needs a category on every line', () => {
    expect(validateFeeStructureLines([{ feeCategoryId: '', amount: '100' }]).error).toBe(
      'fees.structureForm.errors.missingCategory'
    );
  });

  it('refuses an unreadable, zero or over-precise amount', () => {
    for (const amount of ['', 'abc', '0', '0.00', '-5', '100.555', '1e5']) {
      expect(validateFeeStructureLines([{ feeCategoryId: 'tuition', amount }]).error).toBe(
        'fees.structureForm.errors.invalidAmount'
      );
    }
    expect(validateFeeStructureLines([{ feeCategoryId: 'tuition', amount: '0.01' }]).error).toBeNull();
  });

  it('refuses the same category twice', () => {
    expect(
      validateFeeStructureLines([
        { feeCategoryId: 'tuition', amount: '100' },
        { feeCategoryId: 'tuition', amount: '200' },
      ])
    ).toEqual({ error: 'fees.structureForm.errors.duplicateCategory', amounts: [] });
  });
});
