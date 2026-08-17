import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';

interface Props {
  onFindSchool: () => void;
  onRegisterSchool: () => void;
}

export default function WelcomeScreen({ onFindSchool, onRegisterSchool }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.sm }]}>
          <LanguageSwitch />
        </View>
        <Logo width={200} onDarkBackground />
        <Text style={styles.subtitle}>{t('welcome.subtitle')}</Text>
      </LinearGradient>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onFindSchool}>
          <Text style={styles.primaryButtonText}>{t('welcome.findSchool')}</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={onRegisterSchool}>
          <Text style={styles.secondaryButtonText}>{t('welcome.registerSchool')}</Text>
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
  languageSwitchWrapper: {
    position: 'absolute',
    right: spacing.lg,
  },
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
