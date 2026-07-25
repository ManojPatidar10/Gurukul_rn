import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';

import { colors, spacing } from '../theme/colors';

interface ScreenContainerProps extends ScrollViewProps {
  children: ReactNode;
  padded?: boolean;
}

export function ScreenContainer({ children, padded = true, ...props }: ScreenContainerProps) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, padded && styles.padded]}
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
