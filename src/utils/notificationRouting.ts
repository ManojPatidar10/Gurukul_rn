import { isIsoDate } from './timetable';

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
  | { screen: 'MyFees' }
  | { screen: 'AttendanceHistory' | 'ChildFees'; studentId: string }
  | { screen: 'ReportCard'; studentId: string; term?: string; sectionId?: string }
  | { screen: 'PayslipDetail'; payrollLineId: string }
  | { screen: 'MyTimetable'; date?: string }
  | { screen: 'HelpdeskBot' }
  | { screen: 'AiMisuseLog' };

export function notificationTarget(
  data: Record<string, unknown> | null | undefined,
  role: string
): NotificationTarget | null {
  if (!data || typeof data.type !== 'string') return null;
  const studentId = typeof data.studentId === 'string' ? data.studentId : null;
  const payrollLineId = typeof data.payrollLineId === 'string' && data.payrollLineId ? data.payrollLineId : null;
  switch (data.type) {
    case 'NEW_MESSAGE':
      return { screen: 'ConversationsList' };
    case 'ANNOUNCEMENT':
      // Only the parent app has an announcements screen; staff/students just open the app.
      return role === 'PARENT' ? { screen: 'Announcements' } : null;
    case 'ABSENCE_ALERT':
      return role === 'PARENT' && studentId ? { screen: 'AttendanceHistory', studentId } : null;
    case 'FEE_DUE':
      // Online payment is on hold, so a fee reminder opens the fee summary: the child's for a
      // parent, or the student's own (the reminder goes to a student's login when no parent is linked).
      if (role === 'STUDENT') return { screen: 'MyFees' };
      return role === 'PARENT' && studentId ? { screen: 'ChildFees', studentId } : null;
    case 'REPORT_CARD_PUBLISHED': {
      // A parent's copy names one child (a parent may have several), so it opens that child's card
      // for that term. A student's copy has no studentId and students have no inbox; their push tap
      // is handled in usePushNotifications.
      // The section that published says which class's card it is: after promotion the same term
      // can be published for two of the child's classes.
      if (role !== 'PARENT' || !studentId) return null;
      return {
        screen: 'ReportCard',
        studentId,
        ...(typeof data.term === 'string' ? { term: data.term } : {}),
        ...(typeof data.sectionId === 'string' && data.sectionId ? { sectionId: data.sectionId } : {}),
      };
    }
    case 'BUS_TRIP':
      // Boarding/return updates go to the child's login and parents; unusual ones also to admins.
      if (role === 'STUDENT' || role === 'PARENT') return { screen: 'MyBus' };
      return role === 'ADMIN' ? { screen: 'TransportHub' } : null;
    case 'SALARY_PAID':
      // Goes to the employee whose salary was paid. Only staff on the principal navigator have a
      // payslip screen; a driver's tap just opens the app.
      return (role === 'TEACHER' || role === 'ADMIN') && payrollLineId ? { screen: 'PayslipDetail', payrollLineId } : null;
    case 'TIMETABLE_CHANGE':
      // A substitution, cancellation or extra class: the substitute, the original teacher and the
      // class's students are told. It opens their timetable on that date. Parents aren't pushed;
      // an admin gets it only as one of the teachers.
      if (role !== 'TEACHER' && role !== 'ADMIN' && role !== 'STUDENT') return null;
      return { screen: 'MyTimetable', ...(isIsoDate(data.date) ? { date: data.date } : {}) };
    case 'BOT_ACTION_READY':
      // A timetable proposal the helpdesk bot finished after a long turn, waiting for the admin who
      // asked to confirm it: open their helpdesk chat, where the card is. Only admins get it.
      return role === 'ADMIN' ? { screen: 'HelpdeskBot' } : null;
    case 'AI_MISUSE_PAUSED':
      // Someone's AI help was paused after repeated messages that weren't about school work. Sent
      // to the school's admins only; it opens the AI misuse log. The push names no one (a lock
      // screen isn't private) - the log does.
      return role === 'ADMIN' ? { screen: 'AiMisuseLog' } : null;
    default:
      return null;
  }
}

/** The focused route, as navigationRef.getCurrentRoute() gives it. */
export interface ShownRoute {
  name: string;
  params?: unknown;
}

/**
 * Whether `target` is already the screen on show, so a tap should leave it alone. Today that's the
 * helpdesk chat: HelpdeskBot replaces itself with the bot's ConversationThread, so navigating to it
 * again from that chat (a BOT_ACTION_READY tap, or its banner while the app is open) would stack a
 * second copy of the same chat on top. The open chat already gets the card: live, or from the
 * refetch when the app comes back to the foreground.
 */
export function isTargetShowing(target: NotificationTarget, route: ShownRoute | null | undefined): boolean {
  if (!route || target.screen !== 'HelpdeskBot') return false;
  if (route.name === 'HelpdeskBot') return true;
  const params = route.params as { isBot?: unknown } | null | undefined;
  return route.name === 'ConversationThread' && params?.isBot === true;
}
