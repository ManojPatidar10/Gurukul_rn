import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { backfillSectionTerm, listSectionTerms } from '../../api/assessments';
import { getPublishCheck, publishReportCards } from '../../api/reportCards';
import type { ReportCardPublication, TermSummary } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { canonicalTerm, findExistingTerm } from '../../utils/assessmentTerms';
import { canPublish, nothingToPublishMessage, publishConfirmation } from '../../utils/reportCardPublish';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PublishReportCards'>;

export function PublishReportCardsScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const classSection = route.params.classSection;
  // No pre-filled term: publishing notifies every family and can't be undone yet, so the term is
  // always an explicit pick from the ones this section's assessments actually use.
  const [term, setTerm] = useState<string | null>(null);
  const [terms, setTerms] = useState<TermSummary[] | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [backfillTerm, setBackfillTerm] = useState('');
  const [checking, setChecking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportCardPublication | null>(null);

  const loadTerms = useCallback(() => {
    listSectionTerms(schoolId, classSection.id)
      .then((loaded) => {
        setTermsError(null);
        setTerms(loaded);
        setTerm((current) => (current && loaded.some((t) => t.term === current) ? current : null));
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
    }
  };

  // Publishing is never one tap: check what it would do first, and make the admin confirm the
  // counts and warnings (missing marks, un-termed assessments, already published).
  const handlePublish = async () => {
    if (!term) return;
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const check = await getPublishCheck(schoolId, classSection.id, term);
      if (!canPublish(check)) {
        Alert.alert('Nothing to publish', nothingToPublishMessage(check));
        return;
      }
      const { title, message } = publishConfirmation(check);
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Publish', style: 'destructive', onPress: () => publish(check.term) },
      ]);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setChecking(false);
    }
  };

  const termNames = (terms ?? []).map((t) => t.term);
  const backfillTarget = canonicalTerm(backfillTerm, termNames);
  const backfillMatch = findExistingTerm(backfillTerm, termNames);
  const backfillTargetPublished = (terms ?? []).some((t) => t.published && t.term === backfillTarget);

  const handleBackfill = async () => {
    if (!backfillTarget) return;
    setBackfilling(true);
    try {
      const { assessmentsUpdated } = await backfillSectionTerm(schoolId, classSection.id, backfillTarget);
      if (assessmentsUpdated > 0) {
        showToast(`Tagged ${assessmentsUpdated} assessment(s) that had no term with "${backfillTarget}".`, 'success');
        setBackfillTerm('');
        loadTerms();
      } else {
        showToast('Every assessment in this section already has a term set.', 'info');
      }
    } catch (e) {
      showToast(getErrorMessage(e), 'error');
    } finally {
      setBackfilling(false);
    }
  };

  const busy = checking || publishing;

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Publish report cards"
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.description}>
          Publishing shows this term&apos;s report card to every student and parent in this section and
          notifies them. It also locks marks entry for every assessment in the term. There&apos;s no undo
          yet, so check the class marks grid first.
        </Text>

        <Text style={styles.label}>Term</Text>
        {terms === null && !termsError && <ActivityIndicator style={styles.termsLoading} color={colors.primary} />}
        {termsError && (
          <>
            <ErrorNotice message={termsError} />
            <Pressable onPress={retryTerms} style={styles.retry}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </>
        )}
        {terms !== null && terms.length === 0 && (
          <Text style={styles.hint}>
            No assessment in this section has a term yet, so there&apos;s nothing to publish. Give each
            assessment a term (edit it, or use the fix below), then come back.
          </Text>
        )}
        {terms !== null && terms.length > 0 && (
          <>
            <Text style={styles.hint}>Pick the term to publish. ✓ means it&apos;s already published.</Text>
            <View style={styles.chips}>
              {terms.map((t) => (
                <Pressable
                  key={t.term}
                  style={[styles.chip, term === t.term && styles.chipSelected]}
                  onPress={() => setTerm(t.term)}
                  disabled={busy}
                >
                  <Text style={[styles.chipText, term === t.term && styles.chipTextSelected]}>
                    {t.term}
                    {t.published ? ' ✓' : ''}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {error && <ErrorNotice message={error} />}
        {result && (
          <Text style={styles.success}>
            Published &quot;{result.term}&quot; for this section — by {result.publishedByEmployeeName}. Marks
            for this term are now locked.
          </Text>
        )}

        <Pressable
          style={[styles.publishButton, (!term || busy) && styles.disabled]}
          onPress={handlePublish}
          disabled={!term || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.publishButtonText}>
              {term ? `Publish "${term}" report cards` : 'Pick a term to publish'}
            </Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>Assessments with no term</Text>
        <Text style={styles.hint}>
          An assessment saved without a term never appears on any report card. Tag every assessment in
          this section that has no term with:
        </Text>
        <TextInput
          style={styles.input}
          value={backfillTerm}
          onChangeText={setBackfillTerm}
          placeholder="Term, e.g. Term 1"
          placeholderTextColor={colors.textMuted}
        />
        {backfillTargetPublished ? (
          <Text style={styles.warning}>
            Report cards for &quot;{backfillTarget}&quot; are already published, so assessments can&apos;t be
            added to it.
          </Text>
        ) : backfillMatch && backfillMatch !== backfillTerm.trim() ? (
          <Text style={styles.hint}>Will be saved as &quot;{backfillMatch}&quot;, the spelling this section already uses.</Text>
        ) : null}
        <Pressable
          style={[styles.backfillButton, (!backfillTarget || backfillTargetPublished || backfilling) && styles.disabled]}
          onPress={handleBackfill}
          disabled={!backfillTarget || backfillTargetPublished || backfilling}
        >
          {backfilling ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.backfillButtonText}>Fix assessments missing a term</Text>
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
});
