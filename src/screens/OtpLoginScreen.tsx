import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { requestOtp, verifyOtp } from '../api/auth';
import { setAuthToken } from '../api/client';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { Logo } from '../components/Logo';
import LabeledInput from '../components/LabeledInput';
import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';

interface Props {
  schoolId: string;
  schoolName?: string;
  onBack: () => void;
  onUsePassword: () => void;
  onLoggedIn: (session: Session) => void;
  onRegister?: () => void;
}

export default function OtpLoginScreen({ schoolId, schoolName, onBack, onUsePassword, onLoggedIn, onRegister }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRequestOtp = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await requestOtp(schoolId, { phone });
      setOtpSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await verifyOtp(schoolId, { phone, otp });
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
        <Logo width={120} onDarkBackground />
        <Text style={styles.title}>{schoolName ?? t('auth.signIn')}</Text>
        <Text style={styles.subtitle}>{t('auth.signInWithPhoneSubtitle')}</Text>
      </LinearGradient>

      <View style={styles.form}>
        <LabeledInput
          label={t('auth.phoneNumber')}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!otpSent}
        />

        {otpSent && (
          <LabeledInput label={t('auth.otp')} value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="1234" />
        )}

        {error && (
          <Text style={[styles.error, error.includes('pending admin approval') && styles.pendingNotice]}>
            {error}
          </Text>
        )}

        {!otpSent ? (
          <Pressable
            style={[styles.submit, (!phone || submitting) && styles.disabled]}
            onPress={handleRequestOtp}
            disabled={!phone || submitting}
          >
            <Text style={styles.submitText}>{submitting ? t('auth.sendingOtp') : t('auth.sendOtp')}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.submit, (!otp || submitting) && styles.disabled]}
              onPress={handleVerifyOtp}
              disabled={!otp || submitting}
            >
              <Text style={styles.submitText}>{submitting ? t('auth.verifyingOtp') : t('auth.verifyAndSignIn')}</Text>
            </Pressable>
            <Pressable onPress={() => setOtpSent(false)} style={styles.linkButton}>
              <Text style={styles.linkText}>{t('auth.changePhoneNumber')}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={onUsePassword} style={styles.linkButton}>
          <Text style={styles.linkText}>{t('auth.useUsernamePassword')}</Text>
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
  title: { color: colors.white, fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, textAlign: 'center' },
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
