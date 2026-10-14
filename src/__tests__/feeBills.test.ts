import type { FeeAssessmentSummary, FeeBillStatus, GeneratePreview } from '../api/types';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import {
  academicYearOptions,
  adjustmentByLine,
  adjustmentConfirmText,
  adjustmentDraft,
  adjustmentLabelKey,
  assessmentsEmptyText,
  billDetailActions,
  billDueNote,
  canCancelBill,
  canonicalAcademicYear,
  categoryPickerEmptyKey,
  clampIsoDate,
  dueDateChangeBounds,
  FEE_ADJUSTMENT_TYPES,
  FEE_BILL_STATUSES,
  feeAssessmentQuery,
  feeLinesError,
  feeLinesRequest,
  feeLinesTotal,
  feeStatusLabel,
  feeStatusLabelKey,
  feeStatusVariant,
  formatAdjustmentLine,
  formatDueDate,
  overdueReminderScope,
  formatInstantDate,
  formatSignedRupees,
  generateConfirmation,
  generateDueDateBounds,
  generateResultText,
  isBillCancelled,
  maskAccountNumber,
  normaliseCategoryCode,
  paymentSettingsConfirmText,
  pickableCategories,
  sectionsForYear,
  shiftIsoDate,
  signedAdjustmentAmount,
  structureTotal,
  structureUpdateMessage,
  studentLeftTagKey,
  todayIst,
} from '../utils/feeBills';

describe('money', () => {
  it('shows an adjustment with its sign either way, on the shared rupee format', () => {
    expect(formatSignedRupees(-2000)).toBe('-₹2,000');
    expect(formatSignedRupees(500)).toBe('+₹500');
    expect(formatSignedRupees(1234567.5)).toBe('+₹12,34,567.50');
    expect(formatSignedRupees(0)).toBe('₹0');
  });
});

describe('status', () => {
  it('gives every fee screen the same chip colour per status', () => {
    expect(feeStatusVariant('OVERDUE')).toBe('error');
    expect(feeStatusVariant('PARTIAL')).toBe('warning');
    expect(feeStatusVariant('UNPAID')).toBe('neutral');
    expect(feeStatusVariant('PAID')).toBe('success');
    expect(feeStatusVariant('CANCELLED')).toBe('neutral');
    expect(feeStatusVariant('SOMETHING_NEW')).toBe('neutral');
  });

  it('has words for every status and the All filter, in English and Hindi', () => {
    for (const status of [...FEE_BILL_STATUSES, 'ALL']) {
      const key = feeStatusLabelKey(status);
      expect(key).toBe(`fees.status.${status}`);
      expect(feeStatusLabel(status, tEn)).not.toBe(key);
      expect(feeStatusLabel(status, tHi)).toBe(hi.fees.status[status as keyof typeof hi.fees.status]);
    }
    expect(feeStatusLabel('CANCELLED', tEn)).toBe('Cancelled');
    expect(feeStatusLabel('OVERDUE', tEn)).toBe('Overdue');
  });

  it('shows a status a newer server adds as sent', () => {
    expect(feeStatusLabelKey('REFUNDED')).toBeNull();
    expect(feeStatusLabel('REFUNDED', tEn)).toBe('REFUNDED');
  });

  it('cancels only a bill nothing has been paid on, and never twice', () => {
    expect(isBillCancelled({ status: 'CANCELLED' })).toBe(true);
    expect(isBillCancelled({ status: 'UNPAID', cancelled: true })).toBe(true);
    expect(isBillCancelled({ status: 'UNPAID', cancelled: false })).toBe(false);
    expect(canCancelBill({ status: 'UNPAID', totalPaid: 0 })).toBe(true);
    expect(canCancelBill({ status: 'OVERDUE', totalPaid: 0 })).toBe(true);
    expect(canCancelBill({ status: 'PARTIAL', totalPaid: 0.01 })).toBe(false);
    expect(canCancelBill({ status: 'CANCELLED', totalPaid: 0 })).toBe(false);
  });
});

describe('bill detail actions', () => {
  const admin = { role: 'ADMIN', ownerType: 'EMPLOYEE' };
  const teacher = { role: 'TEACHER', ownerType: 'EMPLOYEE' };
  const student = { role: 'STUDENT', ownerType: 'STUDENT' };
  const parent = { role: 'PARENT', ownerType: 'PARENT' };
  const bill = (
    status: FeeBillStatus,
    totalPaid: number,
    remainingDue: number,
    cancelled = status === 'CANCELLED',
    studentStatus = 'ACTIVE'
  ) => ({
    status,
    totalPaid,
    remainingDue,
    cancelled,
    studentStatus,
  });

  it('gives an admin Record payment, the bill corrections and the payments on an open bill', () => {
    expect(billDetailActions(bill('PARTIAL', 5000, 13000), admin)).toEqual({
      recordPayment: true,
      adminActions: true,
      sendReminder: true,
      cancelBill: false,
      cancelBlockedByPayments: true,
      howToPay: false,
      nothingOwed: false,
      paymentHistory: true,
    });
  });

  it('lets an admin cancel once every payment is reversed (totalPaid back to 0)', () => {
    // A reversal takes the payment off totalPaid, so the same bill after reversing its only payment:
    const reversed = billDetailActions(bill('UNPAID', 0, 18000), admin);
    expect(reversed.cancelBill).toBe(true);
    expect(reversed.cancelBlockedByPayments).toBe(false);
    expect(reversed.recordPayment).toBe(true);
    expect(reversed.paymentHistory).toBe(true);
  });

  it('offers no Record payment and no corrections on a cancelled bill, but still shows its payments', () => {
    expect(billDetailActions(bill('CANCELLED', 0, 0), admin)).toEqual({
      recordPayment: false,
      adminActions: false,
      sendReminder: false,
      cancelBill: false,
      cancelBlockedByPayments: false,
      howToPay: false,
      nothingOwed: false,
      paymentHistory: true,
    });
    // Even if a stale copy still says money is owed, the cancelled flag wins.
    expect(billDetailActions(bill('UNPAID', 0, 18000, true), admin).recordPayment).toBe(false);
  });

  it('offers Send fee reminder only while money is owed by a student still at the school', () => {
    expect(billDetailActions(bill('OVERDUE', 0, 18000), admin).sendReminder).toBe(true);
    expect(billDetailActions(bill('UNPAID', 0, 18000), admin).sendReminder).toBe(true);
    expect(billDetailActions(bill('PAID', 18000, 0), admin).sendReminder).toBe(false);
    expect(billDetailActions(bill('CANCELLED', 0, 0), admin).sendReminder).toBe(false);
    expect(billDetailActions(bill('OVERDUE', 0, 18000, false, 'WITHDRAWN'), admin).sendReminder).toBe(false);
    expect(billDetailActions(bill('OVERDUE', 0, 18000, false, 'ALUMNI'), admin).sendReminder).toBe(false);
  });

  it('keeps the corrections but not Record payment on a fully paid bill (a late fee can still be added)', () => {
    const paid = billDetailActions(bill('PAID', 18000, 0), admin);
    expect(paid.recordPayment).toBe(false);
    expect(paid.adminActions).toBe(true);
    expect(paid.cancelBill).toBe(false);
  });

  it('tells a family how to pay while money is owed, and that nothing is owed once paid', () => {
    for (const viewer of [student, parent]) {
      expect(billDetailActions(bill('OVERDUE', 0, 18000), viewer)).toEqual({
        recordPayment: false,
        adminActions: false,
        sendReminder: false,
        cancelBill: false,
        cancelBlockedByPayments: false,
        howToPay: true,
        nothingOwed: false,
        paymentHistory: true,
      });
      const paid = billDetailActions(bill('PAID', 18000, 0), viewer);
      expect(paid.howToPay).toBe(false);
      expect(paid.nothingOwed).toBe(true);
      const cancelled = billDetailActions(bill('CANCELLED', 0, 0), viewer);
      expect(cancelled.howToPay).toBe(false);
      expect(cancelled.nothingOwed).toBe(false);
    }
  });

  it("shows a teacher the bill only: no payments (the API refuses them), no actions", () => {
    expect(billDetailActions(bill('OVERDUE', 0, 18000), teacher)).toEqual({
      recordPayment: false,
      adminActions: false,
      sendReminder: false,
      cancelBill: false,
      cancelBlockedByPayments: false,
      howToPay: false,
      nothingOwed: false,
      paymentHistory: false,
    });
  });
});

describe('dates', () => {
  it("uses India's date, so 23:00 UTC is already the next day", () => {
    expect(todayIst(new Date('2026-10-10T23:00:00Z'))).toBe('2026-10-11');
    expect(todayIst(new Date('2026-10-10T18:29:00Z'))).toBe('2026-10-10');
    expect(todayIst(new Date('2026-10-10T18:30:00Z'))).toBe('2026-10-11');
  });

  it('moves dates by years (29 Feb lands on 28 Feb) and days', () => {
    expect(shiftIsoDate('2028-02-29', { years: 2 })).toBe('2030-02-28');
    expect(shiftIsoDate('2028-02-29', { years: -2 })).toBe('2026-02-28');
    expect(shiftIsoDate('2026-10-11', { days: 30 })).toBe('2026-11-10');
    expect(shiftIsoDate('2026-12-31', { days: 1 })).toBe('2027-01-01');
  });

  it('allows a due date change within two years either side, and Generate from today', () => {
    expect(dueDateChangeBounds('2026-10-11')).toEqual({ min: '2024-10-11', max: '2028-10-11' });
    expect(generateDueDateBounds('2026-10-11')).toEqual({ min: '2026-10-11', max: '2028-10-11' });
    const bounds = generateDueDateBounds('2026-10-11');
    expect(clampIsoDate('2026-11-10', bounds)).toBe('2026-11-10');
    expect(clampIsoDate('2026-10-01', bounds)).toBe('2026-10-11');
    expect(clampIsoDate('2030-01-01', bounds)).toBe('2028-10-11');
  });

  it('formats a due date with the month in the app language', () => {
    expect(formatDueDate('2026-11-05', tEn)).toBe('5 Nov 2026');
    expect(formatDueDate('2026-01-31', tEn)).toBe('31 Jan 2026');
    expect(formatDueDate('2026-11-05', tHi)).toBe(`5 ${hi.fees.bill.monthsShort['11']} 2026`);
    expect(formatDueDate('not a date', tEn)).toBe('not a date');
    expect(formatDueDate('2026-13-01', tEn)).toBe('2026-13-01');
  });

  it("formats an instant as its date in India, in the app language, and '—' when there is none", () => {
    expect(formatInstantDate('2026-10-11T20:00:00Z', tEn)).toBe('12 Oct 2026');
    expect(formatInstantDate('2026-10-11T18:29:00Z', tEn)).toBe('11 Oct 2026');
    expect(formatInstantDate('2026-10-11T20:00:00Z', tHi)).toBe(`12 ${hi.fees.bill.monthsShort['10']} 2026`);
    expect(formatInstantDate(null, tEn)).toBe('—');
    expect(formatInstantDate(undefined, tEn)).toBe('—');
    expect(formatInstantDate('not a time', tEn)).toBe('not a time');
  });
});

describe('billDueNote', () => {
  const bill = { status: 'UNPAID' as const, dueDate: '2026-11-05', daysOverdue: 0, remainingDue: 5000, cancelled: false };

  it('says how long an overdue bill has been overdue', () => {
    expect(billDueNote({ ...bill, status: 'OVERDUE', daysOverdue: 1 }, tEn)).toEqual({ text: 'Overdue by 1 day', tone: 'error' });
    expect(billDueNote({ ...bill, status: 'OVERDUE', daysOverdue: 11 }, tEn)).toEqual({ text: 'Overdue by 11 days', tone: 'error' });
    expect(billDueNote({ ...bill, status: 'OVERDUE', daysOverdue: 11 }, tHi)?.text).toBe(
      fill(hi.fees.bill.overdueBy_other, { count: 11 })
    );
    // Without a day count it still says overdue.
    expect(billDueNote({ ...bill, status: 'OVERDUE', daysOverdue: 0 }, tEn)?.text).toBe('Overdue');
  });

  it('gives the formatted due date while money is owed, nothing once paid', () => {
    expect(billDueNote(bill, tEn)).toEqual({ text: 'Due 5 Nov 2026', tone: 'muted' });
    expect(billDueNote({ ...bill, status: 'PARTIAL' }, tEn)?.text).toBe('Due 5 Nov 2026');
    expect(billDueNote({ ...bill, status: 'PAID', remainingDue: 0 }, tEn)).toBeNull();
    expect(billDueNote({ ...bill, dueDate: null }, tEn)).toBeNull();
  });

  it('says Cancelled for a cancelled bill', () => {
    expect(billDueNote({ ...bill, status: 'CANCELLED', remainingDue: 0, cancelled: true }, tEn)).toEqual({
      text: 'Cancelled',
      tone: 'muted',
    });
  });
});

describe('adjustments', () => {
  it('signs the typed amount by type', () => {
    expect(signedAdjustmentAmount('CONCESSION', 2000)).toBe(-2000);
    expect(signedAdjustmentAmount('WAIVER', 500.5)).toBe(-500.5);
    expect(signedAdjustmentAmount('LATE_FEE', 100)).toBe(100);
    expect(signedAdjustmentAmount('LATE_FEE', -100)).toBe(100);
    expect(signedAdjustmentAmount('CORRECTION', 300, 1)).toBe(300);
    expect(signedAdjustmentAmount('CORRECTION', 300, -1)).toBe(-300);
    expect(signedAdjustmentAmount('CORRECTION', 300)).toBe(-300);
  });

  it('writes an adjustment as "Concession: -₹2,000 (Sibling)"', () => {
    expect(formatAdjustmentLine({ type: 'CONCESSION', amount: -2000, reason: 'Sibling' }, tEn)).toBe(
      'Concession: -₹2,000 (Sibling)'
    );
    expect(formatAdjustmentLine({ type: 'LATE_FEE', amount: 500, reason: 'Paid in December' }, tEn)).toBe(
      'Late fee: +₹500 (Paid in December)'
    );
    expect(formatAdjustmentLine({ type: 'WAIVER', amount: -1500.5, reason: 'Hardship' }, tHi)).toBe(
      fill(hi.fees.adjustment.line, { type: hi.fees.adjustment.types.WAIVER, amount: '-₹1,500.50', reason: 'Hardship' })
    );
    expect(formatAdjustmentLine({ type: 'NEW_KIND' as never, amount: 10, reason: 'x' }, tEn)).toBe('NEW_KIND: +₹10 (x)');
  });

  it('has a label for every type', () => {
    for (const type of FEE_ADJUSTMENT_TYPES) expect(adjustmentLabelKey(type)).toBe(`fees.adjustment.types.${type}`);
    expect(adjustmentLabelKey('OTHER')).toBeNull();
  });

  it("says who added it (an admin's view) and the day in India", () => {
    expect(adjustmentByLine({ createdByName: 'Priya Singh', createdAt: '2026-10-11T05:30:00Z' }, tEn)).toBe(
      'Priya Singh · 11 Oct 2026'
    );
    // A family isn't sent the name; 20:00 UTC is the next day in India.
    expect(adjustmentByLine({ createdByName: null, createdAt: '2026-10-11T20:00:00Z' }, tEn)).toBe('12 Oct 2026');
  });

  it('checks a typed adjustment the way the server will', () => {
    const bill = { totalDue: 20000, totalPaid: 5000 };
    expect(adjustmentDraft(bill, 'CONCESSION', '2,000', -1)).toEqual({ amount: -2000, newTotal: 18000, error: null });
    // Down to exactly what's paid is fine; below it isn't.
    expect(adjustmentDraft(bill, 'WAIVER', '15000', -1)).toEqual({ amount: -15000, newTotal: 5000, error: null });
    expect(adjustmentDraft(bill, 'CONCESSION', '15000.01', -1)).toEqual({ amount: -15000.01, newTotal: 4999.99, error: 'belowPaid' });
    expect(adjustmentDraft(bill, 'CORRECTION', '100', 1)).toEqual({ amount: 100, newTotal: 20100, error: null });
    for (const bad of ['', '0', '0.00', '1.234', '-5', 'abc']) {
      expect(adjustmentDraft(bill, 'LATE_FEE', bad, 1)).toEqual({ amount: null, newTotal: null, error: 'amount' });
    }
  });

  it('asks before saving, saying the family sees it and it stays', () => {
    expect(adjustmentConfirmText('Asha Verma', 'LATE_FEE', 5000, 25000, tEn)).toBe(
      "Late fee of +₹5,000 on Asha Verma's bill. The new total will be ₹25,000.\n\n" +
        "The family will see this and its reason on the bill. It can't be deleted later, only reversed with a correction."
    );
    expect(adjustmentConfirmText('Asha Verma', 'CONCESSION', -2000, 18000, tEn)).toMatch(
      /^Concession of -₹2,000 on Asha Verma's bill\. The new total will be ₹18,000\./
    );
    expect(adjustmentConfirmText('Asha Verma', 'WAIVER', -1500.5, 3500, tHi)).toBe(
      fill(hi.fees.adjustment.confirmMessage, {
        type: hi.fees.adjustment.types.WAIVER,
        amount: '-₹1,500.50',
        name: 'Asha Verma',
        total: '3,500',
      })
    );
  });

  it('lets a late fee go on a paid bill', () => {
    expect(adjustmentDraft({ totalDue: 20000, totalPaid: 20000 }, 'LATE_FEE', '500', 1)).toEqual({
      amount: 500,
      newTotal: 20500,
      error: null,
    });
  });
});

describe('academic years and the bill list', () => {
  it('writes every spelling of a year the one way the server stores fee rows', () => {
    for (const text of ['2026-27', '2026-2027', ' 2026-2027 ', '2026/27', '2026–27', '2026/2027']) {
      expect(canonicalAcademicYear(text)).toBe('2026-27');
    }
    // Like the server: spaces around the separator, and an em dash.
    for (const text of ['2026 - 27', '2026 – 2027', '2026—27', '2026 / 27', '2026 —2027']) {
      expect(canonicalAcademicYear(text)).toBe('2026-27');
    }
    expect(canonicalAcademicYear('2099-2100')).toBe('2099-00');
    expect(canonicalAcademicYear('2099-00')).toBe('2099-00');
  });

  it('leaves anything that is not a year and the next as typed (trimmed)', () => {
    expect(canonicalAcademicYear('2026')).toBe('2026');
    expect(canonicalAcademicYear(' 2026-2028 ')).toBe('2026-2028');
    expect(canonicalAcademicYear('2026-29')).toBe('2026-29');
    expect(canonicalAcademicYear('abc')).toBe('abc');
    expect(canonicalAcademicYear(null)).toBe('');
  });

  it("offers the summary's year and every year with bills, newest first", () => {
    const summary = { academicYear: '2026-27', availableAcademicYears: ['2025-26', '2024-25'] } as FeeAssessmentSummary;
    expect(academicYearOptions(summary)).toEqual(['2026-27', '2025-26', '2024-25']);
    expect(academicYearOptions({ ...summary, availableAcademicYears: ['2026-27', '2025-26'] })).toEqual(['2026-27', '2025-26']);
    expect(academicYearOptions({ ...summary, academicYear: 'ALL' })).toEqual(['2025-26', '2024-25']);
    expect(academicYearOptions(null)).toEqual([]);
  });

  it("lists a year's sections however their year is written", () => {
    const sections = [
      { id: 'a', academicYear: '2026-2027' },
      { id: 'b', academicYear: '2026-27' },
      { id: 'c', academicYear: '2025-2026' },
      { id: 'd', academicYear: '2026 - 27' },
    ];
    expect(sectionsForYear(sections, '2026-27').map((s) => s.id)).toEqual(['a', 'b', 'd']);
    expect(sectionsForYear(sections, 'ALL')).toHaveLength(4);
    expect(sectionsForYear(sections, null)).toHaveLength(4);
  });

  it('builds the list query, leaving out filters at their default', () => {
    expect(feeAssessmentQuery({}, 0, 50)).toBe('page=0&size=50');
    expect(feeAssessmentQuery({})).toBe('');
    const query = new URLSearchParams(
      feeAssessmentQuery(
        { status: 'OVERDUE', classSectionId: 'sec1', academicYear: 'ALL', q: '  asha  ', includeInactive: true },
        2,
        50
      )
    );
    expect(Object.fromEntries(query.entries())).toEqual({
      status: 'OVERDUE',
      classSectionId: 'sec1',
      academicYear: 'ALL',
      q: 'asha',
      includeInactive: 'true',
      page: '2',
      size: '50',
    });
    expect(new URLSearchParams(feeAssessmentQuery({ q: 'x'.repeat(150) })).get('q')).toHaveLength(100);
    expect(feeAssessmentQuery({ q: '   ', includeInactive: false })).toBe('');
  });

  it("says why the bill list is empty without claiming there are no bills when other years have some", () => {
    const base = { loadFailed: false, filtered: false, shownYear: '2026-27', availableYears: ['2025-26'] };
    // Only last year's bills (arrears): name the year shown, and point at All years.
    expect(assessmentsEmptyText(base, tEn)).toBe(
      'No bills to show for 2026-27. Choose "All years" to see bills from other years, such as last year\'s unpaid dues.'
    );
    expect(assessmentsEmptyText(base, tHi)).toBe(fill(hi.fees.assessmentsList.noBillsForYear, { year: '2026-27' }));
    // No bill in any year: generate some first, whatever the filters.
    expect(assessmentsEmptyText({ ...base, availableYears: [] }, tEn)).toBe(
      '0 assessments yet — generate them from a fee structure first.'
    );
    expect(assessmentsEmptyText({ ...base, availableYears: [], filtered: true }, tEn)).toBe(
      '0 assessments yet — generate them from a fee structure first.'
    );
    // A status, search or class filter, every year, or no summary to name a year: no match.
    expect(assessmentsEmptyText({ ...base, filtered: true }, tEn)).toBe('No bills match these filters.');
    expect(assessmentsEmptyText({ ...base, shownYear: 'ALL' }, tEn)).toBe('No bills match these filters.');
    expect(assessmentsEmptyText({ ...base, shownYear: null, availableYears: null }, tEn)).toBe('No bills match these filters.');
    // A year the admin chose, while the summary is unavailable.
    expect(assessmentsEmptyText({ ...base, shownYear: '2025-26', availableYears: null }, tEn)).toMatch(/^No bills to show for 2025-26\./);
    // A failed load says so first.
    expect(assessmentsEmptyText({ ...base, loadFailed: true, availableYears: [] }, tEn)).toBe('Could not load assessments.');
  });

  it('tags a student who has left', () => {
    expect(studentLeftTagKey('ACTIVE')).toBeNull();
    expect(studentLeftTagKey(undefined)).toBeNull();
    expect(studentLeftTagKey('WITHDRAWN')).toBe('fees.assessmentsList.withdrawnTag');
    expect(studentLeftTagKey('ALUMNI')).toBe('fees.assessmentsList.alumniTag');
    expect(studentLeftTagKey('INACTIVE')).toBe('fees.assessmentsList.withdrawnTag');
  });
});

describe('categories', () => {
  it('shows the code the server will store, or null for one it would refuse', () => {
    expect(normaliseCategoryCode(' tuition fee ')).toBe('TUITION_FEE');
    expect(normaliseCategoryCode('Tuition_Fee')).toBe('TUITION_FEE');
    expect(normaliseCategoryCode(' lab ')).toBe('LAB');
    expect(normaliseCategoryCode('bus - fee')).toBe('BUS_FEE');
    expect(normaliseCategoryCode('T')).toBeNull();
    expect(normaliseCategoryCode('fee@1')).toBeNull();
    expect(normaliseCategoryCode('A'.repeat(31))).toBeNull();
    expect(normaliseCategoryCode('A'.repeat(30))).toBe('A'.repeat(30));
  });

  it("offers categories in use, plus the line's own even if retired", () => {
    const categories = [
      { id: 'a', active: true },
      { id: 'b', active: false },
      { id: 'c', active: false },
    ];
    expect(pickableCategories(categories, null).map((c) => c.id)).toEqual(['a']);
    expect(pickableCategories(categories, 'b').map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('tells "no categories yet" apart from "all of them not in use"', () => {
    expect(categoryPickerEmptyKey(0, 0)).toBe('fees.categoryPicker.empty');
    expect(categoryPickerEmptyKey(3, 0)).toBe('fees.categoryPicker.allNotInUse');
    expect(categoryPickerEmptyKey(3, 1)).toBeNull();
    expect(tEn('fees.categoryPicker.allNotInUse')).toMatch(/not in use/);
  });
});

describe('structure lines', () => {
  const line = (feeCategoryId: string, amount: string) => ({ feeCategoryId, amount });

  it('accepts 0 and refuses what the server would', () => {
    expect(feeLinesError([line('a', '15000'), line('b', '0')])).toBeNull();
    expect(feeLinesError([])).toBe('noLines');
    expect(feeLinesError([line('', '100')])).toBe('missingCategory');
    expect(feeLinesError([line('a', '')])).toBe('invalidAmount');
    expect(feeLinesError([line('a', '1.234')])).toBe('invalidAmount');
    expect(feeLinesError([line('a', '-1')])).toBe('invalidAmount');
    expect(feeLinesError([line('a', '100'), line('a', '200')])).toBe('duplicateCategory');
    expect(feeLinesError(Array.from({ length: 51 }, (_, i) => line(`c${i}`, '1')))).toBe('tooManyLines');
  });

  it("reads amounts with the shared parser: grouped or with a rupee sign, never over 2 decimals", () => {
    expect(feeLinesError([line('a', '15,000'), line('b', ' ₹ 1,200 '), line('c', '2500.50')])).toBeNull();
    for (const bad of ['100.555', '1e5', '0x10', 'abc', '.5']) {
      expect(feeLinesError([line('a', bad)])).toBe('invalidAmount');
    }
    expect(feeLinesRequest([line('a', '1,50,000.5')])).toEqual([{ feeCategoryId: 'a', amount: 150000.5 }]);
  });

  it('sends the parsed amounts and adds them up in paise', () => {
    expect(feeLinesRequest([line('a', '15,000'), line('b', '0')])).toEqual([
      { feeCategoryId: 'a', amount: 15000 },
      { feeCategoryId: 'b', amount: 0 },
    ]);
    expect(feeLinesTotal([line('a', '0.1'), line('b', '0.2')])).toBe(0.3);
    expect(feeLinesTotal([line('a', '100'), line('b', 'x')])).toBeNull();
    expect(feeLinesTotal([])).toBe(0);
  });

  it("uses the server's total, or adds the lines for an older server", () => {
    expect(structureTotal({ lines: [{ amount: 1 }] as never, totalPerStudent: 20000 })).toBe(20000);
    expect(structureTotal({ lines: [{ amount: 0.1 }, { amount: 0.2 }] as never })).toBe(0.3);
  });
});

describe('generate', () => {
  const preview: GeneratePreview = {
    structureId: 's1',
    academicYear: '2026-27',
    totalPerStudent: 20000,
    activeStudentCount: 42,
    toCreateCount: 40,
    alreadyBilledCount: 2,
    alreadyBilledDifferentTotal: [],
    inactiveStudentCount: 0,
    structureDueDate: null,
    suggestedDueDate: '2026-11-10',
  };

  it('asks before creating bills, with the count, amount and due date', () => {
    expect(generateConfirmation(preview, '2026-11-10', tEn)).toEqual({
      canGenerate: true,
      lines: ['Create 40 new bills of ₹20,000 each, due 10 Nov 2026?', '2 students already have a bill.'],
    });
    expect(generateConfirmation({ ...preview, toCreateCount: 1, alreadyBilledCount: 0 }, '2026-11-10', tEn).lines).toEqual([
      'Create 1 new bill of ₹20,000, due 10 Nov 2026?',
    ]);
  });

  it('names who already has a bill for a different amount, and who is skipped', () => {
    const different = ['Asha', 'Ravi', 'Meena', 'Kabir', 'Isha', 'Dev', 'Tara'].map((studentName, i) => ({
      assessmentId: `a${i}`,
      studentId: `s${i}`,
      studentName,
      totalDue: 18000,
    }));
    const result = generateConfirmation(
      { ...preview, alreadyBilledCount: 9, alreadyBilledDifferentTotal: different, inactiveStudentCount: 3 },
      '2026-11-10',
      tEn
    );
    expect(result.lines.slice(1)).toEqual([
      '9 students already have a bill (7 for a different amount: Asha, Ravi, Meena, Kabir, Isha and 2 more).',
      "3 withdrawn students won't be billed.",
    ]);
  });

  it('offers no confirm button when there is nobody to bill', () => {
    expect(generateConfirmation({ ...preview, toCreateCount: 0, alreadyBilledCount: 42 }, '2026-11-10', tEn)).toEqual({
      canGenerate: false,
      lines: ["Everyone already has a bill. There's nothing to create.", '42 students already have a bill.'],
    });
    expect(
      generateConfirmation({ ...preview, activeStudentCount: 0, toCreateCount: 0, alreadyBilledCount: 0 }, '2026-11-10', tEn)
    ).toEqual({ canGenerate: false, lines: ['There are no active students in this class yet.'] });
  });

  it('says how many it created', () => {
    expect(generateResultText({ createdCount: 40, alreadyBilledCount: 2 }, tEn)).toBe('Created 40 new bills. 2 already had one.');
    expect(generateResultText({ createdCount: 1, alreadyBilledCount: 0 }, tEn)).toBe('Created 1 new bill. 0 already had one.');
    expect(generateResultText({ createdCount: 3, alreadyBilledCount: 1 }, tHi)).toBe(
      fill(hi.fees.structureDetail.generate.result_other, { count: 3, already: 1 })
    );
  });
});

describe('structureUpdateMessage', () => {
  const leftAlone = (reason: 'HAS_PAYMENTS' | 'HAS_ADJUSTMENTS' | 'NOT_REQUESTED', i: number) => ({
    assessmentId: `a${i}`,
    studentId: `s${i}`,
    studentName: `S${i}`,
    totalDue: 20000,
    reason,
  });

  it('says how many bills were re-priced and why the rest kept their amount', () => {
    expect(
      structureUpdateMessage(
        { repricedCount: 38, leftAloneCount: 3, leftAlone: [leftAlone('HAS_PAYMENTS', 1), leftAlone('HAS_PAYMENTS', 2), leftAlone('HAS_ADJUSTMENTS', 3)] },
        tEn
      )
    ).toBe('38 bills were updated to the new total.\n3 bills keep their old amount.\n• 2 with payments\n• 1 with adjustments');
    expect(structureUpdateMessage({ repricedCount: 0, leftAloneCount: 1, leftAlone: [leftAlone('NOT_REQUESTED', 1)] }, tEn)).toBe(
      '1 bill keeps its old amount.\n• 1 because you chose not to update bills'
    );
  });

  it('leaves out a breakdown of only part of the bills', () => {
    expect(structureUpdateMessage({ repricedCount: 1, leftAloneCount: 150, leftAlone: [leftAlone('HAS_PAYMENTS', 1)] }, tEn)).toBe(
      '1 bill was updated to the new total.\n150 bills keep their old amount.'
    );
  });

  it('says when nothing needed changing', () => {
    expect(structureUpdateMessage({ repricedCount: 0, leftAloneCount: 0, leftAlone: [] }, tEn)).toBe('No bills needed a change.');
  });
});

describe('payment settings', () => {
  it('shows only the last 4 digits of the account', () => {
    expect(maskAccountNumber('123456789012')).toBe('XXXX9012');
    expect(maskAccountNumber(' 1234 ')).toBe('1234');
  });

  it('asks before saving, naming the account and the UPI ID', () => {
    expect(paymentSettingsConfirmText('123456789012', ' school@oksbi ', tEn)).toBe('Save account XXXX9012 and UPI ID school@oksbi?');
    expect(paymentSettingsConfirmText('123456789012', '', tEn)).toBe(
      "Save account XXXX9012? No UPI ID is set, so families can't pay by UPI in the app."
    );
    expect(paymentSettingsConfirmText('123456789012', 'school@oksbi', tHi)).toBe(
      fill(hi.fees.paymentSettings.confirmWithUpi, { account: 'XXXX9012', upiId: 'school@oksbi' })
    );
  });
});

describe('overdue reminder scope', () => {
  it('names the year, or all years, and the class when one is picked', () => {
    expect(overdueReminderScope('2026-27', null, tEn)).toBe('2026-27');
    expect(overdueReminderScope('ALL', null, tEn)).toBe('all years');
    expect(overdueReminderScope(null, null, tEn)).toBe('all years');
    expect(overdueReminderScope('2026-27', 'Grade 7 - A', tEn)).toBe('Grade 7 - A, 2026-27');
    expect(overdueReminderScope('ALL', 'Grade 7 - A', tHi)).toBe('Grade 7 - A, सभी वर्षों');
  });
});
