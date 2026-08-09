import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';

interface Props {
  message: string;
  onDone: () => void;
}

export default function RegistrationSubmittedScreen({ message, onDone }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>✓</Text>
        </View>
        <Text style={styles.title}>Registration submitted</Text>
      </LinearGradient>

      <View style={styles.body}>
        <Text style={styles.message}>{message}</Text>
        <Text style={styles.hint}>
          You&apos;ll be able to sign in once a school admin reviews and approves your registration.
        </Text>
        <Pressable style={styles.submit} onPress={onDone}>
          <Text style={styles.submitText}>Back to sign in</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xxl,
    alignItems: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    ...shadow,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  badgeText: { color: colors.white, fontSize: 28, fontWeight: '800' },
  title: { color: colors.white, fontSize: 22, fontWeight: '800' },
  body: { padding: spacing.lg, paddingTop: spacing.xl, alignItems: 'center' },
  message: { fontSize: 15, color: colors.textPrimary, textAlign: 'center', fontWeight: '600' },
  hint: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: spacing.md, lineHeight: 19 },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    marginTop: spacing.xl,
    ...softShadow,
  },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
