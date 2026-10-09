import { getMyChildren } from '../api/parents';
import type { PrincipalStackParamList } from '../types/principal';
import type { NotificationTarget } from './notificationRouting';

type Navigate = <K extends keyof PrincipalStackParamList>(
  ...args: undefined extends PrincipalStackParamList[K]
    ? [screen: K, params?: PrincipalStackParamList[K]]
    : [screen: K, params: PrincipalStackParamList[K]]
) => void;

/**
 * Navigates to a notification's target. A child alert names the child by id only, so it's matched
 * against the parent's own children first - a push for a child no longer linked opens nothing.
 */
export async function openNotificationTarget(schoolId: string, target: NotificationTarget, navigate: Navigate) {
  if (!('studentId' in target)) {
    navigate(target.screen);
    return;
  }
  const child = (await getMyChildren(schoolId)).find((c) => c.id === target.studentId);
  if (child) {
    navigate(target.screen, { student: { id: child.id, name: child.name } });
  }
}
