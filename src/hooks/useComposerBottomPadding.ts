import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/colors';

/**
 * Bottom padding for a chat input bar (messages, helpdesk bot, AI helper). With the keyboard
 * closed the bar sits well clear of the gesture bar / home indicator, so Send is comfortable to
 * reach; with it open the keyboard already covers the safe area, so only a small gap is kept.
 */
export function useComposerBottomPadding() {
  const insets = useSafeAreaInsets();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    // iOS reports "will" events, which keep the bar in step with the keyboard animation.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardOpen ? spacing.md : insets.bottom + spacing.xl;
}
