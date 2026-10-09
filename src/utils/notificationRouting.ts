/**
 * Where tapping a notification should take the user, from the push's data payload - shared by the
 * push tap handler (usePushNotifications) and the in-app Alerts inbox, which stores the same payload.
 * Pure (no navigation, no API calls) so it can be unit-tested; screens that need a child's name
 * resolve `studentId` against the parent's own children list before navigating.
 */
export type NotificationTarget =
  | { screen: 'ConversationsList' }
  | { screen: 'Announcements' }
  | { screen: 'MyBus' | 'TransportHub' }
  | { screen: 'AttendanceHistory' | 'ChildFees'; studentId: string };

export function notificationTarget(
  data: Record<string, unknown> | null | undefined,
  role: string
): NotificationTarget | null {
  if (!data || typeof data.type !== 'string') return null;
  const studentId = typeof data.studentId === 'string' ? data.studentId : null;
  switch (data.type) {
    case 'NEW_MESSAGE':
      return { screen: 'ConversationsList' };
    case 'ANNOUNCEMENT':
      // Only the parent app has an announcements screen; staff/students just open the app.
      return role === 'PARENT' ? { screen: 'Announcements' } : null;
    case 'ABSENCE_ALERT':
      return role === 'PARENT' && studentId ? { screen: 'AttendanceHistory', studentId } : null;
    case 'FEE_DUE':
      // Online payment is on hold, so a fee reminder opens the child's fee summary.
      return role === 'PARENT' && studentId ? { screen: 'ChildFees', studentId } : null;
    case 'BUS_TRIP':
      // Boarding/return updates go to the child's login and parents; unusual ones also to admins.
      if (role === 'STUDENT' || role === 'PARENT') return { screen: 'MyBus' };
      return role === 'ADMIN' ? { screen: 'TransportHub' } : null;
    default:
      return null;
  }
}
