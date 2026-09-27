import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { Session } from '../api/authStorage';
import { registerDeviceToken } from '../api/notifications';
import { getStudent } from '../api/students';
import { FEATURE_FLAGS } from '../config/featureFlags';
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
 * Requests permission, registers this device's Expo push token with the backend, keeps that
 * registration fresh if Expo ever rolls the token, and handles tapping a notification - including
 * one that cold-started the app, which never reaches the live tap listener. Expo's own push
 * service is used (not a direct Firebase/APNs integration) - see PushNotificationService on the
 * backend for why: this is an Expo managed-workflow app, so there's no separate push project to
 * set up or pay for.
 *
 * A simulator/emulator has no push capability at all (Device.isDevice is false there), and as of
 * SDK 53, Expo Go itself no longer supports remote push tokens on either platform - only a real
 * development or production build does. getExpoPushTokenAsync throws in both cases, so that
 * specific failure is silently swallowed rather than logging an error every time the app runs
 * somewhere push isn't actually available. A failure to register the token with our own backend
 * (once we do have one) is a real problem though, so that's logged instead.
 */
export function usePushNotifications(schoolId: string | null, session: Session | null) {
  // Keyed on who is signed in, not on the access token - that now rotates on every silent refresh,
  // and re-registering the device each time would be pointless churn.
  const sessionKey = session ? `${session.schoolId}:${session.ownerType}:${session.ownerId}` : null;

  useEffect(() => {
    if (!schoolId || !sessionKey || !Device.isDevice) return;
    let cancelled = false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    const fetchAndRegister = async () => {
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      if (cancelled) return;
      try {
        await registerDeviceToken(schoolId, expoPushToken);
      } catch (e) {
        console.warn('[push] Failed to register device token with the backend', e);
      }
    };

    (async () => {
      try {
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

        await fetchAndRegister();
      } catch {
        // Push isn't available here (Expo Go on SDK 53+, a simulator, or a denied permission) -
        // the app works fine without it, just without a way to reach a backgrounded session.
      }
    })();

    // In rare cases Expo rolls the underlying native token while the app is running, which
    // invalidates the Expo push token built from it - re-derive and re-register rather than using
    // the raw device token this listener provides, which isn't the format our backend expects.
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      fetchAndRegister().catch((e) => console.warn('[push] Failed to refresh device token', e));
    });

    return () => {
      cancelled = true;
      tokenSubscription.remove();
    };
    // sessionKey changes on every login, logout and profile switch (a new owner should re-register
    // the device) - schoolId alone wouldn't catch switching accounts within the same school.
  }, [schoolId, sessionKey]);

  // The listener only needs the signed-in owner, so a token refresh (a new session object, same
  // owner) mustn't tear it down and re-run the cold-start check below.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    if (!sessionKey) return;

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const session = sessionRef.current;
      if (!session) return;
      const data = response.notification.request.content.data as Record<string, unknown> | undefined;
      if (!navigationRef.isReady() || !data?.type) return;

      if (data.type === 'NEW_MESSAGE') {
        navigationRef.navigate('ConversationsList');
      } else if (data.type === 'SCHEDULED_CALL_STARTED' && FEATURE_FLAGS.videoCalls) {
        navigationRef.navigate('ScheduledCalls');
      } else if (data.type === 'REPORT_CARD_PUBLISHED' && session.ownerType === 'STUDENT') {
        // The backend only ever sends this to the student themselves (one push per student in the
        // section, see ReportCardService.notifyStudents), so session.ownerId is exactly the
        // student whose report card to open.
        getStudent(session.schoolId, session.ownerId)
          .then((student) => {
            navigationRef.navigate('ReportCard', {
              student: { id: student.id, name: student.name },
              defaultTerm: typeof data.term === 'string' ? data.term : undefined,
            });
          })
          .catch(() => {});
      }
      // ANNOUNCEMENT: no announcements screen exists yet to land on.
      // INCOMING_CALL: video calls are disabled (src/config/featureFlags.ts) and there's no API to
      // fetch an in-progress call's room details from just a callLogId anyway - a still-ringing
      // call is only ever handled live, by IncomingCallOverlay, while that feature is enabled.
      // Tapping still opens the app either way, just wherever it last was.
    };

    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    // A tap that cold-starts the app never reaches the listener above - check for one already
    // waiting, then clear it so the same tap doesn't re-navigate every time the app is reopened.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleResponse(response);
        Notifications.clearLastNotificationResponseAsync();
      }
    });
    return () => subscription.remove();
  }, [sessionKey]);
}
