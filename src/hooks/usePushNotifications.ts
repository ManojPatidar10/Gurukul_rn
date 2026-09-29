import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import type { Session } from '../api/authStorage';
import { registerDeviceToken } from '../api/notifications';
import { getMyChildren } from '../api/parents';
import { getStudent } from '../api/students';
import { FEATURE_FLAGS } from '../config/featureFlags';
import i18n from '../i18n';
import { navigationRef } from '../navigation/navigationRef';
import { notificationTarget } from '../utils/notificationRouting';
import { openNotificationTarget } from '../utils/openNotificationTarget';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Brand violet (marketing-sales-pipeline/brand/tokens.json violet-600), also the notification accent in app.json. */
const BRAND_VIOLET = '#7C3AED';

/**
 * One Android channel per kind of notification, so a user can mute announcements without missing
 * calls. The ids must match the backend's PushChannel enum; `default` catches anything sent
 * without one. Android fixes a channel's importance the first time it's created on a phone and
 * ignores later changes, so an importance change here needs a new channel id. The name and
 * description can change (they follow the app language).
 */
const CHANNELS = [
  { id: 'default', key: 'general', importance: Notifications.AndroidImportance.DEFAULT },
  { id: 'messages', key: 'messages', importance: Notifications.AndroidImportance.HIGH },
  { id: 'announcements', key: 'announcements', importance: Notifications.AndroidImportance.HIGH },
  { id: 'calls', key: 'calls', importance: Notifications.AndroidImportance.MAX },
  { id: 'academics', key: 'academics', importance: Notifications.AndroidImportance.HIGH },
  { id: 'alerts', key: 'alerts', importance: Notifications.AndroidImportance.HIGH },
] as const;

async function setUpAndroidChannels() {
  if (Platform.OS !== 'android' || !i18n.isInitialized) return;
  await Promise.all(
    CHANNELS.map(({ id, key, importance }) =>
      Notifications.setNotificationChannelAsync(id, {
        name: i18n.t(`notifications.channels.${key}.name`),
        description: i18n.t(`notifications.channels.${key}.description`),
        importance,
        lightColor: BRAND_VIOLET,
        vibrationPattern: [0, 250, 250, 250],
        showBadge: true,
      })
    )
  );
}

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

  // Channel names are shown in Android's settings, so re-apply them once i18n is ready and
  // whenever the user switches language.
  useEffect(() => {
    const apply = () => {
      setUpAndroidChannels().catch(() => {});
    };
    apply();
    i18n.on('initialized', apply);
    i18n.on('languageChanged', apply);
    return () => {
      i18n.off('initialized', apply);
      i18n.off('languageChanged', apply);
    };
  }, []);

  useEffect(() => {
    if (!schoolId || !sessionKey || !Device.isDevice) return;
    let cancelled = false;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;

    // The last Expo token we tried to register, and whether a failure has already been logged, for
    // this signed-in owner - so a repeat of the same token is a no-op and a failing backend is
    // reported once rather than on every retry.
    let lastToken: string | null = null;
    let warned = false;

    // Pass the device token when we already have one (from the token listener): without it,
    // getExpoPushTokenAsync asks the OS for the device token again, and on iOS that re-fires the
    // token listener below - an endless register loop that starves the JS thread.
    const fetchAndRegister = async (devicePushToken?: Notifications.DevicePushToken) => {
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({
        ...(projectId ? { projectId } : {}),
        ...(devicePushToken ? { devicePushToken } : {}),
      });
      if (cancelled || expoPushToken === lastToken) return;
      lastToken = expoPushToken;
      try {
        await registerDeviceToken(schoolId, expoPushToken);
      } catch (e) {
        if (!warned) {
          warned = true;
          console.warn('[push] Failed to register device token with the backend', e);
        }
      }
    };

    (async () => {
      try {
        // Android 13+ only shows the permission prompt once the app has a channel.
        await setUpAndroidChannels();

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
    // invalidates the Expo push token built from it - re-derive the Expo token from the raw device
    // token this listener provides (which isn't the format our backend expects) and re-register.
    // iOS also fires this on every getDevicePushTokenAsync, hence the same-token check above.
    const tokenSubscription = Notifications.addPushTokenListener((devicePushToken) => {
      fetchAndRegister(devicePushToken).catch((e) => console.warn('[push] Failed to refresh device token', e));
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

      const defaultTerm = typeof data.term === 'string' ? data.term : undefined;
      const scheduledCallTypes = ['SCHEDULED_CALL_STARTED', 'SCHEDULED_CALL_REMINDER', 'SCHEDULED_CALL_CANCELLED'];

      if (data.type === 'NEW_MESSAGE') {
        navigationRef.navigate('ConversationsList');
      } else if (scheduledCallTypes.includes(data.type as string) && FEATURE_FLAGS.videoCalls) {
        navigationRef.navigate('ScheduledCalls');
      } else if (data.type === 'CALL_MISSED' && FEATURE_FLAGS.videoCalls) {
        navigationRef.navigate('CallHistory');
      } else if (data.type === 'REPORT_CARD_PUBLISHED' && session.ownerType === 'STUDENT') {
        // A student's copy has no studentId: it only ever goes to the student themselves (see
        // ReportCardService.notifyStudentsAndParents), so session.ownerId is the report card to open.
        getStudent(session.schoolId, session.ownerId)
          .then((student) => {
            navigationRef.navigate('ReportCard', { student: { id: student.id, name: student.name }, defaultTerm });
          })
          .catch(() => {});
      } else if (data.type === 'REPORT_CARD_PUBLISHED' && session.ownerType === 'PARENT' && typeof data.studentId === 'string') {
        // A parent's copy names one child (a parent may have several), so open that child's card.
        const studentId = data.studentId;
        getMyChildren(session.schoolId)
          .then((children) => {
            const child = children.find((c) => c.id === studentId);
            if (child) {
              navigationRef.navigate('ReportCard', { student: { id: child.id, name: child.name }, defaultTerm });
            }
          })
          .catch(() => {});
      } else {
        // ABSENCE_ALERT / FEE_DUE open that child's attendance / fees; ANNOUNCEMENT opens the
        // parent's Announcements screen (staff and students have none, so it just opens the app).
        const target = notificationTarget(data, session.role);
        if (target) {
          openNotificationTarget(session.schoolId, target, navigationRef.navigate).catch(() => {});
        }
      }
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
