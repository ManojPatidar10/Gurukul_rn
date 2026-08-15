import { useCallback } from 'react';
import { Alert } from 'react-native';

import { getGoogleMeetStatus } from '../api/calls';
import { useAuth } from '../context/AuthContext';

interface GoogleMeetGateNavigation {
  navigate: (screen: 'ConnectGoogleAccount') => void;
}

/**
 * Only an EMPLOYEE session can connect a Google account, and it only applies to calls they
 * start - a student caller has no provider choice to make. Jitsi is not offered as a fallback at
 * all: an employee who hasn't connected Google Meet is blocked from starting the call and sent
 * straight to the connect screen instead.
 */
export function useGoogleMeetGate(schoolId: string, navigation: GoogleMeetGateNavigation) {
  const { session } = useAuth();

  return useCallback(
    async (proceed: () => void | Promise<void>, onGateShown?: () => void) => {
      if (session.ownerType !== 'EMPLOYEE') {
        await proceed();
        return;
      }

      let connected = false;
      try {
        connected = (await getGoogleMeetStatus(schoolId)).connected;
      } catch {
        // Don't block the call on a failed status check - the backend will fall back to
        // whatever provider it can regardless.
        await proceed();
        return;
      }

      if (connected) {
        await proceed();
        return;
      }

      onGateShown?.();
      Alert.alert(
        'Connect Google Meet to make calls',
        'You need to connect your Google account before you can start a video call.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect Google account', onPress: () => navigation.navigate('ConnectGoogleAccount') },
        ]
      );
    },
    [schoolId, session.ownerType, navigation]
  );
}
