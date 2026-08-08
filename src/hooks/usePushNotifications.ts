import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { registerDeviceToken } from '../api/notifications';
import { navigationRef } from '../navigation/navigationRef';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Requests permission, registers this device's Expo push token with the backend, and handles
 * tapping a notification. Expo's own push service is used (not a direct Firebase/APNs
 * integration) - see PushNotificationService on the backend for why: this is an Expo
 * managed-workflow app, so there's no separate push project to set up or pay for.
 *
 * A simulator/emulator has no push capability at all (Device.isDevice is false there) -
 * getExpoPushTokenAsync throws in that case, so this silently no-ops rather than logging an error
 * a developer would otherwise see on every single simulator run.
 */
export function usePushNotifications(schoolId: string | null, sessionKey: string | null) {
  useEffect(() => {
    if (!schoolId || !sessionKey || !Device.isDevice) return;
    let cancelled = false;

    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
        });
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let status = existingStatus;
      if (status !== 'granted') {
        ({ status } = await Notifications.requestPermissionsAsync());
      }
      if (status !== 'granted' || cancelled) return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (cancelled) return;
      registerDeviceToken(schoolId, expoPushToken).catch(() => {});
    })();

    return () => {
      cancelled = true;
    };
    // sessionKey changes on every login/logout (a fresh session should re-register under the new
    // owner) - schoolId alone wouldn't catch switching accounts within the same school.
  }, [schoolId, sessionKey]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (!navigationRef.isReady() || !data?.type) return;
      if (data.type === 'NEW_MESSAGE') {
        navigationRef.navigate('ConversationsList');
      } else if (data.type === 'SCHEDULED_CALL_STARTED') {
        navigationRef.navigate('ScheduledCalls');
      }
      // INCOMING_CALL and ANNOUNCEMENT: no dedicated deep link (a still-ringing call is handled
      // live by IncomingCallOverlay once the app is foregrounded; there's no announcements
      // screen to land on yet). Tapping still opens the app, just to wherever it last was.
    });
    return () => subscription.remove();
  }, []);
}
