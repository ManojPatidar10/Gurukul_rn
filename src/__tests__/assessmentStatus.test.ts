import { toIsoDate } from '../components/DatePickerField';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import { assessmentStatus, localToday } from '../utils/assessmentStatus';

const TODAY = '2026-10-10';

describe('assessmentStatus', () => {
  it('shows a future assessment as upcoming and today as today, for everyone', () => {
    expect(assessmentStatus('2026-10-11', TODAY, { entered: 0, expected: 30 }, true, tEn)).toEqual({ label: 'Upcoming', variant: 'info' });
    expect(assessmentStatus('2026-10-10', TODAY, { entered: 0, expected: 30 }, true, tEn)).toEqual({ label: 'Today', variant: 'info' });
    expect(assessmentStatus('2026-10-11', TODAY, {}, false, tEn)).toEqual({ label: 'Upcoming', variant: 'info' });
    expect(assessmentStatus('2026-10-10', TODAY, {}, false, tEn)).toEqual({ label: 'Today', variant: 'info' });
  });

  it('shows staff how far marks entry has got once the date has passed', () => {
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 0, expected: 30 }, true, tEn)).toEqual({
      label: 'Marks pending',
      variant: 'warning',
    });
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 12, expected: 30 }, true, tEn)).toEqual({
      label: 'Marks 12/30',
      variant: 'warning',
    });
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 30, expected: 30 }, true, tEn)).toEqual({
      label: 'Marks entered',
      variant: 'success',
    });
    // A student who left after their mark was saved can't push it past "entered".
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 31, expected: 30 }, true, tEn)).toEqual({
      label: 'Marks entered',
      variant: 'success',
    });
  });

  it('says completed for a section with no students', () => {
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 0, expected: 0 }, true, tEn)).toEqual({ label: 'Completed', variant: 'success' });
  });

  it('says completed when an older server sends no counts', () => {
    expect(assessmentStatus('2026-10-01', TODAY, {}, true, tEn)).toEqual({ label: 'Completed', variant: 'success' });
    expect(assessmentStatus('2026-10-01', TODAY, { entered: null, expected: null }, true, tEn)).toEqual({
      label: 'Completed',
      variant: 'success',
    });
  });

  it('shows marks progress in Hindi with both numbers', () => {
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 12, expected: 30 }, true, tHi)).toEqual({
      label: fill(hi.assessments.status.marksProgress, { entered: 12, expected: 30 }),
      variant: 'warning',
    });
    expect(assessmentStatus('2026-10-11', TODAY, {}, false, tHi)).toEqual({
      label: hi.assessments.status.upcoming,
      variant: 'info',
    });
  });

  it('never shows marks progress to a student or parent', () => {
    expect(assessmentStatus('2026-10-01', TODAY, { entered: 3, expected: 30 }, false, tEn)).toEqual({ label: 'Completed', variant: 'success' });
  });

  it('uses the local date, so just after midnight is already today (audit L1)', () => {
    // 00:30 on 10 Oct on a phone in India. jest.globalSetup.js runs every test in Asia/Kolkata, so
    // this fails on any machine if localToday goes back to the UTC date.
    const justAfterMidnight = new Date(2026, 9, 10, 0, 30);
    // The bug: toISOString() is the UTC date, still 9 Oct, so today's assessment showed as "Upcoming".
    expect(justAfterMidnight.toISOString().slice(0, 10)).toBe('2026-10-09');
    const today = localToday(justAfterMidnight);
    expect(today).toBe('2026-10-10');
    expect(toIsoDate(justAfterMidnight)).toBe(today);
    expect(assessmentStatus('2026-10-10', today, {}, false, tEn)).toEqual({ label: 'Today', variant: 'info' });
    expect(assessmentStatus('2026-10-09', today, {}, false, tEn)).toEqual({ label: 'Completed', variant: 'success' });
  });

  it('stays on the local date for the whole time the UTC date lags behind, until 05:30', () => {
    const lastLaggingMinute = new Date(2026, 9, 10, 5, 29);
    expect(lastLaggingMinute.toISOString().slice(0, 10)).toBe('2026-10-09');
    expect(localToday(lastLaggingMinute)).toBe('2026-10-10');
    expect(localToday(new Date(2026, 9, 10, 5, 30))).toBe('2026-10-10');
    expect(localToday(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09');
  });
});
