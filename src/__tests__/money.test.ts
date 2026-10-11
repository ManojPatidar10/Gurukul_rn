import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import {
  amountInputText,
  amountProblemKey,
  formatAmount,
  formatInr,
  fromPaise,
  MAX_AMOUNT_PAISE,
  parseInrAmount,
  sumInr,
  toPaise,
  type AmountProblem,
} from '../utils/money';

type Tree = { [key: string]: string | Tree };
const at = (tree: Tree, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Tree)?.[part], tree);

describe('parseInrAmount', () => {
  it('reads amounts with commas, spaces and a rupee sign', () => {
    expect(parseInrAmount('15,000')).toEqual({ ok: true, value: 15000, paise: 1500000 });
    expect(parseInrAmount('₹ 1,23,456.5')).toEqual({ ok: true, value: 123456.5, paise: 12345650 });
    expect(parseInrAmount(' 2500 ')).toEqual({ ok: true, value: 2500, paise: 250000 });
    expect(parseInrAmount('Rs. 2,500.75')).toEqual({ ok: true, value: 2500.75, paise: 250075 });
    expect(parseInrAmount('rs 99')).toEqual({ ok: true, value: 99, paise: 9900 });
    expect(parseInrAmount('0.01')).toEqual({ ok: true, value: 0.01, paise: 1 });
  });

  it('refuses anything that is not plain digits', () => {
    for (const text of ['1e5', '0x10', 'abc', '1.2.3', '.', '12a', '₹', '5-']) {
      expect(parseInrAmount(text)).toEqual({ ok: false, problem: 'invalid' });
    }
  });

  it('says a leading minus is negative, and empty is empty', () => {
    expect(parseInrAmount('-5')).toEqual({ ok: false, problem: 'negative' });
    expect(parseInrAmount('-₹500')).toEqual({ ok: false, problem: 'negative' });
    expect(parseInrAmount('')).toEqual({ ok: false, problem: 'empty' });
    expect(parseInrAmount('   ')).toEqual({ ok: false, problem: 'empty' });
  });

  it('allows at most 2 decimals once trailing zeros are dropped', () => {
    expect(parseInrAmount('100.555')).toEqual({ ok: false, problem: 'decimals' });
    expect(parseInrAmount('100.500')).toEqual({ ok: true, value: 100.5, paise: 10050 });
    expect(parseInrAmount('0.001')).toEqual({ ok: false, problem: 'decimals' });
  });

  it('refuses 0 unless allowed', () => {
    expect(parseInrAmount('0')).toEqual({ ok: false, problem: 'zero' });
    expect(parseInrAmount('0.00')).toEqual({ ok: false, problem: 'zero' });
    expect(parseInrAmount('0', { allowZero: true })).toEqual({ ok: true, value: 0, paise: 0 });
  });

  it('refuses more than the maximum', () => {
    expect(parseInrAmount('9999999999.99')).toEqual({ ok: true, value: 9999999999.99, paise: MAX_AMOUNT_PAISE });
    expect(parseInrAmount('10000000000')).toEqual({ ok: false, problem: 'tooLarge' });
    expect(parseInrAmount('99999999999999999999')).toEqual({ ok: false, problem: 'tooLarge' });
    expect(parseInrAmount('1000000', { maxPaise: 100_000_000 })).toEqual({ ok: true, value: 1000000, paise: 100_000_000 });
    expect(parseInrAmount('1000000.01', { maxPaise: 100_000_000 })).toEqual({ ok: false, problem: 'tooLarge' });
  });
});

describe('formatInr', () => {
  it('uses Indian grouping and always 2 decimals', () => {
    expect(formatInr(25000.5)).toBe('₹25,000.50');
    expect(formatInr(12345678)).toBe('₹1,23,45,678.00');
    expect(formatInr(412500)).toBe('₹4,12,500.00');
    expect(formatInr(0)).toBe('₹0.00');
    expect(formatInr(999.5)).toBe('₹999.50');
    expect(formatInr(1000)).toBe('₹1,000.00');
    expect(formatInr(0.1 + 0.2)).toBe('₹0.30');
    expect(formatAmount(26500.25)).toBe('26,500.25');
  });

  it('puts the minus before the rupee sign, and shows a dash when there is no amount', () => {
    expect(formatInr(-500)).toBe('-₹500.00');
    expect(formatInr(null)).toBe('—');
    expect(formatInr(undefined)).toBe('—');
    expect(formatInr(Number.NaN)).toBe('—');
    expect(formatInr(null, '')).toBe('');
  });
});

describe('paise helpers', () => {
  it('adds in paise, so float error never shows', () => {
    expect(sumInr([0.1, 0.2])).toBe(0.3);
    expect(sumInr([100.1, null, undefined, 200.2])).toBe(300.3);
    expect(sumInr([])).toBe(0);
    expect(toPaise(19.99)).toBe(1999);
    expect(fromPaise(1999)).toBe(19.99);
  });

  it('prefills inputs without grouping', () => {
    expect(amountInputText(15000)).toBe('15000');
    expect(amountInputText(15000.5)).toBe('15000.50');
    expect(amountInputText(0.05)).toBe('0.05');
    expect(amountInputText(null)).toBe('');
    expect(amountInputText(-20)).toBe('-20');
  });

  it('has words for every problem in both languages', () => {
    const problems: AmountProblem[] = ['empty', 'invalid', 'negative', 'zero', 'decimals', 'tooLarge'];
    for (const problem of problems) {
      const key = amountProblemKey(problem);
      expect(key).toBe(`money.errors.${problem}`);
      expect(at(en as Tree, key)).toEqual(expect.any(String));
      expect(at(hi as Tree, key)).toEqual(expect.any(String));
    }
  });
});
