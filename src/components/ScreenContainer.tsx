import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { useBottomInset } from '../hooks/useBottomInset';
import { colors, spacing } from '../theme/colors';

interface ScreenContainerProps extends ScrollViewProps {
  children: ReactNode;
  padded?: boolean;
  /** Pad the end of the content past the system bottom bar. Set false when a footer below handles it. */
  bottomInset?: boolean;
}

export function ScreenContainer({
  children,
  padded = true,
  bottomInset = true,
  contentContainerStyle,
  ...props
}: ScreenContainerProps) {
  const bottomPadding = useBottomInset(padded ? spacing.lg : 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        padded && styles.padded,
        bottomInset && { paddingBottom: bottomPadding },
        contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

export function ScreenBody({ children }: { children: ReactNode }) {
  return <View style={styles.body}>{children}</View>;
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  padded: {
    padding: spacing.lg,
  },
  body: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
