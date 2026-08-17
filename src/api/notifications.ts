import { api } from './client';

export function registerDeviceToken(schoolId: string, expoPushToken: string) {
  return api.post<void>('/api/v1/notifications/device-token', { expoPushToken }, schoolId);
}
