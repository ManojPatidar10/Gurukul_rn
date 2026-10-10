import { FontAwesome5 } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { reportQuizQuestion } from '../api/arena';
import { getErrorMessage } from '../api/errorMessage';
import type { QuizOption, QuizReviewItem } from '../api/types';
import { useSchoolId } from '../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../theme/colors';

const OPTIONS: { key: QuizOption; field: 'optionA' | 'optionB' | 'optionC' | 'optionD' }[] = [
  { key: 'A', field: 'optionA' },
  { key: 'B', field: 'optionB' },
  { key: 'C', field: 'optionC' },
  { key: 'D', field: 'optionD' },
];

const COMMENT_MAX = 300;

type ReportState =
  | { step: 'writing'; comment: string; error?: string }
  | { step: 'sending'; comment: string }
  | { step: 'done' };

/**
 * The end-of-game review for Arena and Practice: every question with the student's choice (marked
 * right or wrong), the correct option and the explanation. The answer key only arrives here, once
 * the game is over. Each card can report the answer as wrong to the question's author.
 */
export function QuizReviewList({ items }: { items: QuizReviewItem[] | null | undefined }) {
  const schoolId = useSchoolId();
  const [reports, setReports] = useState<Record<string, ReportState>>({});

  if (!items || items.length === 0) return null;

  const setReport = (questionId: string, state: ReportState | undefined) =>
    setReports((prev) => {
      const next = { ...prev };
      if (state) next[questionId] = state;
      else delete next[questionId];
      return next;
    });

  const sendReport = async (questionId: string, comment: string) => {
    setReport(questionId, { step: 'sending', comment });
    try {
      // alreadyReported means this student's earlier report is still open - thanked the same way.
      await reportQuizQuestion(schoolId, questionId, comment);
      setReport(questionId, { step: 'done' });
    } catch (e) {
      setReport(questionId, { step: 'writing', comment, error: getErrorMessage(e) });
    }
  };

  return (
    <View style={styles.list}>
      <Text style={styles.heading}>Review your answers</Text>
      {items.map((item, index) => {
        const report = reports[item.questionId];
        return (
          <View key={item.questionId} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.number}>Question {index + 1}</Text>
              <View style={[styles.verdict, item.correct ? styles.verdictCorrect : styles.verdictWrong]}>
                <FontAwesome5
                  name={item.correct ? 'check' : 'times'}
                  size={10}
                  color={item.correct ? colors.success : colors.error}
                />
                <Text style={[styles.verdictText, { color: item.correct ? colors.success : colors.error }]}>
                  {item.correct ? 'Right' : item.selectedOption ? 'Wrong' : 'Not answered'}
                </Text>
              </View>
            </View>
            <Text style={styles.questionText}>{item.questionText}</Text>

            {OPTIONS.map(({ key, field }) => {
              const isCorrect = item.correctOption === key;
              const isChosen = item.selectedOption === key;
              return (
                <View
                  key={key}
                  style={[styles.option, isCorrect && styles.optionCorrect, isChosen && !isCorrect && styles.optionWrong]}
                >
                  <Text style={styles.optionKey}>{key}</Text>
                  <Text style={styles.optionText}>{item[field]}</Text>
                  {(isCorrect || isChosen) && (
                    <Text style={[styles.optionTag, { color: isCorrect ? colors.success : colors.error }]}>
                      {isCorrect && isChosen ? 'Your answer ✓' : isCorrect ? 'Correct answer' : 'Your answer'}
                    </Text>
                  )}
                </View>
              );
            })}

            {!item.selectedOption && <Text style={styles.note}>You didn&apos;t answer this one.</Text>}
            {!!item.explanation?.trim() && (
              <Text style={styles.explanation}>
                <Text style={styles.explanationLabel}>Why: </Text>
                {item.explanation.trim()}
              </Text>
            )}

            {report?.step === 'done' ? (
              <Text style={styles.reported}>Reported. Thanks!</Text>
            ) : report ? (
              <View style={styles.reportBox}>
                <TextInput
                  style={styles.reportInput}
                  value={report.comment}
                  onChangeText={(comment) => setReport(item.questionId, { step: 'writing', comment })}
                  placeholder="What looks wrong? (optional)"
                  placeholderTextColor={colors.textMuted}
                  maxLength={COMMENT_MAX}
                  multiline
                  editable={report.step === 'writing'}
                />
                {report.step === 'writing' && report.error && <Text style={styles.reportError}>{report.error}</Text>}
                <View style={styles.reportActions}>
                  <Pressable
                    onPress={() => setReport(item.questionId, undefined)}
                    disabled={report.step === 'sending'}
                    hitSlop={8}
                  >
                    <Text style={styles.reportCancel}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={styles.reportSend}
                    onPress={() => sendReport(item.questionId, report.comment)}
                    disabled={report.step === 'sending'}
                  >
                    {report.step === 'sending' ? (
                      <ActivityIndicator color={colors.white} size="small" />
                    ) : (
                      <Text style={styles.reportSendText}>Send report</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setReport(item.questionId, { step: 'writing', comment: '' })}
                accessibilityRole="button"
                hitSlop={8}
              >
                <Text style={styles.reportLink}>Report a wrong answer</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: spacing.lg },
  heading: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  number: { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  verdict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  verdictCorrect: { backgroundColor: '#E4F5E8' },
  verdictWrong: { backgroundColor: '#FBE7E7' },
  verdictText: { fontSize: 11, fontWeight: '700' },
  questionText: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm, lineHeight: 21 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  optionCorrect: { borderColor: colors.success, backgroundColor: '#E4F5E8' },
  optionWrong: { borderColor: colors.error, backgroundColor: '#FBE7E7' },
  optionKey: { fontWeight: '800', fontSize: 12, color: colors.primary, width: 14 },
  optionText: { flex: 1, fontSize: 13.5, color: colors.textPrimary },
  optionTag: { fontSize: 11, fontWeight: '700' },
  note: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  explanation: { fontSize: 13, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 19 },
  explanationLabel: { fontWeight: '700', color: colors.textPrimary },
  reportLink: { fontSize: 12.5, fontWeight: '600', color: colors.primary, marginTop: spacing.sm },
  reported: { fontSize: 12.5, fontWeight: '600', color: colors.success, marginTop: spacing.sm },
  reportBox: { marginTop: spacing.sm },
  reportInput: {
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13.5,
    color: colors.textPrimary,
    minHeight: 40,
  },
  reportError: { fontSize: 12, color: colors.error, marginTop: 4 },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  reportCancel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  reportSend: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  reportSendText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
