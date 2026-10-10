import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  createAcademicTerm,
  deleteAcademicTerm,
  importUnlistedTerms,
  listAcademicTerms,
  listUnlistedTerms,
  updateAcademicTerm,
} from '../../api/academicTerms';
import { getErrorMessage } from '../../api/errorMessage';
import type { AcademicTerm, UnlistedTerm } from '../../api/types';
import { DatePickerField } from '../../components/DatePickerField';
import { ErrorNotice } from '../../components/ErrorNotice';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import {
  formatTermDates,
  MAX_ACADEMIC_YEAR_LENGTH,
  MAX_TERM_NAME_LENGTH,
  sortTerms,
  termDraft,
  termInUse,
  termRequest,
  validateTermDraft,
  type TermDraft,
} from '../../utils/academicTerms';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AcademicTerms'>;

/** The form being edited: `id` is null for a new term. */
type Draft = TermDraft & { id: string | null };

/**
 * The school's term list (Academics section, admin). Every assessment picks its term from it once
 * it has one, and a term's dates limit report-card attendance to the term. A school whose
 * assessments already use terms adds those with one tap ("Add them"), rather than by retyping them.
 */
export function AcademicTermsScreen({ navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const [terms, setTerms] = useState<AcademicTerm[] | null>(null);
  const [unlisted, setUnlisted] = useState<UnlistedTerm[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  // The unlisted banner is a helper: if it fails to load, the list itself still works.
  const loadUnlisted = useCallback(
    () =>
      listUnlistedTerms(schoolId)
        .then(setUnlisted)
        .catch(() => setUnlisted([])),
    [schoolId]
  );

  const load = useCallback(
    () =>
      Promise.all([
        listAcademicTerms(schoolId)
          .then((rows) => {
            setTerms(sortTerms(rows));
            setLoadError(null);
          })
          .catch((e) => setLoadError(getErrorMessage(e))),
        loadUnlisted(),
      ]),
    [schoolId, loadUnlisted]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  const retry = () => {
    setLoadError(null);
    load();
  };

  const openDraft = (next: Draft | null) => {
    setDraft(next);
    setFormError(null);
  };

  const editing = draft?.id ? (terms?.find((term) => term.id === draft.id) ?? null) : null;
  // The server refuses renaming a term in use (409 TERM_IN_USE); its dates and year can still change.
  const nameLocked = !!editing && termInUse(editing);

  const save = async () => {
    if (!draft || !terms) return;
    const invalid = validateTermDraft(draft, terms, draft.id);
    if (invalid) {
      setFormError(t(invalid, { name: draft.name.trim() }));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      if (draft.id) {
        await updateAcademicTerm(schoolId, draft.id, termRequest(draft));
        showToast(t('academicTerms.saved'), 'success');
      } else {
        await createAcademicTerm(schoolId, termRequest(draft));
        showToast(t('academicTerms.added'), 'success');
      }
      setDraft(null);
      await load();
    } catch (e) {
      setFormError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (term: AcademicTerm) =>
    Alert.alert(t('academicTerms.deleteTitle'), t('academicTerms.deleteMessage', { name: term.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAcademicTerm(schoolId, term.id);
            setDraft(null);
            showToast(t('academicTerms.deleted'), 'success');
            await load();
          } catch (e) {
            // A term in use comes back as 409 with the counts in the server's message.
            Alert.alert(t('academicTerms.deleteFailedTitle'), getErrorMessage(e));
          }
        },
      },
    ]);

  const importAll = async () => {
    setImporting(true);
    try {
      const before = terms?.length ?? 0;
      const rows = await importUnlistedTerms(schoolId);
      setTerms(sortTerms(rows));
      const added = Math.max(rows.length - before, 0);
      showToast(t('academicTerms.imported', { count: added }), 'success');
      await loadUnlisted();
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setImporting(false);
    }
  };

  const usage = (term: AcademicTerm): string | null => {
    if (term.assessmentCount == null || term.publishedSectionCount == null) return null;
    return `${t('academicTerms.usedBy', { count: term.assessmentCount })} · ${t('academicTerms.publishedFor', {
      count: term.publishedSectionCount,
    })}`;
  };

  const form = draft && (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{draft.id ? t('academicTerms.editTitle') : t('academicTerms.newTitle')}</Text>
      <LabeledInput
        label={t('academicTerms.form.name')}
        required
        value={draft.name}
        onChangeText={(name) => setDraft({ ...draft, name })}
        maxLength={MAX_TERM_NAME_LENGTH}
        placeholder={t('academicTerms.form.namePlaceholder')}
        editable={!nameLocked}
        style={nameLocked ? styles.lockedInput : undefined}
      />
      {nameLocked && <Text style={styles.fieldHint}>{t('academicTerms.form.nameLocked')}</Text>}
      <DatePickerField
        label={t('academicTerms.form.startDate')}
        value={draft.startDate}
        onChange={(startDate) => setDraft({ ...draft, startDate })}
        placeholder={t('common.selectDate')}
      />
      <DatePickerField
        label={t('academicTerms.form.endDate')}
        value={draft.endDate}
        onChange={(endDate) => setDraft({ ...draft, endDate })}
        placeholder={t('common.selectDate')}
      />
      <View style={styles.datesRow}>
        <Text style={styles.fieldHint}>{t('academicTerms.form.datesHint')}</Text>
        {(draft.startDate !== '' || draft.endDate !== '') && (
          <Pressable onPress={() => setDraft({ ...draft, startDate: '', endDate: '' })} accessibilityRole="button">
            <Text style={styles.linkText}>{t('academicTerms.form.clearDates')}</Text>
          </Pressable>
        )}
      </View>
      <LabeledInput
        label={t('academicTerms.form.academicYear')}
        value={draft.academicYear}
        onChangeText={(academicYear) => setDraft({ ...draft, academicYear })}
        maxLength={MAX_ACADEMIC_YEAR_LENGTH}
        placeholder={t('academicTerms.form.academicYearHint')}
      />
      {formError && <ErrorNotice message={formError} />}
      <View style={styles.formButtons}>
        <Pressable style={styles.secondaryButton} onPress={() => openDraft(null)}>
          <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
        </Pressable>
        <Pressable style={[styles.primaryButton, saving && styles.disabled]} disabled={saving} onPress={save}>
          <Text style={styles.primaryText}>{saving ? t('common.saving') : t('common.save')}</Text>
        </Pressable>
      </View>
      {editing && (
        <Pressable style={styles.removeButton} onPress={() => confirmDelete(editing)}>
          <Text style={styles.removeText}>{t('academicTerms.delete')}</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('academicTerms.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>{t('academicTerms.intro')}</Text>
        <Text style={styles.hint}>{t('academicTerms.yearHint')}</Text>

        {loadError && (
          <>
            <ErrorNotice message={loadError} />
            <Pressable onPress={retry} style={styles.retry}>
              <Text style={styles.linkText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        )}

        {terms !== null && unlisted.length > 0 && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>
              {t('academicTerms.unlisted', { count: unlisted.length, names: unlisted.map((u) => u.term).join(', ') })}
            </Text>
            <Pressable
              style={[styles.bannerButton, importing && styles.disabled]}
              onPress={importAll}
              disabled={importing}
              accessibilityRole="button"
            >
              <Text style={styles.bannerButtonText}>
                {importing ? t('academicTerms.importing') : t('academicTerms.importButton')}
              </Text>
            </Pressable>
          </View>
        )}

        {terms !== null && !draft && (
          <Pressable style={styles.addButton} onPress={() => openDraft({ ...termDraft(), id: null })}>
            <Text style={styles.addText}>+ {t('academicTerms.add')}</Text>
          </Pressable>
        )}
        {draft && !draft.id && form}

        {terms === null && !loadError && <ActivityIndicator color={colors.primary} style={styles.loading} />}
        {terms?.length === 0 && <Text style={styles.empty}>{t('academicTerms.empty')}</Text>}
        {terms?.map((term) =>
          draft?.id === term.id ? (
            <View key={term.id}>{form}</View>
          ) : (
            <Pressable
              key={term.id}
              style={styles.row}
              onPress={() => openDraft({ ...termDraft(term), id: term.id })}
              accessibilityRole="button"
            >
              <Text style={styles.rowTitle}>{term.name}</Text>
              <Text style={styles.rowMeta}>{formatTermDates(term, i18n.language) ?? t('academicTerms.noDates')}</Text>
              {!!term.academicYear && (
                <Text style={styles.rowMeta}>{t('academicTerms.academicYear', { year: term.academicYear })}</Text>
              )}
              {usage(term) !== null && <Text style={styles.rowUsage}>{usage(term)}</Text>}
            </Pressable>
          )
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  empty: { color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: spacing.md, lineHeight: 19 },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  linkText: { color: colors.primary, fontWeight: '700' },
  banner: {
    backgroundColor: '#FFF3E0',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: { fontSize: 13, color: colors.textPrimary, lineHeight: 19, marginBottom: spacing.sm },
  bannerButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bannerButtonText: { color: colors.white, fontWeight: '700' },
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
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowUsage: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...softShadow },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  lockedInput: { opacity: 0.6 },
  fieldHint: { flex: 1, fontSize: 12, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.md },
  datesRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  formButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  secondaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceMuted, alignItems: 'center' },
  secondaryText: { color: colors.textSecondary, fontWeight: '800' },
  primaryButton: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  removeButton: { alignItems: 'center', paddingTop: spacing.md },
  removeText: { color: colors.error, fontWeight: '800' },
});
