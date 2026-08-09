import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GoogleSignInCancelledError, getGoogleIdToken } from '../api/googleSignIn';
import { registerStudent, registerStudentWithGoogle } from '../api/registration';
import type { RegisterStudentRequest } from '../api/types';
import ClassSectionPicker from '../components/ClassSectionPicker';
import { DatePickerField } from '../components/DatePickerField';
import LabeledInput from '../components/LabeledInput';
import { gradients, colors, radius, shadow, softShadow, spacing } from '../theme/colors';

interface Props {
  schoolId: string;
  onBack: () => void;
  onSubmitted: (message: string) => void;
}

type AuthMode = 'password' | 'google';

export default function RegisterStudentScreen({ schoolId, onBack, onSubmitted }: Props) {
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [form, setForm] = useState<Omit<RegisterStudentRequest, 'classSectionId'>>({
    rollNumber: '',
    name: '',
    dob: '',
    gender: '',
    address: '',
    parentName: '',
    parentContact: '',
    admissionDate: '',
    username: '',
    password: '',
  });
  const [classSectionId, setClassSectionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const coreFieldsFilled =
    !!form.rollNumber &&
    !!form.name &&
    !!form.dob &&
    !!form.gender &&
    !!form.address &&
    !!form.parentName &&
    !!form.parentContact &&
    !!classSectionId &&
    !!form.admissionDate;

  const canSubmit =
    coreFieldsFilled && (authMode === 'google' || (!!form.username && form.password.length >= 8));

  const handleSubmit = async () => {
    if (!canSubmit || !classSectionId) return;
    setSubmitting(true);
    setError(null);
    try {
      let result;
      if (authMode === 'google') {
        const idToken = await getGoogleIdToken();
        const { username, password, ...rest } = form;
        result = await registerStudentWithGoogle(schoolId, { ...rest, classSectionId, idToken });
      } else {
        result = await registerStudent(schoolId, { ...form, classSectionId });
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
        <Text style={styles.title}>Student registration</Text>
        <Text style={styles.subtitle}>Pending admin approval after you submit</Text>
      </LinearGradient>

      <ScrollView style={styles.form} contentContainerStyle={styles.formContent}>
        <LabeledInput label="Roll number" value={form.rollNumber} onChangeText={set('rollNumber')} placeholder="e.g. 8A-045" />
        <LabeledInput label="Full name" value={form.name} onChangeText={set('name')} />
        <DatePickerField label="Date of birth" value={form.dob} onChange={(v) => setForm((p) => ({ ...p, dob: v }))} maximumDate={new Date()} />
        <LabeledInput label="Gender" value={form.gender} onChangeText={set('gender')} placeholder="e.g. MALE" />
        <LabeledInput label="Address" value={form.address} onChangeText={set('address')} />
        <LabeledInput label="Parent name" value={form.parentName} onChangeText={set('parentName')} />
        <LabeledInput label="Parent contact" value={form.parentContact} onChangeText={set('parentContact')} keyboardType="phone-pad" />

        <Text style={styles.fieldLabel}>Class section</Text>
        <ClassSectionPicker schoolId={schoolId} selectedId={classSectionId} onSelect={(cs) => setClassSectionId(cs.id)} />

        <DatePickerField
          label="Admission date"
          value={form.admissionDate}
          onChange={(v) => setForm((p) => ({ ...p, admissionDate: v }))}
          maximumDate={new Date()}
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

        {authMode === 'password' && (
          <>
            <LabeledInput label="Username" value={form.username} onChangeText={set('username')} autoCapitalize="none" />
            <LabeledInput label="Password (min 8 characters)" value={form.password} onChangeText={set('password')} secureTextEntry />
          </>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.disabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>
            {submitting
              ? 'Submitting…'
              : authMode === 'google'
                ? 'Continue with Google'
                : 'Submit registration'}
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
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },
  form: { flex: 1 },
  formContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
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
