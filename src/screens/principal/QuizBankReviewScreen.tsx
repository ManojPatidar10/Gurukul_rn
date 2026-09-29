import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { bulkCreateQuizQuestions } from '../../api/arena';
import { ApiError } from '../../api/client';
import type { QuizQuestionType } from '../../api/types';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { OPTION_LETTERS, toBankDraft, toBankInput, validateBankDraft, type BankDraft } from '../../utils/quizBank';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'QuizBankReview'>;

const accent = accents.teacherTools;
const BANK_TYPES: QuizQuestionType[] = ['MCQ', 'NUMERIC', 'SHORT_WORD'];

/**
 * The mandatory review step between an AI draft and the question bank. Every selected question is
 * shown editable (text, options + correct option, or the typed answer), the teacher can drop any of
 * them, and saving needs an explicit "I've checked these" confirmation. The save is all-or-nothing
 * on the server, which re-validates every question.
 */
export function QuizBankReviewScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { showToast } = useToast();
  const { subjectId, subjectName, className, questions } = route.params;

  const [drafts, setDrafts] = useState<BankDraft[]>(
    () => questions.map(toBankDraft).filter((d): d is BankDraft => d !== null)
  );
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  const errors = useMemo(() => drafts.map(validateBankDraft), [drafts]);
  const hasErrors = errors.some((e) => e !== null);

  const update = (index: number, patch: Partial<BankDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };
  const updateOption = (index: number, optionIndex: number, value: string) => {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        const options = [...d.options] as BankDraft['options'];
        options[optionIndex] = value;
        return { ...d, options };
      })
    );
  };
  const remove = (index: number) => setDrafts((prev) => prev.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (drafts.length === 0) return showToast(t('teacherTools.bank.errors.noneSelected'), 'error');
    if (hasErrors) return showToast(t('teacherTools.bank.errors.fixFirst'), 'error');
    if (!confirmed) return showToast(t('teacherTools.bank.errors.confirm'), 'error');
    setSaving(true);
    try {
      const saved = await bulkCreateQuizQuestions(schoolId, {
        subjectId,
        className,
        questions: drafts.map(toBankInput),
      });
      showToast(t('teacherTools.bank.saved', { count: saved.length }), 'success');
      navigation.goBack();
    } catch (e) {
      showToast(e instanceof ApiError ? getErrorMessage(e) : getErrorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('teacherTools.bank.title')}
        subtitle={`${subjectName} · ${className}`}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.intro}>{t('teacherTools.bank.intro')}</Text>

        {drafts.map((d, index) => (
          <View key={d.number} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t('teacherTools.generator.questionLabel', { number: d.number })}</Text>
              <Pressable onPress={() => remove(index)} hitSlop={8}>
                <Text style={styles.remove}>{t('teacherTools.bank.remove')}</Text>
              </Pressable>
            </View>

            <View style={styles.chips}>
              {BANK_TYPES.map((type) => (
                <Pressable
                  key={type}
                  onPress={() => update(index, { questionType: type })}
                  style={[styles.chip, d.questionType === type && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, d.questionType === type && styles.chipTextSelected]}>
                    {t(`teacherTools.bank.types.${type}`)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <LabeledInput
              label={t('teacherTools.bank.questionText')}
              required
              value={d.questionText}
              onChangeText={(v) => update(index, { questionText: v })}
              multiline
            />

            {d.questionType === 'MCQ' ? (
              <>
                {OPTION_LETTERS.map((letter, optionIndex) => (
                  <LabeledInput
                    key={letter}
                    label={t('teacherTools.bank.option', { letter })}
                    required
                    value={d.options[optionIndex]}
                    onChangeText={(v) => updateOption(index, optionIndex, v)}
                  />
                ))}
                <Text style={styles.fieldLabel}>{t('teacherTools.bank.correctOption')}</Text>
                <View style={styles.chips}>
                  {OPTION_LETTERS.map((letter) => (
                    <Pressable
                      key={letter}
                      onPress={() => update(index, { correctOption: letter })}
                      style={[styles.chip, d.correctOption === letter && styles.chipSelected]}
                    >
                      <Text style={[styles.chipText, d.correctOption === letter && styles.chipTextSelected]}>{letter}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <LabeledInput
                label={t(d.questionType === 'NUMERIC' ? 'teacherTools.bank.numericAnswer' : 'teacherTools.bank.shortWordAnswer')}
                required
                value={d.answerText}
                onChangeText={(v) => update(index, { answerText: v })}
                keyboardType={d.questionType === 'NUMERIC' ? 'numbers-and-punctuation' : 'default'}
                autoCapitalize="none"
              />
            )}
            {d.questionType !== 'MCQ' && (
              <Text style={styles.hint}>{t(`teacherTools.bank.markingHint.${d.questionType}`)}</Text>
            )}

            {errors[index] && <Text style={styles.error}>{t(`teacherTools.bank.errors.${errors[index]}`)}</Text>}
          </View>
        ))}

        {drafts.length === 0 && <Text style={styles.hint}>{t('teacherTools.bank.errors.noneSelected')}</Text>}

        <Pressable
          style={styles.confirmRow}
          onPress={() => setConfirmed((c) => !c)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmed }}
        >
          <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
            {confirmed && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.confirmText}>{t('teacherTools.bank.confirm')}</Text>
        </Pressable>

        <Pressable
          style={[styles.saveButton, (saving || hasErrors || !confirmed || drafts.length === 0) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveButtonText}>{t('teacherTools.bank.save', { count: drafts.length })}</Text>
          )}
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  intro: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  cardTitle: { fontSize: 14, fontWeight: '800', color: accent.base },
  remove: { fontSize: 13, fontWeight: '600', color: colors.error },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: accent.base, borderColor: accent.base },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  chipTextSelected: { color: colors.white },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  error: { fontSize: 13, color: colors.error, marginTop: spacing.xs },
  confirmRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginVertical: spacing.md },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxChecked: { backgroundColor: accent.base, borderColor: accent.base },
  checkmark: { color: colors.white, fontWeight: '800', fontSize: 13 },
  confirmText: { flex: 1, fontSize: 13, color: colors.textPrimary },
  saveButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...softShadow,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
});
