import type { PayrollRunDetail, PayrollRunStatus, PayrollSkippedEmployee, SalaryStructure } from '../api/types';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import { tEn, tHi } from '../testUtils/i18nFixture';
import {
  amountInputText,
  conflictData,
  formatAmount,
  formatInr,
  formatPayrollDate,
  lineStatusLabel,
  lineStatusVariant,
  lineWarningText,
  parseAmount,
  PAYROLL_LINE_STATUSES,
  PAYROLL_PAYMENT_METHODS,
  PAYROLL_RUN_STATUSES,
  PAYROLL_SKIP_REASONS,
  PAYROLL_WARNING_CODES,
  payConfirmation,
  paymentDateBounds,
  paymentMethodLabel,
  paymentMethodOptions,
  payRequest,
  payslipStatusText,
  runActions,
  runMonthLabel,
  runMonthOptions,
  runStatusLabel,
  runStatusVariant,
  skippedAction,
  skipReasonText,
  structureAmounts,
  structureErrorText,
  structureNet,
  structureNetPreview,
  structureToEdit,
  validateStructureAmounts,
} from '../utils/payroll';

type Tree = { [key: string]: string | Tree };

/** The value at a dotted key, or undefined. */
function at(tree: Tree, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Tree)[part] : undefined), tree);
}

const run = (overrides: Partial<PayrollRunDetail> = {}): PayrollRunDetail => ({
  id: 'run1',
  month: 6,
  year: 2026,
  status: 'PROCESSED',
  lineCount: 3,
  paidLineCount: 0,
  heldLineCount: 0,
  payableLineCount: 3,
  totalNet: 75000,
  paidNet: 0,
  heldNet: 0,
  payableNet: 75000,
  createdAt: '2026-07-01T05:00:00Z',
  updatedAt: '2026-07-01T05:00:00Z',
  lines: [],
  skipped: [],
  paymentDateMin: '2026-06-01',
  paymentDateMax: '2026-10-11',
  ...overrides,
});

const skipped = (overrides: Partial<PayrollSkippedEmployee> = {}): PayrollSkippedEmployee => ({
  employeeId: 'e1',
  employeeName: 'Asha Verma',
  designation: 'Teacher',
  reason: 'NO_STRUCTURE',
  date: null,
  net: null,
  structureId: null,
  ...overrides,
});

const structure = (overrides: Partial<SalaryStructure> = {}): SalaryStructure => ({
  id: 's1',
  employeeId: 'e1',
  employeeName: 'Asha Verma',
  basic: 25000,
  allowances: 2500,
  deductions: 1000,
  effectiveFrom: '2026-04-01',
  net: 26500,
  current: true,
  editable: true,
  createdAt: '2026-04-01T05:00:00Z',
  ...overrides,
});

describe('payment methods', () => {
  it('matches the backend PaymentMethod enum, with no card', () => {
    expect(PAYROLL_PAYMENT_METHODS).toEqual(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']);
    expect(PAYROLL_PAYMENT_METHODS).not.toContain('CARD');
    expect(paymentMethodOptions(tEn).map((o) => o.value)).toEqual(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']);
  });

  it("uses the fee screens' labels", () => {
    expect(paymentMethodOptions(tEn).map((o) => o.label)).toEqual(['Cash', 'UPI', 'Bank transfer', 'Cheque']);
    expect(paymentMethodLabel('BANK_TRANSFER', tHi)).toBe(hi.fees.paymentMethods.bankTransfer);
    expect(paymentMethodLabel('NEFT', tEn)).toBe('NEFT');
    expect(paymentMethodLabel(null, tEn)).toBe('');
  });
});

describe('money', () => {
  it('adds up structures in paise, without float error', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(structureNet(0.1, 0.2, 0)).toBe(0.3);
    expect(structureNet(10.1, 0.2, 0.3)).toBe(10);
    expect(structureNet(25000, 2500.5, 1000.25)).toBe(26500.25);
    expect(structureNet(25000, null, undefined)).toBe(25000);
    expect(structureNet(1000, 0, 1000)).toBe(0);
  });

  it('formats rupees with Indian grouping and 2 decimals', () => {
    expect(formatInr(412500)).toBe('₹4,12,500.00');
    expect(formatInr(0)).toBe('₹0.00');
    expect(formatInr(999.5)).toBe('₹999.50');
    expect(formatInr(1000)).toBe('₹1,000.00');
    expect(formatInr(100000)).toBe('₹1,00,000.00');
    expect(formatInr(10000000.05)).toBe('₹1,00,00,000.05');
    expect(formatInr(-500)).toBe('-₹500.00');
    expect(formatAmount(26500.25)).toBe('26,500.25');
    expect(formatInr(0.1 + 0.2)).toBe('₹0.30');
  });
});

describe('salary structure amounts', () => {
  const input = (basic: string, allowances = '', deductions = '') => ({ basic, allowances, deductions });
  const keys = (i: ReturnType<typeof input>) => validateStructureAmounts(i).map((e) => `${e.field}:${e.key.split('.').pop()}`);

  it('accepts a good structure, with blank parts as 0 and commas ignored', () => {
    expect(keys(input('25000', '2500', '1000'))).toEqual([]);
    expect(keys(input('25000'))).toEqual([]);
    expect(keys(input('25,000.50', ' 2,500 ', ''))).toEqual([]);
    expect(structureAmounts(input('25,000.50', '2500', ''))).toEqual({ basic: 25000.5, allowances: 2500, deductions: 0 });
  });

  it('refuses negatives', () => {
    expect(keys(input('-25000'))).toEqual(['basic:basic']);
    expect(keys(input('25000', '-1'))).toEqual(['allowances:allowances']);
    expect(keys(input('25000', '', '-0.5'))).toEqual(['deductions:deductions']);
    expect(structureAmounts(input('25000', '-1'))).toBeNull();
  });

  it('refuses a basic of 0, blank or not a number', () => {
    expect(keys(input(''))).toEqual(['basic:basic']);
    expect(keys(input('0'))).toEqual(['basic:basic']);
    expect(keys(input('abc'))).toEqual(['basic:notANumber']);
    expect(keys(input('25000', '1.2.3'))).toEqual(['allowances:notANumber']);
    expect(keys(input('.'))).toEqual(['basic:notANumber']);
  });

  it('refuses more than ₹10,00,000 a month', () => {
    expect(keys(input('1000000'))).toEqual([]);
    expect(keys(input('1000000.01'))).toEqual(['basic:tooLarge']);
    expect(keys(input('25000', '1000001'))).toEqual(['allowances:tooLarge']);
    expect(keys(input('25000', '', '99999999999'))).toEqual(['deductions:tooLarge']);
  });

  it('refuses more than 2 decimal places, but not trailing zeros', () => {
    expect(keys(input('25000.123'))).toEqual(['basic:decimals']);
    expect(keys(input('25000', '0.005'))).toEqual(['allowances:decimals']);
    expect(keys(input('25000.500'))).toEqual([]);
    expect(parseAmount('25000.500')).toEqual({ ok: true, paise: 2500050 });
  });

  it('refuses net pay of 0 or less', () => {
    expect(keys(input('1000', '0', '1000'))).toEqual(['net:netNotPositive']);
    expect(keys(input('1000', '500', '25000'))).toEqual(['net:netNotPositive']);
    expect(keys(input('0.1', '0.2', '0.3'))).toEqual(['net:netNotPositive']);
    expect(keys(input('0.1', '0.2', '0.29'))).toEqual([]);
    expect(structureAmounts(input('1000', '', '1000'))).toBeNull();
  });

  it('previews net pay once the parts are numbers, even when it is 0 or less', () => {
    expect(structureNetPreview(input('25000', '2500', '1000'))).toBe(26500);
    expect(structureNetPreview(input('1000', '', '2500'))).toBe(-1500);
    expect(structureNetPreview(input('1000', '-500'))).toBe(500);
    expect(structureNetPreview(input(''))).toBeNull();
    expect(structureNetPreview(input('1000', 'x'))).toBeNull();
  });

  it('has words for every error, with the field named', () => {
    const [error] = validateStructureAmounts(input('25000.123'));
    expect(structureErrorText(error, tEn)).toBe('Basic can have at most 2 decimal places.');
    for (const e of [
      ...validateStructureAmounts(input('-1', '1.2.3', '2000000')),
      ...validateStructureAmounts(input('1', '', '5')),
    ]) {
      expect(at(en as Tree, e.key)).toEqual(expect.any(String));
      expect(at(hi as Tree, e.key)).toEqual(expect.any(String));
    }
  });

  it('fills the edit form from a saved structure', () => {
    expect(amountInputText(25000)).toBe('25000');
    expect(amountInputText(2500.5)).toBe('2500.5');
    expect(amountInputText(null)).toBe('');
  });

  it('opens the structure to fix only while it is editable', () => {
    const list = [structure(), structure({ id: 's2', editable: false })];
    expect(structureToEdit(list, 's1')?.id).toBe('s1');
    expect(structureToEdit(list, 's2')).toBeNull();
    expect(structureToEdit(list, 'gone')).toBeNull();
    expect(structureToEdit(list, null)).toBeNull();
  });
});

describe('words for statuses, reasons and warnings', () => {
  it('has every key in en and hi', () => {
    const keys = [
      ...PAYROLL_RUN_STATUSES.map((s) => `payroll.runStatus.${s}`),
      ...PAYROLL_LINE_STATUSES.map((s) => `payroll.lineStatus.${s}`),
      ...PAYROLL_SKIP_REASONS.map((r) => `payroll.run.skipReason.${r}`),
      ...PAYROLL_WARNING_CODES.map((c) => `payroll.run.warning.${c}`),
      'notifications.channels.payroll.name',
      'notifications.channels.payroll.description',
    ];
    expect(keys.filter((k) => typeof at(en as Tree, k) !== 'string')).toEqual([]);
    expect(keys.filter((k) => typeof at(hi as Tree, k) !== 'string')).toEqual([]);
  });

  it('names run statuses in plain words', () => {
    expect(PAYROLL_RUN_STATUSES.map((s) => runStatusLabel(s, tEn))).toEqual([
      'Draft',
      'Ready to pay',
      'Partly paid',
      'Paid',
      'Cancelled',
    ]);
    expect(runStatusLabel('PARTIALLY_PAID', tHi)).toBe(hi.payroll.runStatus.PARTIALLY_PAID);
    expect(runStatusLabel('ARCHIVED', tEn)).toBe('ARCHIVED');
    expect(runStatusVariant('PAID')).toBe('success');
    expect(runStatusVariant('PARTIALLY_PAID')).toBe('warning');
    expect(runStatusVariant('CANCELLED')).toBe('error');
  });

  it('says "Not paid yet", and tells only an admin a line is on hold', () => {
    expect(lineStatusLabel('PAID', tEn)).toBe('Paid');
    expect(lineStatusLabel('PENDING', tEn)).toBe('Not paid yet');
    expect(lineStatusLabel('ON_HOLD', tEn)).toBe('On hold');
    expect(lineStatusLabel('ON_HOLD', tEn, false)).toBe('Not paid yet');
    expect(lineStatusVariant('PAID')).toBe('success');
    expect(lineStatusVariant('PENDING')).toBe('warning');
    expect(lineStatusVariant('ON_HOLD', false)).toBe('warning');
  });

  it('writes payslip status in plain words, never the raw enum', () => {
    expect(payslipStatusText({ status: 'PAID', paidOn: '2026-07-01' }, false, tEn)).toBe('Paid on 1 July 2026');
    expect(payslipStatusText({ status: 'PENDING', paidOn: null }, false, tEn)).toBe('Not paid yet');
    expect(payslipStatusText({ status: 'ON_HOLD', paidOn: null }, false, tEn)).toBe('Not paid yet');
    expect(payslipStatusText({ status: 'ON_HOLD', paidOn: null }, true, tEn)).toBe('On hold');
  });

  it('says why someone was left out', () => {
    expect(skipReasonText(skipped(), tEn)).toBe('No salary structure');
    expect(skipReasonText(skipped({ reason: 'STRUCTURE_STARTS_AFTER_MONTH', date: '2026-08-01' }), tEn)).toBe(
      'Their salary structure starts on 1 August 2026, after this month'
    );
    expect(skipReasonText(skipped({ reason: 'NET_NOT_POSITIVE', net: -22500 }), tEn)).toBe(
      'Net pay is -₹22,500.00: deductions are more than basic + allowances'
    );
    expect(skipReasonText(skipped({ reason: 'NOT_IN_RUN' }), tEn)).toBe('Not in this run');
  });

  it('words line warnings with their date', () => {
    expect(lineWarningText({ code: 'STRUCTURE_CHANGED_MID_MONTH', date: '2026-07-15' }, tEn)).toBe(
      'Salary changed on 15 July 2026. The new amount is paid for the whole month.'
    );
    expect(lineWarningText({ code: 'NEGATIVE_COMPONENT', date: null }, tEn)).toContain('negative');
    expect(lineWarningText({ code: 'JOINED_MID_MONTH', date: '2026-07-10' }, tHi)).toContain('10 जुलाई 2026');
  });

  it('names months and dates', () => {
    expect(runMonthLabel(6, 2026, tEn)).toBe('June 2026');
    expect(formatPayrollDate('2026-10-01', tEn)).toBe('1 October 2026');
    expect(formatPayrollDate('not a date', tEn)).toBe('not a date');
  });
});

describe('runActions', () => {
  const statuses: PayrollRunStatus[] = ['DRAFT', 'PROCESSED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'];
  const shown = (r: PayrollRunDetail) =>
    Object.entries(runActions(r))
      .filter(([, on]) => on)
      .map(([name]) => name)
      .sort();

  it('offers each status exactly what the server allows', () => {
    const table = Object.fromEntries(
      statuses.map((status) => {
        const paid = status === 'PARTIALLY_PAID' || status === 'PAID' ? 2 : 0;
        const payable = status === 'PROCESSED' || status === 'PARTIALLY_PAID' ? 1 : 0;
        return [status, shown(run({ status, paidLineCount: paid, payableLineCount: payable }))];
      })
    );
    expect(table).toEqual({
      DRAFT: ['cancel', 'process'],
      PROCESSED: ['cancel', 'hold', 'pay', 'recalculate'],
      PARTIALLY_PAID: ['hold', 'pay', 'recalculate'],
      PAID: [],
      CANCELLED: ['runAgain'],
    });
  });

  it('lets a legacy PAID run with no paid lines be recalculated or cancelled', () => {
    expect(shown(run({ status: 'PAID', lineCount: 0, paidLineCount: 0, payableLineCount: 0 }))).toEqual([
      'cancel',
      'recalculate',
    ]);
  });

  it("doesn't offer pay when every line is paid or on hold", () => {
    expect(runActions(run({ status: 'PROCESSED', heldLineCount: 3, payableLineCount: 0 })).pay).toBe(false);
    expect(runActions(run({ status: 'PROCESSED', lineCount: 0, payableLineCount: 0 })).pay).toBe(false);
    expect(runActions(run({ status: 'PARTIALLY_PAID', paidLineCount: 1, payableLineCount: 0 })).hold).toBe(true);
  });

  it('only lets a future-month run be cancelled', () => {
    const future = { paymentDateMin: '2026-11-01', paymentDateMax: '2026-10-11' };
    expect(shown(run({ ...future, status: 'DRAFT', payableLineCount: 0 }))).toEqual(['cancel', 'futureMonth']);
    expect(shown(run({ ...future, status: 'PROCESSED' }))).toEqual(['cancel', 'futureMonth', 'hold']);
    expect(shown(run({ ...future, status: 'CANCELLED', payableLineCount: 0 }))).toEqual(['futureMonth']);
  });

  it('points each left-out employee at the fix', () => {
    const open = runActions(run({ status: 'PROCESSED' }));
    const paid = runActions(run({ status: 'PAID', paidLineCount: 3, payableLineCount: 0 }));
    expect(skippedAction(skipped(), open)).toBe('ADD_STRUCTURE');
    expect(skippedAction(skipped({ reason: 'NET_NOT_POSITIVE' }), open)).toBe('FIX_STRUCTURE');
    expect(skippedAction(skipped({ reason: 'STRUCTURE_STARTS_AFTER_MONTH' }), open)).toBe('FIX_STRUCTURE');
    expect(skippedAction(skipped({ reason: 'NOT_IN_RUN' }), open)).toBe('RECALCULATE');
    // A fully paid run can't be recalculated, so it just says they're not in it.
    expect(skippedAction(skipped({ reason: 'NOT_IN_RUN' }), paid)).toBeNull();
  });
});

describe('paying a run', () => {
  it('defaults the payment date to today, kept within the run month and today', () => {
    const bounds = paymentDateBounds(run(), '2026-10-11');
    expect(bounds).toEqual({ min: '2026-06-01', max: '2026-10-11', valid: true, defaultDate: '2026-10-11' });
    // The phone's date can run ahead of India's (a wrong clock or time zone): never past the server's today.
    expect(paymentDateBounds(run(), '2026-10-12').defaultDate).toBe('2026-10-11');
    expect(paymentDateBounds(run({ paymentDateMin: '2026-10-01' }), '2026-09-30').defaultDate).toBe('2026-10-01');
    expect(paymentDateBounds(run({ paymentDateMin: '2026-11-01' }), '2026-10-11').valid).toBe(false);
  });

  it('sends what the confirmation showed', () => {
    const shown = run({ payableLineCount: 23, payableNet: 412500 });
    expect(payRequest(shown, 'BANK_TRANSFER', '  UTR123  ', '2026-10-01')).toEqual({
      paymentMethod: 'BANK_TRANSFER',
      paymentReference: 'UTR123',
      transactionDate: '2026-10-01',
      expectedPayableLineCount: 23,
      expectedPayableNet: 412500,
    });
    expect(payRequest(shown, 'CASH', '   ', '2026-10-01').paymentReference).toBeNull();
  });

  it('confirms the total, the count, the method, the date and who is on hold', () => {
    const confirm = payConfirmation(
      run({ payableLineCount: 23, payableNet: 412500, heldLineCount: 2 }),
      'BANK_TRANSFER',
      '2026-10-01',
      tEn
    );
    expect(confirm.title).toBe('Record salary as paid?');
    expect(confirm.body).toBe(
      "Record ₹4,12,500.00 salary for 23 staff as paid by Bank transfer on 1 October 2026? 2 staff on hold won't be paid now. This can't be undone in the app."
    );
    const noneHeld = payConfirmation(run(), 'CASH', '2026-10-01', tEn).body;
    expect(noneHeld).not.toContain('on hold');
    expect(payConfirmation(run(), 'UPI', '2026-10-01', tHi).body).toContain('₹75,000.00');
  });
});

describe('runMonthOptions', () => {
  it('offers this year and the two before, with no future month', () => {
    const options = runMonthOptions('2026-10-11');
    expect(options.map((o) => o.year)).toEqual([2026, 2025, 2024]);
    expect(options[0].months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(options[1].months).toHaveLength(12);
    expect(options[2].months).toHaveLength(12);
  });

  it('offers only January on the 1st of January', () => {
    expect(runMonthOptions('2027-01-01')[0]).toEqual({ year: 2027, months: [1] });
  });
});

describe('conflictData', () => {
  it("reads the refusal's data for its own errorCode only", () => {
    const error = Object.assign(new Error('exists'), { status: 409, errorCode: 'PAYROLL_RUN_EXISTS', data: { runId: 'r1' } });
    expect(conflictData(error, 'PAYROLL_RUN_EXISTS')).toEqual({ runId: 'r1' });
    expect(conflictData(error, 'PAYROLL_RUN_CHANGED')).toBeNull();
    expect(conflictData(Object.assign(new Error('x'), { errorCode: 'PAYROLL_LINE_PAID' }), 'PAYROLL_LINE_PAID')).toEqual({});
    expect(conflictData(new Error('offline'), 'PAYROLL_RUN_EXISTS')).toBeNull();
    expect(conflictData(undefined, 'PAYROLL_RUN_EXISTS')).toBeNull();
  });
});
