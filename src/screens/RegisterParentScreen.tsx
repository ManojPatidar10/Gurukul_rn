import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoogleSignInCancelledError, getGoogleIdToken } from '../api/googleSignIn';
import { registerParent, registerParentWithGoogle } from '../api/registration';
import type { RegisterParentRequest } from '../api/types';
import LabeledInput from '../components/LabeledInput';
import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';

interface Props {
  schoolId: string;
  onBack: () => void;
  onSubmitted: (message: string) => void;
}

type AuthMode = 'password' | 'google';

export default function RegisterParentScreen({ schoolId, onBack, onSubmitted }: Props) {
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [form, setForm] = useState<RegisterParentRequest>({
    name: '',
    email: '',
    phone: '',
    studentRollNumber: '',
    username: '',
    password: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof RegisterParentRequest) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const coreFieldsFilled = !!form.name && !!form.phone && !!form.studentRollNumber;

  const canSubmit =
    coreFieldsFilled &&
    (authMode === 'google' ? true : !!form.email && !!form.username && form.password.length >= 8);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      let result;
      if (authMode === 'google') {
        const idToken = await getGoogleIdToken();
        const { username, password, email, ...rest } = form;
        result = await registerParentWithGoogle(schoolId, { ...rest, idToken });
      } else {
        result = await registerParent(schoolId, form);
      }
      onSubmitted(result.message);
    } catch (e) {
      if (!(e instanceof GoogleSignInCancelledError)) setError((e as Error).message);
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
        <Text style={styles.title}>Parent registration</Text>
        <Text style={styles.subtitle}>Link to your child using their roll number</Text>
      </LinearGradient>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <LabeledInput label="Your name" value={form.name} onChangeText={set('name')} />
        <LabeledInput label="Phone" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
        <LabeledInput
          label="Child's roll number"
          value={form.studentRollNumber}
          onChangeText={set('studentRollNumber')}
          autoCapitalize="characters"
          placeholder="e.g. 8A-045"
        />

        <Text style={styles.sectionLabel}>Your login</Text>
        <View style={styles.modeRow}>
          <Pressable style={[styles.modeTab, authMode === 'password' && styles.modeTabActive]} onPress={() => setAuthMode('password')}>
            <Text style={[styles.modeTabText, authMode === 'password' && styles.modeTabTextActive]}>Username & password</Text>
          </Pressable>
          <Pressable style={[styles.modeTab, authMode === 'google' && styles.modeTabActive]} onPress={() => setAuthMode('google')}>
            <Text style={[styles.modeTabText, authMode === 'google' && styles.modeTabTextActive]}>Google</Text>
          </Pressable>
        </View>

        {authMode === 'password' ? (
          <>
            <LabeledInput label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
            <LabeledInput label="Username" value={form.username} onChangeText={set('username')} autoCapitalize="none" />
            <LabeledInput label="Password (min 8 characters)" value={form.password} onChangeText={set('password')} secureTextEntry />
          </>
        ) : (
          <Text style={styles.googleHint}>Your email will come from your Google account.</Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting ? 'Submitting…' : authMode === 'google' ? 'Continue with Google' : 'Submit registration'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  hero: {
    paddingTop: spacing.xxl * 1.5,
    paddingBottom: spacing.lg,
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
  title: { color: colors.white, fontSize: 20, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4, paddingHorizontal: spacing.lg, textAlign: 'center' },
  form: { flex: 1 },
  formContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.md,
  },
  modeTab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill, alignItems: 'center' },
  modeTabActive: { backgroundColor: colors.primary },
  modeTabText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  modeTabTextActive: { color: colors.white },
  googleHint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  error: { color: colors.error, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
