import { notificationTarget } from '../utils/notificationRouting';

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

  it('returns null for unknown or missing payloads', () => {
    expect(notificationTarget(undefined, 'PARENT')).toBeNull();
    expect(notificationTarget({ type: 'SOMETHING_NEW' }, 'PARENT')).toBeNull();
  });
});
