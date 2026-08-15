import { useCallback } from 'react';
import { Alert } from 'react-native';

import { getGoogleMeetStatus } from '../api/calls';
import { useAuth } from '../context/AuthContext';

interface GoogleMeetGateNavigation {
  navigate: (screen: 'ConnectGoogleAccount') => void;
}

/**
 * Only an EMPLOYEE session can connect a Google account, and it only applies to calls they
 * start - a student caller has no provider choice to make. Before actually starting a call, this
 * checks whether the caller has connected Google Meet; if not, it asks rather than silently
 * falling back to Jitsi, since that fallback alone was confusing ("why is this still Jitsi?").
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
        'Use Google Meet?',
        'Connect your Google account to host this call on Google Meet, or continue with the default video call.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Continue with Jitsi', onPress: () => proceed() },
          { text: 'Connect Google account', onPress: () => navigation.navigate('ConnectGoogleAccount') },
        ]
      );
    },
    [schoolId, session.ownerType, navigation]
  );
}
