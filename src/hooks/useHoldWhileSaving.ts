import { useNavigation, usePreventRemove } from '@react-navigation/native';
import type { RefObject } from 'react';

/**
 * Keeps the user on a form while its request is in flight: the header Back, Android Back and the
 * iOS swipe all stay put and `onHeld` runs instead. The reply (a receipt, a reversal) then always
 * reaches the screen that sent it. Otherwise a payment could be saved with nobody told, and a
 * second try from a new form (with a new idempotency key) would record it twice.
 *
 * `saving` (state) switches the hold on, which also stops the native iOS swipe. `inFlightRef` decides
 * each attempt to leave. Clear the ref just before the form's own navigation after the reply
 * (replace, go back): that navigation is let through, though `saving` hasn't re-rendered to false yet.
 */
export function useHoldWhileSaving(saving: boolean, inFlightRef: RefObject<boolean>, onHeld: () => void) {
  const navigation = useNavigation();
  usePreventRemove(saving, ({ data }) => {
    if (inFlightRef.current) {
      onHeld();
      return;
    }
    // The action is marked as already asked of this screen, so dispatching it again goes through.
    navigation.dispatch(data.action);
  });
}
