import { getMyChildren } from '../api/parents';
import { notificationTarget } from '../utils/notificationRouting';
import { openNotificationTarget } from '../utils/openNotificationTarget';

jest.mock('../api/parents', () => ({ getMyChildren: jest.fn() }));

describe('notificationTarget', () => {
  it('opens the child attendance history for a parent absence alert', () => {
    expect(notificationTarget({ type: 'ABSENCE_ALERT', studentId: 's1', date: '2026-09-29' }, 'PARENT')).toEqual({
      screen: 'AttendanceHistory',
      studentId: 's1',
    });
  });

  it('opens the child fee screen for a parent fee-due alert', () => {
    expect(notificationTarget({ type: 'FEE_DUE', studentId: 's1', assessmentId: 'a1' }, 'PARENT')).toEqual({
      screen: 'ChildFees',
      studentId: 's1',
    });
  });

  it('ignores child alerts without a studentId or for non-parents', () => {
    expect(notificationTarget({ type: 'FEE_DUE' }, 'PARENT')).toBeNull();
    expect(notificationTarget({ type: 'ABSENCE_ALERT', studentId: 's1' }, 'TEACHER')).toBeNull();
  });

  it('opens announcements for parents only, messages for everyone', () => {
    expect(notificationTarget({ type: 'ANNOUNCEMENT' }, 'PARENT')).toEqual({ screen: 'Announcements' });
    expect(notificationTarget({ type: 'ANNOUNCEMENT' }, 'STUDENT')).toBeNull();
    expect(notificationTarget({ type: 'NEW_MESSAGE', conversationId: 'c1' }, 'PARENT')).toEqual({
      screen: 'ConversationsList',
    });
  });

  it('opens the bus map for families and the transport screen for admins', () => {
    const bus = { type: 'BUS_TRIP', event: 'BOARDED', tripId: 't1', studentId: 's1' };
    expect(notificationTarget(bus, 'PARENT')).toEqual({ screen: 'MyBus' });
    expect(notificationTarget(bus, 'STUDENT')).toEqual({ screen: 'MyBus' });
    expect(notificationTarget({ ...bus, event: 'AUTO_ENDED' }, 'ADMIN')).toEqual({ screen: 'TransportHub' });
    expect(notificationTarget(bus, 'TEACHER')).toBeNull();
  });

  it('returns null for unknown or missing payloads', () => {
    expect(notificationTarget(undefined, 'PARENT')).toBeNull();
    expect(notificationTarget({ type: 'SOMETHING_NEW' }, 'PARENT')).toBeNull();
  });

  it("opens the named child's report card for that term and class for a parent", () => {
    const published = { type: 'REPORT_CARD_PUBLISHED', sectionId: 'sec1', term: 'Term 1', studentId: 's1' };
    expect(notificationTarget(published, 'PARENT')).toEqual({
      screen: 'ReportCard',
      studentId: 's1',
      term: 'Term 1',
      sectionId: 'sec1',
    });
    // An alert without a section still opens the term; the server then picks the class.
    expect(notificationTarget({ ...published, sectionId: undefined }, 'PARENT')).toEqual({
      screen: 'ReportCard',
      studentId: 's1',
      term: 'Term 1',
    });
  });

  it('ignores a report-card alert without a studentId, or for a student', () => {
    expect(notificationTarget({ type: 'REPORT_CARD_PUBLISHED', sectionId: 'sec1', term: 'Term 1' }, 'PARENT')).toBeNull();
    // A student's copy has no studentId; even with one, students have no inbox route here.
    expect(notificationTarget({ type: 'REPORT_CARD_PUBLISHED', sectionId: 'sec1', term: 'Term 1' }, 'STUDENT')).toBeNull();
    expect(
      notificationTarget({ type: 'REPORT_CARD_PUBLISHED', term: 'Term 1', studentId: 's1' }, 'STUDENT')
    ).toBeNull();
  });

  it('drops a report-card term that is not a string', () => {
    expect(notificationTarget({ type: 'REPORT_CARD_PUBLISHED', term: 2, studentId: 's1' }, 'PARENT')).toEqual({
      screen: 'ReportCard',
      studentId: 's1',
    });
    expect(notificationTarget({ type: 'REPORT_CARD_PUBLISHED', studentId: 's1' }, 'PARENT')).toEqual({
      screen: 'ReportCard',
      studentId: 's1',
    });
  });
});

describe('openNotificationTarget', () => {
  const mockedGetMyChildren = getMyChildren as jest.MockedFunction<typeof getMyChildren>;
  const children = [{ id: 's1', name: 'Asha', classSectionId: 'sec1' }, { id: 's2', name: 'Ravi', classSectionId: 'sec2' }];

  beforeEach(() => {
    mockedGetMyChildren.mockReset();
    mockedGetMyChildren.mockResolvedValue(children as unknown as Awaited<ReturnType<typeof getMyChildren>>);
  });

  it("opens a linked child's report card at the alert's term", async () => {
    const navigate = jest.fn();
    await openNotificationTarget('school1', { screen: 'ReportCard', studentId: 's2', term: 'Term 1' }, navigate);
    expect(mockedGetMyChildren).toHaveBeenCalledWith('school1');
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('ReportCard', { student: { id: 's2', name: 'Ravi' }, defaultTerm: 'Term 1' });
  });

  it("passes on the alert's section, so the card from that class opens after a promotion", async () => {
    const navigate = jest.fn();
    await openNotificationTarget(
      'school1',
      { screen: 'ReportCard', studentId: 's2', term: 'Term 1', sectionId: 'sec-6a' },
      navigate
    );
    expect(navigate).toHaveBeenCalledWith('ReportCard', {
      student: { id: 's2', name: 'Ravi' },
      defaultTerm: 'Term 1',
      defaultSectionId: 'sec-6a',
    });
  });

  it('opens nothing for a child who is no longer linked', async () => {
    const navigate = jest.fn();
    await openNotificationTarget('school1', { screen: 'ReportCard', studentId: 'gone', term: 'Term 1' }, navigate);
    await openNotificationTarget('school1', { screen: 'ChildFees', studentId: 'gone' }, navigate);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still opens fees and attendance with just the child', async () => {
    const navigate = jest.fn();
    await openNotificationTarget('school1', { screen: 'ChildFees', studentId: 's1' }, navigate);
    await openNotificationTarget('school1', { screen: 'AttendanceHistory', studentId: 's1' }, navigate);
    expect(navigate).toHaveBeenNthCalledWith(1, 'ChildFees', { student: { id: 's1', name: 'Asha' } });
    expect(navigate).toHaveBeenNthCalledWith(2, 'AttendanceHistory', { student: { id: 's1', name: 'Asha' } });
  });

  it('opens screens without a child straight away, without looking up children', async () => {
    const navigate = jest.fn();
    await openNotificationTarget('school1', { screen: 'Announcements' }, navigate);
    expect(navigate).toHaveBeenCalledWith('Announcements');
    expect(mockedGetMyChildren).not.toHaveBeenCalled();
  });
});
