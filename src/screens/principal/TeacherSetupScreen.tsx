import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createEmployee } from '../../api/employees';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { todayIso } from '../../utils/timetable';
import { isValidPhone } from '../../utils/validators';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TeacherSetup'>;

interface TeacherRow {
  name: string;
  phone: string;
}

const EMPTY: TeacherRow = { name: '', phone: '' };
const START_ROWS = 5;

/**
 * Adds the teaching staff by name and mobile only. A teacher whose number is on their employee
 * record signs in with an OTP on that number straight away (the server creates their login on the
 * first OTP), so nothing else is needed to get them in; designation and the rest can be edited later.
 */
export function TeacherSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [rows, setRows] = useState<TeacherRow[]>(Array.from({ length: START_ROWS }, () => ({ ...EMPTY })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, patch: Partial<TeacherRow>) =>
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const filled = rows.filter((r) => r.name.trim() || r.phone.trim());
  const invalid = filled.filter((r) => !r.name.trim() || !isValidPhone(r.phone));
  const duplicates = new Set(filled.map((r) => r.phone.trim()).filter((p, i, all) => p && all.indexOf(p) !== i));

  const handleSave = async () => {
    if (invalid.length > 0 || duplicates.size > 0) {
      setError(duplicates.size > 0 ? t('teacherSetup.duplicatePhone') : t('teacherSetup.invalidRow'));
      return;
    }
    setError(null);
    setSaving(true);
    let created = 0;
    const failed: string[] = [];
    for (const row of filled) {
      try {
        await createEmployee(schoolId, {
          name: row.name.trim(),
          designation: 'Teacher',
          joinDate: todayIso(),
          contactPhone: row.phone.trim(),
          employeeType: 'TEACHING',
        });
        created += 1;
      } catch (e) {
        failed.push(`${row.name.trim()}: ${getErrorMessage(e)}`);
      }
    }
    setSaving(false);
    if (failed.length > 0) {
      setError(t('teacherSetup.partlyAdded', { count: created, errors: failed.join('; ') }));
      setRows((prev) => prev.filter((r) => failed.some((f) => f.startsWith(`${r.name.trim()}:`))));
      return;
    }
    showToast(t('teacherSetup.added', { count: created }), 'success');
    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('teacherSetup.title')} subtitle={t('teacherSetup.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {error && <ErrorNotice message={error} />}
        <Text style={styles.intro}>{t('teacherSetup.intro')}</Text>
        <View style={styles.headerRow}>
          <Text style={[styles.colHeader, styles.nameCol]}>{t('teacherSetup.name')}</Text>
          <Text style={[styles.colHeader, styles.phoneCol]}>{t('teacherSetup.phone')}</Text>
        </View>
        {rows.map((row, index) => {
          const bad = (row.name.trim() || row.phone.trim()) && (!row.name.trim() || !isValidPhone(row.phone) || duplicates.has(row.phone.trim()));
          return (
            <View key={index} style={styles.row}>
              <TextInput
                style={[styles.cell, styles.nameCol, bad && styles.cellBad]}
                value={row.name}
                onChangeText={(name) => update(index, { name })}
                placeholder={t('teacherSetup.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={`${t('teacherSetup.name')} ${index + 1}`}
              />
              <TextInput
                style={[styles.cell, styles.phoneCol, bad && styles.cellBad]}
                value={row.phone}
                onChangeText={(phone) => update(index, { phone: phone.replace(/\D/g, '').slice(-10) })}
                placeholder="98765 43210"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                maxLength={10}
                accessibilityLabel={`${t('teacherSetup.phone')} ${index + 1}`}
              />
            </View>
          );
        })}
        <Pressable style={styles.secondary} onPress={() => setRows((prev) => [...prev, { ...EMPTY }])} accessibilityRole="button">
          <Text style={styles.secondaryText}>{t('teacherSetup.addRow')}</Text>
        </Pressable>
        <View style={styles.note}>
          <Text style={styles.noteText}>{t('teacherSetup.howTheySignIn')}</Text>
        </View>
        <Pressable
          style={[styles.submit, (filled.length === 0 || saving) && styles.submitDisabled]}
          onPress={handleSave}
          disabled={filled.length === 0 || saving}
          accessibilityRole="button"
        >
          <Text style={styles.submitText}>{saving ? t('teacherSetup.adding') : t('teacherSetup.add', { count: filled.length })}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  colHeader: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  nameCol: { flex: 3 },
  phoneCol: { flex: 2 },
  cell: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.textPrimary },
  cellBad: { borderColor: colors.error },
  secondary: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  secondaryText: { color: colors.primary, fontWeight: '700' },
  note: { backgroundColor: accents.employees.light, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  noteText: { fontSize: 13, color: colors.textPrimary },
  submit: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center', ...softShadow },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700', fontSize: 16 },
});
