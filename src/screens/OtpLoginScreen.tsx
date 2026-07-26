import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { requestOtp, verifyOtp } from '../api/auth';
import { setAuthToken } from '../api/client';
import LabeledInput from '../components/LabeledInput';
import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';
import type { Session } from '../api/authStorage';

interface Props {
  schoolId: string;
  schoolName?: string;
  onBack: () => void;
  onUsePassword: () => void;
  onLoggedIn: (session: Session) => void;
}

export default function OtpLoginScreen({ schoolId, schoolName, onBack, onUsePassword, onLoggedIn }: Props) {
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
        <View style={styles.badge}>
          <Text style={styles.badgeText}>G</Text>
        </View>
        <Text style={styles.title}>{schoolName ?? 'Sign in'}</Text>
        <Text style={styles.subtitle}>Sign in with your phone number</Text>
      </LinearGradient>

      <View style={styles.form}>
        <LabeledInput
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          editable={!otpSent}
        />

        {otpSent && (
          <LabeledInput label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" placeholder="1234" />
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        {!otpSent ? (
          <Pressable
            style={[styles.submit, (!phone || submitting) && styles.disabled]}
            onPress={handleRequestOtp}
            disabled={!phone || submitting}
          >
            <Text style={styles.submitText}>{submitting ? 'Sending…' : 'Send OTP'}</Text>
          </Pressable>
        ) : (
          <>
            <Pressable
              style={[styles.submit, (!otp || submitting) && styles.disabled]}
              onPress={handleVerifyOtp}
              disabled={!otp || submitting}
            >
              <Text style={styles.submitText}>{submitting ? 'Verifying…' : 'Verify & sign in'}</Text>
            </Pressable>
            <Pressable onPress={() => setOtpSent(false)} style={styles.linkButton}>
              <Text style={styles.linkText}>Change phone number</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={onUsePassword} style={styles.linkButton}>
          <Text style={styles.linkText}>Sign in with username & password instead</Text>
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
  title: { color: colors.white, fontSize: 22, fontWeight: '800', paddingHorizontal: spacing.lg, textAlign: 'center' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  form: { padding: spacing.lg, paddingTop: spacing.xl },
  error: { color: colors.error, marginBottom: spacing.md },
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
