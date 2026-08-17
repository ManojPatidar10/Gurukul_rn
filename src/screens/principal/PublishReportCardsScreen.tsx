import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { backfillSectionTerm, listSectionTerms } from '../../api/assessments';
import { publishReportCards } from '../../api/reportCards';
import type { ReportCardPublication, TermSummary } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PublishReportCards'>;

export function PublishReportCardsScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const classSection = route.params.classSection;
  const [term, setTerm] = useState('Term 1');
  const [existingTerms, setExistingTerms] = useState<TermSummary[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportCardPublication | null>(null);

  const loadTerms = () => {
    listSectionTerms(schoolId, classSection.id)
      .then(setExistingTerms)
      .catch(() => {});
  };

  useEffect(loadTerms, [schoolId, classSection.id]);

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    setResult(null);
    try {
      const publication = await publishReportCards(schoolId, classSection.id, term.trim());
      setResult(publication);
      loadTerms();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPublishing(false);
    }
  };

  const handleBackfill = async () => {
    setBackfilling(true);
    setError(null);
    try {
      const { assessmentsUpdated } = await backfillSectionTerm(schoolId, classSection.id, term.trim());
      if (assessmentsUpdated > 0) {
        showToast(`Tagged ${assessmentsUpdated} assessment(s) that had no term with "${term.trim()}".`, 'success');
        loadTerms();
      } else {
        showToast('Every assessment in this section already has a term set.', 'info');
      }
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Publish report cards"
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.description}>
          Publishing makes this term&apos;s report card visible to every student in this section
          and locks further marks entry for any assessment in this term. This can be re-run later
          if marks need correcting - publishing again just refreshes the timestamp.
        </Text>

        <Text style={styles.label}>Term</Text>
        <TextInput
          style={styles.input}
          value={term}
          onChangeText={setTerm}
          placeholder="e.g. Term 1"
          placeholderTextColor={colors.textMuted}
        />

        {existingTerms.length > 0 && (
          <>
            <Text style={styles.hint}>Terms already used by this section&apos;s assessments:</Text>
            <View style={styles.chips}>
              {existingTerms.map((t) => (
                <Pressable
                  key={t.term}
                  style={[styles.chip, term === t.term && styles.chipSelected]}
                  onPress={() => setTerm(t.term)}
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

        <Text style={styles.hint}>
          If a student&apos;s marks don&apos;t show up after publishing, it&apos;s usually because
          the assessment was created without a term. Tag every un-termed assessment in this section
          with the term above:
        </Text>
        <Pressable
          style={[styles.backfillButton, (!term.trim() || backfilling) && styles.disabled]}
          onPress={handleBackfill}
          disabled={!term.trim() || backfilling}
        >
          {backfilling ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <Text style={styles.backfillButtonText}>Fix assessments missing a term</Text>
          )}
        </Pressable>

        {error && <Text style={styles.error}>{error}</Text>}
        {result && (
          <Text style={styles.success}>
            Published &quot;{result.term}&quot; for this section — by {result.publishedByEmployeeName}.
          </Text>
        )}

        <Pressable
          style={[styles.publishButton, (!term.trim() || publishing) && styles.disabled]}
          onPress={handlePublish}
          disabled={!term.trim() || publishing}
        >
          {publishing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.publishButtonText}>Publish report cards</Text>
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
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  hint: { fontSize: 12.5, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
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
    marginBottom: spacing.lg,
  },
  backfillButtonText: { color: colors.textPrimary, fontWeight: '700', fontSize: 13.5 },
  error: { color: colors.error, marginBottom: spacing.md },
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
