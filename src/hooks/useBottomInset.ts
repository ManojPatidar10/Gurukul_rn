import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme/colors';

/**
 * Bottom spacing that clears the home indicator (iOS) / gesture or nav bar (Android), plus
 * `extra` breathing room. Use it for scroll content padding, footers and floating buttons so
 * nothing sits under the system bar on phones with a tall bottom inset.
 */
export function useBottomInset(extra: number = spacing.lg) {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}
