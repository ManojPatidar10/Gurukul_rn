import { formatRupees, fromPaise, parseRupees, rupeesInputValue, sumRupees, toPaise } from '../utils/money';

describe('parseRupees', () => {
  it('reads plain, grouped and decorated amounts', () => {
    expect(parseRupees('15000')).toBe(15000);
    expect(parseRupees('15,000')).toBe(15000);
    expect(parseRupees('15000.50')).toBe(15000.5);
    expect(parseRupees('1,50,000.5')).toBe(150000.5);
    expect(parseRupees(' ₹ 2,500 ')).toBe(2500);
    expect(parseRupees('Rs. 1,000')).toBe(1000);
    expect(parseRupees('rs 750.25')).toBe(750.25);
    expect(parseRupees('0.01')).toBe(0.01);
    expect(parseRupees('0')).toBe(0);
  });

  it('refuses more than 2 decimals instead of rounding', () => {
    expect(parseRupees('100.555')).toBeNull();
    expect(parseRupees('99.999')).toBeNull();
  });

  it('refuses anything that is not a plain amount', () => {
    for (const junk of ['1e5', '0x10', '-5', '+5', '', '   ', '.', '5.', '.5', 'abc', '12a', '1.2.3', '₹', null, undefined]) {
      expect(parseRupees(junk)).toBeNull();
    }
  });

  it('refuses more than 10 rupee digits (the backend column)', () => {
    expect(parseRupees('9999999999.99')).toBe(9999999999.99);
    expect(parseRupees('10000000000')).toBeNull();
  });
});

describe('paise maths', () => {
  it('converts both ways', () => {
    expect(toPaise(15000.5)).toBe(1500050);
    expect(toPaise(0.29)).toBe(29);
    expect(toPaise(-2500)).toBe(-250000);
    expect(toPaise(-0.001)).toBe(0);
    expect(fromPaise(1500050)).toBe(15000.5);
  });

  it('adds without floating-point drift', () => {
    expect(sumRupees([0.1, 0.2])).toBe(0.3);
    expect(sumRupees([1500.25, 999.75, 0.01])).toBe(2500.01);
    expect(sumRupees([])).toBe(0);
  });
});

describe('formatRupees', () => {
  it('uses Indian grouping and shows paise only when there are some', () => {
    expect(formatRupees(0)).toBe('₹0');
    expect(formatRupees(999)).toBe('₹999');
    expect(formatRupees(1500)).toBe('₹1,500');
    expect(formatRupees(1500.5)).toBe('₹1,500.50');
    expect(formatRupees(150000)).toBe('₹1,50,000');
    expect(formatRupees(12345678.9)).toBe('₹1,23,45,678.90');
    expect(formatRupees(-2500)).toBe('-₹2,500');
  });

  it('can always show 2 decimals, or leave the symbol off', () => {
    expect(formatRupees(1500, { decimals: 'always' })).toBe('₹1,500.00');
    expect(formatRupees(0.5, { decimals: 'always' })).toBe('₹0.50');
    expect(formatRupees(150000, { symbol: false })).toBe('1,50,000');
  });

  it('rounds to the paisa first', () => {
    expect(formatRupees(1500.499)).toBe('₹1,500.50');
    expect(formatRupees(0.004)).toBe('₹0');
  });

  it('shows a dash for a missing amount', () => {
    expect(formatRupees(null)).toBe('—');
    expect(formatRupees(undefined)).toBe('—');
    expect(formatRupees(Number.NaN)).toBe('—');
  });
});

describe('rupeesInputValue', () => {
  it('prefills an input without grouping', () => {
    expect(rupeesInputValue(15000)).toBe('15000');
    expect(rupeesInputValue(15000.5)).toBe('15000.50');
    expect(rupeesInputValue(0.05)).toBe('0.05');
    expect(rupeesInputValue(0)).toBe('0');
  });

  it('round-trips through parseRupees', () => {
    for (const amount of [1, 15000, 15000.5, 0.01, 123456.78]) {
      expect(parseRupees(rupeesInputValue(amount))).toBe(amount);
    }
  });
});
