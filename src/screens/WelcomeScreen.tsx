import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';

interface Props {
  onFindSchool: () => void;
  onRegisterSchool: () => void;
}

export default function WelcomeScreen({ onFindSchool, onRegisterSchool }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>G</Text>
        </View>
        <Text style={styles.title}>Gurukul</Text>
        <Text style={styles.subtitle}>School management, made simple</Text>
      </LinearGradient>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onFindSchool}>
          <Text style={styles.primaryButtonText}>Find my school</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onRegisterSchool}>
          <Text style={styles.secondaryButtonText}>Register a new school</Text>
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
  title: { color: colors.white, fontSize: 26, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  actions: { padding: spacing.lg, paddingTop: spacing.xl, gap: spacing.md },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  primaryButtonText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  secondaryButton: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
});
