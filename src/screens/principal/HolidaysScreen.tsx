import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { createHoliday, deleteHoliday, listHolidays, updateHoliday } from '../../api/holidays';
import type { Holiday, HolidayKind, HolidayRequest } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'Holidays'>;

interface Draft {
  id: string | null;
  name: string;
  date: string;
  kind: HolidayKind;
  greetingEnabled: boolean;
  greetingTitle: string;
  greetingMessage: string;
}

const EMPTY: Draft = { id: null, name: '', date: '', kind: 'FESTIVAL', greetingEnabled: true, greetingTitle: '', greetingMessage: '' };

/**
 * The school's holidays & festivals (Academics section). Pre-filled with national days and
 * festivals; the principal adds the school's own, edits dates and greeting text, or switches a
 * greeting off. Festivals with the greeting on are greeted automatically on their day.
 */
export function HolidaysScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [holidays, setHolidays] = useState<Holiday[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    return listHolidays(schoolId)
      .then((rows) => {
        setHolidays(rows);
        setError(null);
      })
      .catch((e) => setError(getErrorMessage(e)));
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const toRequest = (d: Draft): HolidayRequest => ({
    name: d.name.trim(),
    date: d.date,
    kind: d.kind,
    greetingEnabled: d.greetingEnabled,
    greetingTitle: d.greetingTitle.trim(),
    greetingMessage: d.greetingMessage.trim(),
  });

  const fromHoliday = (h: Holiday): Draft => ({
    id: h.id,
    name: h.name,
    date: h.date,
    kind: h.kind,
    greetingEnabled: h.greetingEnabled,
    greetingTitle: h.greetingTitle,
    greetingMessage: h.greetingMessage,
  });

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      if (draft.id) await updateHoliday(schoolId, draft.id, toRequest(draft));
      else await createHoliday(schoolId, toRequest(draft));
      setDraft(null);
      showToast(t('holidays.saved'), 'success');
      await load();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleGreeting = async (h: Holiday, on: boolean) => {
    setBusyId(h.id);
    setHolidays((rows) => rows?.map((r) => (r.id === h.id ? { ...r, greetingEnabled: on } : r)) ?? null);
    try {
      const saved = await updateHoliday(schoolId, h.id, toRequest({ ...fromHoliday(h), greetingEnabled: on }));
      setHolidays((rows) => rows?.map((r) => (r.id === h.id ? saved : r)) ?? null);
    } catch (e) {
      setError(getErrorMessage(e));
      load();
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = (h: Holiday) =>
    Alert.alert(t('holidays.deleteTitle'), t('holidays.deleteBody', { name: h.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('holidays.remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteHoliday(schoolId, h.id);
            setDraft(null);
            await load();
          } catch (e) {
            setError(getErrorMessage(e));
          }
        },
      },
    ]);

  const monthLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' });
  const dayLabel = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' });

  const valid = !!draft && draft.name.trim() !== '' && draft.date !== '';

  const form = draft && (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{draft.id ? t('holidays.edit') : t('holidays.newTitle')}</Text>
      <LabeledInput label={t('holidays.form.name')} required value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} maxLength={120} />
      <DatePickerField label={t('holidays.form.date')} value={draft.date} onChange={(date) => setDraft({ ...draft, date })} />
      <Text style={styles.label}>{t('holidays.form.kind')}</Text>
      <View style={styles.chips}>
        {(['FESTIVAL', 'HOLIDAY'] as HolidayKind[]).map((k) => (
          <Pressable
            key={k}
            style={[styles.chip, draft.kind === k && styles.chipActive]}
            onPress={() => setDraft({ ...draft, kind: k, greetingEnabled: draft.id ? draft.greetingEnabled : k === 'FESTIVAL' })}
          >
            <Text style={[styles.chipText, draft.kind === k && styles.chipTextActive]}>{t(`holidays.kind.${k}`)}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.switchRow}>
        <Text style={styles.switchText}>{t('holidays.form.greeting')}</Text>
        <Switch
          value={draft.greetingEnabled}
          onValueChange={(greetingEnabled) => setDraft({ ...draft, greetingEnabled })}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      {draft.greetingEnabled && (
        <>
          <LabeledInput
            label={t('holidays.form.greetingTitle')}
            value={draft.greetingTitle}
            onChangeText={(greetingTitle) => setDraft({ ...draft, greetingTitle })}
            maxLength={120}
          />
          <Text style={styles.label}>{t('holidays.form.greetingMessage')}</Text>
          <TextInput
            style={styles.messageInput}
            value={draft.greetingMessage}
            onChangeText={(greetingMessage) => setDraft({ ...draft, greetingMessage })}
            multiline
            maxLength={1000}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.hint}>{t('holidays.form.textHint')}</Text>
        </>
      )}
      <View style={styles.formButtons}>
        <Pressable style={styles.secondaryButton} onPress={() => setDraft(null)}>
          <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, (!valid || saving) && styles.disabled]} disabled={!valid || saving} onPress={save}>
          <Text style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</Text>
        </Pressable>
      </View>
      {draft.id && (
        <Pressable
          style={styles.removeButton}
          onPress={() => {
            const h = holidays?.find((row) => row.id === draft.id);
            if (h) confirmDelete(h);
          }}
        >
          <Text style={styles.removeText}>{t('holidays.remove')}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('holidays.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>{t('holidays.hint')}</Text>
        {error && <ErrorNotice message={error} />}
        {!draft && (
          <Pressable style={styles.addButton} onPress={() => setDraft({ ...EMPTY })}>
            <Text style={styles.addText}>+ {t('holidays.add')}</Text>
          </Pressable>
        )}
        {draft && !draft.id && form}
        {holidays === null && !error && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {holidays?.length === 0 && <Text style={styles.empty}>{t('holidays.empty')}</Text>}
        {holidays?.map((h, index) => {
          const newMonth = index === 0 || holidays[index - 1].date.slice(0, 7) !== h.date.slice(0, 7);
          return (
            <View key={h.id}>
              {newMonth && <Text style={styles.month}>{monthLabel(h.date)}</Text>}
              {draft?.id === h.id ? (
                form
              ) : (
                <Pressable style={styles.row} onPress={() => setDraft(fromHoliday(h))}>
                  <View style={styles.rowMain}>
                    <Text style={styles.rowTitle}>{h.name}</Text>
                    <Text style={styles.rowMeta}>
                      {dayLabel(h.date)} · {t(`holidays.kind.${h.kind}`)}
                      {h.festivalKey ? ` · ${t('holidays.builtIn')}` : ''}
                    </Text>
                    <View style={styles.chipRow}>
                      <StatusChip
                        label={h.greetingEnabled ? t('holidays.greetingOn') : t('holidays.greetingOff')}
                        variant={h.greetingEnabled ? 'success' : 'neutral'}
                      />
                    </View>
                  </View>
                  {busyId === h.id ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Switch
                      value={h.greetingEnabled}
                      onValueChange={(on) => toggleGreeting(h, on)}
                      trackColor={{ true: colors.primary, false: colors.border }}
                    />
                  )}
                </Pressable>
              )}
            </View>
          );
        })}
        {holidays && holidays.length > 0 && <Text style={styles.hint}>{t('holidays.dateCheck')}</Text>}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md },
  addButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addText: { color: colors.primary, fontWeight: '800', fontSize: 15 },
  month: { fontSize: 14, fontWeight: '800', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chipRow: { flexDirection: 'row', marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...softShadow },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontWeight: '700', color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  switchText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  messageInput: {
    minHeight: 110,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 15,
    textAlignVertical: 'top',
    marginBottom: spacing.sm,
  },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  secondaryText: { color: colors.textSecondary, fontWeight: '800' },
  primaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  removeButton: { alignItems: 'center', paddingTop: spacing.md },
  removeText: { color: colors.error, fontWeight: '800' },
});
