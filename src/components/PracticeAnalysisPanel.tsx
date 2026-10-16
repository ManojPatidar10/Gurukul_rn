import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getPracticeAnalysis, getPracticeStudyPlan } from '../api/practice';
import { getErrorMessage } from '../api/errorMessage';
import type { ChapterBreakdown, PracticeAnalysis, PracticeStudyPlan } from '../api/types';
import { useSchoolId } from '../context/SchoolContext';
import { colors, radius, spacing } from '../theme/colors';
import { chapterBarColor, chapterTone } from '../utils/practiceAnalysis';
import { ErrorNotice } from './ErrorNotice';

type Props = {
  sessionId: string;
};

/**
 * What a finished practice session means, shown under the score.
 *
 * <p>The score alone is the number the student just watched tick up. This is the part that says
 * which chapters it came from and what to do next, which is the only reason to show anything
 * after a quiz at all.
 *
 * <p>The two halves load together but fail apart: the roadmap is computed from the student's own
 * answers and always arrives, while the written notes need the AI assistant. A missing paragraph
 * must not take the chapter breakdown down with it.
 */
export function PracticeAnalysisPanel({ sessionId }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [analysis, setAnalysis] = useState<PracticeAnalysis | null>(null);
  const [plan, setPlan] = useState<PracticeStudyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getPracticeAnalysis(schoolId, sessionId),
      // The plan is the softer half: a failure here still leaves the breakdown worth showing.
      getPracticeStudyPlan(schoolId, sessionId).catch(() => null),
    ])
      .then(([loadedAnalysis, loadedPlan]) => {
        if (cancelled) return;
        setAnalysis(loadedAnalysis);
        setPlan(loadedPlan);
        setError(null);
      })
      .catch((e) => !cancelled && setError(getErrorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [schoolId, sessionId]);

  if (loading) {
    return <ActivityIndicator style={styles.loading} />;
  }
  if (error) {
    return <ErrorNotice message={error} />;
  }
  if (!analysis || analysis.chapters.length === 0) {
    // Nothing was tagged to a chapter, so there is no breakdown to give. The score above already
    // said how it went; inventing a panel here would add nothing.
    return null;
  }

  return (
    <View style={styles.root}>
      <Text style={styles.sectionTitle}>{t('games.practice.analysis.title')}</Text>
      <Text style={styles.sectionHint}>{t('games.practice.analysis.hint')}</Text>

      {analysis.chapters.map((chapter) => (
        <ChapterRow key={chapter.chapterId} chapter={chapter} analysis={analysis} />
      ))}

      {/* The verdict in words. Without this the red bars would be the only thing marking a weak
          chapter, which is colour carrying meaning on its own - unreadable to a colourblind
          student and gone entirely in a screenshot printed in grey. */}
      <Verdict
        label={t('games.practice.analysis.strengths')}
        chapters={analysis.strengths}
        dotColor={chapterBarColor('strength')}
      />
      <Verdict
        label={t('games.practice.analysis.focusAreas')}
        chapters={analysis.focusAreas}
        dotColor={chapterBarColor('focus')}
      />

      {analysis.untaggedAnswered > 0 && (
        // Said out loud so the chapter rows visibly not summing to the total is explained rather
        // than looking like questions went missing.
        <Text style={styles.footnote}>
          {t('games.practice.analysis.untagged', { count: analysis.untaggedAnswered })}
        </Text>
      )}

      {plan && plan.roadmap.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('games.practice.analysis.roadmapTitle')}</Text>
          <Text style={styles.sectionHint}>{t('games.practice.analysis.roadmapHint')}</Text>
          {plan.roadmap.map((step) => (
            <View key={step.chapterId} style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{step.order}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>
                  {step.chapterLabel}
                  {step.prerequisite && (
                    <Text style={styles.stepTag}> · {t('games.practice.analysis.groundwork')}</Text>
                  )}
                </Text>
                <Text style={styles.stepReason}>{step.reason}</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {plan && plan.studyNotes.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('games.practice.analysis.notesTitle')}</Text>
          {plan.studyNotes.map((note) => (
            <View key={note.chapterId} style={styles.note}>
              <Text style={styles.noteTitle}>{note.chapterLabel}</Text>
              <Text style={styles.noteBody}>{note.guidance}</Text>
              {note.suggestedActions.map((action) => (
                <Text key={action} style={styles.noteAction}>
                  • {action}
                </Text>
              ))}
            </View>
          ))}
        </>
      )}
      {plan?.notesUnavailableReason && plan.roadmap.length > 0 && (
        <Text style={styles.footnote}>{plan.notesUnavailableReason}</Text>
      )}
    </View>
  );
}

/** One verdict line - "Strengths: Sound, Light" - or nothing at all when there is no verdict. */
function Verdict({
  label,
  chapters,
  dotColor,
}: {
  label: string;
  chapters: ChapterBreakdown[];
  dotColor: string;
}) {
  if (chapters.length === 0) {
    // A session too short or too even to call. Printing "Strengths: -" would dress an absent
    // verdict up as a finding.
    return null;
  }
  return (
    <View style={styles.verdict}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.verdictLabel}>{label}</Text>
      <Text style={styles.verdictChapters}>{chapters.map((c) => c.chapterLabel).join(', ')}</Text>
    </View>
  );
}

function ChapterRow({ chapter, analysis }: { chapter: ChapterBreakdown; analysis: PracticeAnalysis }) {
  const { t } = useTranslation();
  const barColor = chapterBarColor(chapterTone(chapter, analysis));

  return (
    <View style={styles.chapter}>
      <View style={styles.chapterHead}>
        <Text style={styles.chapterLabel} numberOfLines={1}>
          {chapter.chapterLabel}
        </Text>
        {/* Always the raw count beside the percentage: "1 of 2" is the honest version of 50%. */}
        <Text style={styles.chapterScore}>
          {t('games.practice.analysis.score', {
            correct: chapter.correct,
            answered: chapter.answered,
            percent: chapter.percentCorrect,
          })}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${chapter.percentCorrect}%`, backgroundColor: barColor }]} />
      </View>
      {chapter.lowConfidence && (
        <Text style={styles.lowConfidence}>{t('games.practice.analysis.tooFew')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: spacing.lg },
  loading: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.md,
    marginBottom: 2,
  },
  sectionHint: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.sm },
  verdict: { flexDirection: 'row', alignItems: 'baseline', marginTop: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6, transform: [{ translateY: -1 }] },
  verdictLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, marginRight: 4 },
  verdictChapters: { flex: 1, fontSize: 12, color: colors.textSecondary },
  chapter: { marginBottom: spacing.sm },
  chapterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chapterLabel: { flex: 1, fontSize: 13, color: colors.textPrimary, marginRight: spacing.sm },
  chapterScore: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  track: {
    height: 8,
    borderRadius: radius.sm,
    // Not surfaceMuted: against the page background it vanishes, and a 0% chapter then reads as a
    // missing bar rather than a bar at zero - the one score that most needs to be seen.
    backgroundColor: colors.border,
    overflow: 'hidden',
    marginTop: 4,
  },
  fill: { height: 8, borderRadius: radius.sm },
  lowConfidence: { fontSize: 11, color: colors.textMuted, marginTop: 3, fontStyle: 'italic' },
  footnote: { fontSize: 11, color: colors.textMuted, marginTop: spacing.xs, fontStyle: 'italic' },
  step: { flexDirection: 'row', marginBottom: spacing.sm, alignItems: 'flex-start' },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  stepNumberText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  stepTag: { fontSize: 11, fontWeight: '400', color: colors.textSecondary },
  stepReason: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  note: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  noteTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  noteBody: { fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  noteAction: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
