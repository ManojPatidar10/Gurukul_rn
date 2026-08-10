import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { login } from '../api/auth';
import { setAuthToken } from '../api/client';
import { LanguageSwitch } from '../components/LanguageSwitch';
import LabeledInput from '../components/LabeledInput';
import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';

interface Props {
  schoolId: string;
  onBack: () => void;
  onLoggedIn: (session: Session) => void;
  onRegister?: () => void;
}

export default function LoginScreen({ schoolId, onBack, onLoggedIn, onRegister }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!username && !!password;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(schoolId, { username, password });
      setAuthToken(session.token);
      onLoggedIn(session);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <LinearGradient colors={gradients.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={[styles.languageSwitchWrapper, { top: insets.top + spacing.xs }]}>
          <LanguageSwitch />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>G</Text>
        </View>
        <Text style={styles.title}>Gurukul</Text>
        <Text style={styles.subtitle}>{t('auth.signInSubtitle')}</Text>
      </LinearGradient>

      <View style={styles.form}>
        <LabeledInput label={t('auth.username')} value={username} onChangeText={setUsername} autoCapitalize="none" />
        <LabeledInput label={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />

        {error && (
          <Text style={[styles.error, error.includes('pending admin approval') && styles.pendingNotice]}>
            {error}
          </Text>
        )}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? t('auth.signingIn') : t('auth.signIn')}</Text>
        </Pressable>

        {onRegister && (
          <Pressable onPress={onRegister} style={styles.linkButton}>
            <Text style={styles.linkText}>{t('auth.newHereCreateAccount')}</Text>
          </Pressable>
        )}
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
  backButton: {
    position: 'absolute',
    top: spacing.xxl,
    left: spacing.lg,
    width: 38,
    height: 38,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  languageSwitchWrapper: {
    position: 'absolute',
    right: spacing.lg,
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
  form: { padding: spacing.lg, paddingTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
  pendingNotice: { color: colors.warning, fontWeight: '600' },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
  linkButton: { marginTop: spacing.lg, alignItems: 'center' },
  linkText: { color: colors.primary, fontWeight: '600' },
});
