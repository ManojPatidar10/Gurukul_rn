import { api } from './client';
import type { AppNotification, NotificationPage } from './types';

export function registerDeviceToken(schoolId: string, expoPushToken: string) {
  return api.post<void>('/api/v1/notifications/device-token', { expoPushToken }, schoolId);
}

/** The caller's own inbox, newest first. */
export function listNotifications(schoolId: string, page = 0, size = 30) {
  return api.get<NotificationPage>(`/api/v1/notifications?page=${page}&size=${size}`, schoolId);
}

export function getUnreadNotificationCount(schoolId: string) {
  return api.get<{ unread: number }>('/api/v1/notifications/unread-count', schoolId);
}

export function markNotificationRead(schoolId: string, notificationId: string) {
  return api.post<AppNotification>(`/api/v1/notifications/${notificationId}/read`, {}, schoolId);
}

export function markAllNotificationsRead(schoolId: string) {
  return api.post<{ unread: number }>('/api/v1/notifications/read-all', {}, schoolId);
}
