import { useNavigation } from '@react-navigation/native';
import { useEffect, useRef } from 'react';

import { createReturnTracker } from '../utils/focusReturn';

/**
 * Calls `onReturn` each time the user comes back to this screen from another one (not when it
 * first opens). The listeners are added once per screen, and the latest `onReturn` is read through
 * a ref, so a callback that changes on every pick never makes a return go unnoticed.
 */
export function useOnReturn(onReturn: () => void) {
  const navigation = useNavigation();
  const onReturnRef = useRef(onReturn);

  useEffect(() => {
    onReturnRef.current = onReturn;
  }, [onReturn]);

  useEffect(() => {
    const tracker = createReturnTracker();
    const offBlur = navigation.addListener('blur', () => tracker.left());
    const offFocus = navigation.addListener('focus', () => {
      if (tracker.focused()) onReturnRef.current();
    });
    return () => {
      offBlur();
      offFocus();
    };
  }, [navigation]);
}
