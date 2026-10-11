import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { backfillSectionTerm, listSectionTerms } from '../../api/assessments';
import { getPublishCheck, publishReportCards, unpublishReportCards } from '../../api/reportCards';
import type { ReportCardPublication, TermSummary } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { useAcademicTerms } from '../../hooks/useAcademicTerms';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { publishTermChoices, termKey } from '../../utils/academicTerms';
import { canonicalTerm, findExistingTerm } from '../../utils/assessmentTerms';
import {
  canPublish,
  MAX_UNPUBLISH_REASON_LENGTH,
  nothingToPublishMessage,
  publishConfirmation,
  unpublishReasonError,
} from '../../utils/reportCardPublish';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PublishReportCards'>;

export function PublishReportCardsScreen({ route, navigation }: Props) {
  const { t, i18n } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const isAdmin = session.role === 'ADMIN';
  const classSection = route.params.classSection;
  // The school's term list: once it has terms, the chips follow it (in date order). An older server
  // has none, and the screen works from the section's own terms as before - and so does a failed
  // load, which shows a notice with Retry.
  const {
    terms: listedTerms,
    configured: termListConfigured,
    error: termListError,
    reload: reloadTermList,
  } = useAcademicTerms(schoolId);
  // No pre-filled term: publishing notifies every family, so the term is always an explicit pick
  // from the ones this section's assessments actually use.
  const [term, setTerm] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermSummary[] | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [backfillTerm, setBackfillTerm] = useState('');
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportCardPublication | null>(null);
  // The inline Unpublish panel (admin only): open, the typed reason, and whether Unpublish was tried.
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [unpublishReason, setUnpublishReason] = useState('');
  const [unpublishTried, setUnpublishTried] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const loadTerms = useCallback(() => {
    listSectionTerms(schoolId, classSection.id)
      .then((loaded) => {
        setTermsError(null);
        setTerms(loaded);
        setTerm((current) => (current && loaded.some((summary) => summary.term === current) ? current : null));
      })
      .catch((e) => {
        // Don't leave stale chips beside the error - they'd look current.
        setTerms(null);
        setTerm(null);
        setTermsError(getErrorMessage(e));
      });
  }, [schoolId, classSection.id]);

  useEffect(loadTerms, [loadTerms]);

  const retryTerms = () => {
    setTermsError(null);
    loadTerms();
  };

  // `busy` only disables Publish after the next render, so a quick double tap could run two checks,
  // stack two confirmations and send two publishes at once. This is set on the tap itself and held
  // until the flow ends: refused, failed, cancelled or published.
  const publishFlow = useRef(false);
  const endPublishFlow = () => {
    publishFlow.current = false;
  };

  const publish = async (confirmedTerm: string) => {
    setPublishing(true);
    setError(null);
    try {
      const publication = await publishReportCards(schoolId, classSection.id, confirmedTerm);
      setResult(publication);
      loadTerms();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setPublishing(false);
      endPublishFlow();
    }
  };

  // The confirmation's dates: the device's own format in English (as before), Hindi month names in Hindi.
  const formatPublishDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language === 'hi' ? 'hi' : undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  // Publishing is never one tap: check what it would do first, and make the admin confirm the
  // counts and warnings (missing marks, un-termed assessments, already published).
  const handlePublish = async () => {
    if (!term || publishFlow.current) return;
    publishFlow.current = true;
    let confirming = false;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const check = await getPublishCheck(schoolId, classSection.id, term);
      if (!canPublish(check)) {
        Alert.alert(t('reportCardPublish.nothingTitle'), nothingToPublishMessage(check, t));
        return;
      }
      const { title, message } = publishConfirmation(check, formatPublishDate, t);
      Alert.alert(
        title,
        message,
        [
          { text: t('common.cancel'), style: 'cancel', onPress: endPublishFlow },
          { text: t('reportCardPublish.publish'), style: 'destructive', onPress: () => publish(check.term) },
        ],
        { onDismiss: endPublishFlow }
      );
      confirming = true;
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setChecking(false);
      // While the confirmation is up, its buttons end the flow.
      if (!confirming) endPublishFlow();
    }
  };

  const closeUnpublish = () => {
    setUnpublishOpen(false);
    setUnpublishReason('');
    setUnpublishTried(false);
  };

  const pickTerm = (next: string) => {
    setTerm(next);
    closeUnpublish();
  };

  // Like publishFlow: `unpublishing` is only set once the confirmation is accepted, so a quick double
  // tap could stack two confirmations and send two unpublishes (the second fails as not published).
  const unpublishFlow = useRef(false);
  const endUnpublishFlow = () => {
    unpublishFlow.current = false;
  };

  const unpublish = async (unpublishTerm: string, reason: string) => {
    setUnpublishing(true);
    setError(null);
    try {
      const done = await unpublishReportCards(schoolId, classSection.id, unpublishTerm, reason);
      showToast(t('reportCardUnpublish.done', { term: done.term }), 'success');
      setResult(null);
      closeUnpublish();
      loadTerms();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setUnpublishing(false);
      endUnpublishFlow();
    }
  };

  const handleUnpublish = () => {
    if (!term || unpublishFlow.current) return;
    setUnpublishTried(true);
    const reason = unpublishReason.trim();
    if (unpublishReasonError(reason)) return;
    unpublishFlow.current = true;
    Alert.alert(
      t('reportCardUnpublish.confirmTitle'),
      t('reportCardUnpublish.confirmMessage', {
        term,
        className: `${classSection.className} - ${classSection.section}`,
      }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: endUnpublishFlow },
        { text: t('reportCardUnpublish.confirm'), style: 'destructive', onPress: () => unpublish(term, reason) },
      ],
      { onDismiss: endUnpublishFlow }
    );
  };

  // With a term list: the listed terms in order, then old terms only this section uses.
  const choices = publishTermChoices(termListConfigured ? listedTerms : [], terms ?? []);
  const selectedSummary = term ? ((terms ?? []).find((summary) => summary.term === term) ?? null) : null;
  // Unpublish needs a server that has it: it's the one that sends publishedAt on the section's terms.
  const canOfferUnpublish = !!selectedSummary?.published && selectedSummary.publishedAt !== undefined;
  const reasonError = unpublishTried ? unpublishReasonError(unpublishReason) : null;

  const termNames = (terms ?? []).map((summary) => summary.term);
  const backfillTarget = canonicalTerm(backfillTerm, termNames);
  const backfillMatch = findExistingTerm(backfillTerm, termNames);
  const backfillTargetPublished = (terms ?? []).some((summary) => summary.published && summary.term === backfillTarget);

  const handleBackfill = async () => {
    if (!backfillTarget) return;
    setBackfilling(true);
    try {
      const { assessmentsUpdated } = await backfillSectionTerm(schoolId, classSection.id, backfillTarget);
      if (assessmentsUpdated > 0) {
        showToast(t('reportCardPublish.backfillDone', { count: assessmentsUpdated, term: backfillTarget }), 'success');
        setBackfillTerm('');
        loadTerms();
      } else {
        showToast(t('reportCardPublish.backfillNone'), 'info');
      }
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBackfilling(false);
    }
  };

  const busy = checking || publishing || unpublishing;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle={t('reportCardPublish.subtitle')}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.description}>
          {t('reportCardPublish.description')} {t('reportCardUnpublish.canUnpublishLater')}
        </Text>

        <Text style={styles.label}>{t('reportCardPublish.term')}</Text>
        {termListError && (
          <View style={styles.noticeRow}>
            <Text style={styles.noticeText}>{termListError}</Text>
            <Pressable onPress={reloadTermList} accessibilityRole="button">
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}
        {terms === null && !termsError && <ActivityIndicator style={styles.termsLoading} color={colors.primary} />}
        {termsError && (
          <>
            <ErrorNotice message={termsError} />
            <Pressable onPress={retryTerms} style={styles.retry}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        )}
        {terms !== null && terms.length === 0 && (
          <Text style={styles.hint}>{t('reportCardPublish.noTerms')}</Text>
        )}
        {terms !== null && choices.length > 0 && (
          <>
            <Text style={styles.hint}>{t('reportCardPublish.pickTerm')}</Text>
            <View style={styles.chips}>
              {choices.map((choice) => {
                // A listed term no assessment here uses would publish empty report cards.
                const usable = choice.hasAssessments;
                const selected = term === choice.term;
                return (
                  <Pressable
                    key={choice.term}
                    style={[styles.chip, selected && styles.chipSelected, !usable && styles.disabled]}
                    onPress={() => pickTerm(choice.term)}
                    disabled={busy || !usable}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: busy || !usable }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {choice.listed ? choice.listed.name : choice.term}
                      {choice.published ? ' ✓' : ''}
                      {!usable ? ` ${t('academicTerms.picker.noAssessments')}` : ''}
                      {termListConfigured && !choice.listed ? ` ${t('academicTerms.picker.notInTermList')}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {error && <ErrorNotice message={error} />}
        {result && (
          <Text style={styles.success}>
            {t('reportCardPublish.published', { term: result.term, name: result.publishedByEmployeeName })}
          </Text>
        )}

        <Pressable
          style={[styles.publishButton, (!term || busy) && styles.disabled]}
          onPress={handlePublish}
          disabled={!term || busy}
        >
          {checking || publishing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.publishButtonText}>
              {term ? t('reportCardPublish.publishButton', { term }) : t('reportCardPublish.pickTermButton')}
            </Text>
          )}
        </Pressable>

        {canOfferUnpublish && !isAdmin && <Text style={styles.hint}>{t('reportCardUnpublish.adminOnly')}</Text>}
        {canOfferUnpublish && isAdmin && !unpublishOpen && (
          <Pressable
            style={[styles.unpublishButton, busy && styles.disabled]}
            onPress={() => setUnpublishOpen(true)}
            disabled={busy}
            accessibilityRole="button"
          >
            <Text style={styles.unpublishButtonText}>{t('reportCardUnpublish.button')}</Text>
          </Pressable>
        )}
        {canOfferUnpublish && isAdmin && unpublishOpen && (
          <View style={styles.unpublishPanel}>
            <Text style={styles.label}>{t('reportCardUnpublish.reasonLabel')}</Text>
            <TextInput
              style={[styles.input, styles.reasonInput]}
              value={unpublishReason}
              onChangeText={setUnpublishReason}
              placeholder={t('reportCardUnpublish.reasonPlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={MAX_UNPUBLISH_REASON_LENGTH}
              multiline
              editable={!unpublishing}
              accessibilityLabel={t('reportCardUnpublish.reasonLabel')}
            />
            <Text style={styles.counter}>{t('reportCardUnpublish.counter', { count: unpublishReason.length })}</Text>
            {reasonError && <Text style={styles.warning}>{t(reasonError)}</Text>}
            <View style={styles.unpublishButtons}>
              <Pressable style={styles.cancelButton} onPress={closeUnpublish} disabled={unpublishing}>
                <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmUnpublishButton, unpublishing && styles.disabled]}
                onPress={handleUnpublish}
                disabled={unpublishing}
              >
                {unpublishing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.confirmUnpublishText}>{t('reportCardUnpublish.confirm')}</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>{t('reportCardPublish.untermedTitle')}</Text>
        <Text style={styles.hint}>{t('reportCardPublish.untermedHint')}</Text>
        {termListConfigured ? (
          // With a term list the server only accepts listed terms, so they're picked, not typed.
          <View style={styles.chips}>
            {listedTerms.map((listed) => {
              const selected = !!backfillTerm && termKey(backfillTerm) === termKey(listed.name);
              return (
                <Pressable
                  key={listed.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setBackfillTerm(listed.name)}
                  disabled={backfilling}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{listed.name}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={backfillTerm}
            onChangeText={setBackfillTerm}
            placeholder={t('reportCardPublish.termPlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
        )}
        {backfillTargetPublished ? (
          <Text style={styles.warning}>{t('reportCardPublish.termLocked', { term: backfillTarget })}</Text>
        ) : backfillMatch && backfillMatch !== backfillTerm.trim() ? (
          <Text style={styles.hint}>{t('reportCardPublish.savedAs', { term: backfillMatch })}</Text>
        ) : null}
        <Pressable
          style={[styles.backfillButton, (!backfillTarget || backfillTargetPublished || backfilling) && styles.disabled]}
          onPress={handleBackfill}
          disabled={!backfillTarget || backfillTargetPublished || backfilling}
        >
          {backfilling ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.backfillButtonText}>{t('reportCardPublish.fixButton')}</Text>
          )}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  description: { fontSize: 13.5, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.lg },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  hint: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  warning: { fontSize: 12.5, color: colors.warning, lineHeight: 18, marginBottom: spacing.sm },
  termsLoading: { alignSelf: 'flex-start', marginBottom: spacing.lg },
  retry: { alignSelf: 'flex-start', paddingVertical: spacing.sm, marginBottom: spacing.sm },
  retryText: { color: colors.primary, fontWeight: '700' },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  noticeText: { flex: 1, fontSize: 12, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  backfillButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  backfillButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13.5 },
  success: { color: colors.success, marginBottom: spacing.md, fontWeight: '600' },
  publishButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  disabled: { opacity: 0.5 },
  publishButtonText: { color: colors.white, fontWeight: '700' },
  unpublishButton: {
    borderWidth: 1.5,
    borderColor: colors.error,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: colors.surface,
  },
  unpublishButtonText: { color: colors.error, fontWeight: '700' },
  unpublishPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    ...softShadow,
  },
  reasonInput: { minHeight: 80, textAlignVertical: 'top' },
  counter: { fontSize: 11.5, color: colors.textMuted, alignSelf: 'flex-end', marginBottom: spacing.sm },
  unpublishButtons: { flexDirection: 'row', gap: spacing.sm },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.textSecondary, fontWeight: '700' },
  confirmUnpublishButton: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.error,
    alignItems: 'center',
  },
  confirmUnpublishText: { color: colors.white, fontWeight: '700' },
});
