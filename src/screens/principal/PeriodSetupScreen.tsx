import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getPeriods, savePeriods } from '../../api/timetable';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  MAX_PERIODS,
  nextPeriodRow,
  periodRowsToRequest,
  validatePeriodRows,
  type PeriodRow,
  type PeriodRowError,
} from '../../utils/timetable';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PeriodSetup'>;

interface KeyedRow extends PeriodRow {
  key: string;
}

let nextKey = 0;
const newKey = () => `p-${nextKey++}`;

/** Admin-only: the school's one bell schedule (period timings + breaks) and the Saturday switch. */
export function PeriodSetupScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [rows, setRows] = useState<KeyedRow[]>([]);
  const [saturdayEnabled, setSaturdayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    getPeriods(schoolId)
      .then((schedule) => {
        setSaturdayEnabled(schedule.saturdayEnabled);
        setRows(
          schedule.periods.map((p) => ({
            key: newKey(),
            startTime: p.startTime,
            endTime: p.endTime,
            breakPeriod: p.breakPeriod,
            label: p.label ?? '',
          }))
        );
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const update = (key: string, patch: Partial<PeriodRow>) => {
    setSuccess(false);
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };
  const remove = (key: string) => {
    setSuccess(false);
    setRows((prev) => prev.filter((r) => r.key !== key));
  };
  const add = () => {
    setSuccess(false);
    setRows((prev) => [...prev, { key: newKey(), ...nextPeriodRow(prev) }]);
  };

  const validation = validatePeriodRows(rows);

  const errorText = (v: PeriodRowError): string => {
    switch (v.code) {
      case 'empty':
        return t('timetable.periods.errors.empty');
      case 'tooMany':
        return t('timetable.periods.errors.tooMany', { max: v.max });
      case 'badTime':
        return t('timetable.periods.errors.badTime', { n: v.periodNumber });
      case 'endBeforeStart':
        return t('timetable.periods.errors.endBeforeStart', { n: v.periodNumber });
      case 'overlap':
        return t('timetable.periods.errors.overlap', { n: v.periodNumber, previous: v.previous });
    }
  };

  const handleSave = async () => {
    if (validation) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await savePeriods(schoolId, { saturdayEnabled, periods: periodRowsToRequest(rows) });
      setSuccess(true);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('timetable.periods.title')} subtitle={t('timetable.periods.subtitle')} onBack={() => navigation.goBack()} />
      <ScreenContainer keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>{t('timetable.periods.intro')}</Text>

        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}

        {!loading && (
          <>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{t('timetable.periods.saturday')}</Text>
              <Switch
                value={saturdayEnabled}
                onValueChange={(v) => {
                  setSuccess(false);
                  setSaturdayEnabled(v);
                }}
                trackColor={{ true: colors.primary, false: colors.border }}
              />
            </View>

            <Text style={styles.hint}>{t('timetable.periods.timeHint')}</Text>

            {rows.map((row, index) => (
              <View key={row.key} style={[styles.card, row.breakPeriod && styles.breakCard]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('timetable.periodN', { n: index + 1 })}</Text>
                  <View style={styles.breakToggle}>
                    <Text style={styles.breakLabel}>{t('timetable.periods.isBreak')}</Text>
                    <Switch
                      value={row.breakPeriod}
                      onValueChange={(v) => update(row.key, { breakPeriod: v })}
                      trackColor={{ true: colors.warning, false: colors.border }}
                    />
                  </View>
                  <Pressable onPress={() => remove(row.key)} style={styles.removeButton} accessibilityLabel={t('common.remove')}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
                <View style={styles.inputs}>
                  <View style={styles.timeField}>
                    <Text style={styles.fieldLabel}>{t('timetable.periods.start')}</Text>
                    <TextInput
                      style={styles.input}
                      value={row.startTime}
                      onChangeText={(text) => update(row.key, { startTime: text })}
                      placeholder="08:00"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                  <View style={styles.timeField}>
                    <Text style={styles.fieldLabel}>{t('timetable.periods.end')}</Text>
                    <TextInput
                      style={styles.input}
                      value={row.endTime}
                      onChangeText={(text) => update(row.key, { endTime: text })}
                      placeholder="08:40"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                  <View style={styles.labelField}>
                    <Text style={styles.fieldLabel}>{t('timetable.periods.label')}</Text>
                    <TextInput
                      style={styles.input}
                      value={row.label}
                      onChangeText={(text) => update(row.key, { label: text })}
                      placeholder={row.breakPeriod ? t('timetable.break') : ''}
                      placeholderTextColor={colors.textMuted}
                      maxLength={50}
                    />
                  </View>
                </View>
              </View>
            ))}

            {rows.length < MAX_PERIODS && (
              <Pressable style={styles.addButton} onPress={add}>
                <Text style={styles.addText}>{t('timetable.periods.add')}</Text>
              </Pressable>
            )}

            {validation && <Text style={styles.error}>{errorText(validation)}</Text>}
            {error && <Text style={styles.error}>{error}</Text>}
            {success && <Text style={styles.success}>{t('timetable.periods.saved')}</Text>}

            <Pressable
              style={[styles.saveButton, (!!validation || saving) && styles.disabled]}
              onPress={handleSave}
              disabled={!!validation || saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.saveText}>{t('timetable.periods.save')}</Text>
              )}
            </Pressable>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  description: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: spacing.md },
  loading: { marginTop: spacing.xl },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  breakCard: { backgroundColor: colors.surfaceMuted },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  breakToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  breakLabel: { fontSize: 13, color: colors.textSecondary },
  removeButton: { paddingLeft: spacing.md, paddingVertical: spacing.xs },
  removeText: { color: colors.error, fontWeight: '700', fontSize: 16 },
  inputs: { flexDirection: 'row', gap: spacing.sm },
  timeField: { width: 72 },
  labelField: { flex: 1 },
  fieldLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  input: {
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 14,
    color: colors.textPrimary,
  },
  addButton: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  addText: { color: colors.primary, fontWeight: '700' },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  saveText: { color: colors.white, fontWeight: '700' },
});
