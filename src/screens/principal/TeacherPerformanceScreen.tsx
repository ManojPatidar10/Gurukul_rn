import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { submitEmployeeFeedback } from '../../api/employeeFeedback';
import { getEmployeePerformance } from '../../api/performance';
import type { EmployeePerformanceSummary, FeedbackCategory } from '../../api/types';
import DateField from '../../components/DateField';
import Dropdown from '../../components/Dropdown';
import LabeledInput from '../../components/LabeledInput';
import { PerformanceChart, type ChartType } from '../../components/PerformanceChart';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'TeacherPerformance'>;

const accent = accents.employees;

function todayString(): string {
  const now = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function TeacherPerformanceScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const employee = route.params.employee;
  const { showToast } = useToast();

  const [summary, setSummary] = useState<EmployeePerformanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [rating, setRating] = useState('');
  const [category, setCategory] = useState<FeedbackCategory>('TEACHING_QUALITY');
  const [comment, setComment] = useState('');
  const [feedbackDate, setFeedbackDate] = useState(todayString());

  const [resultChartType, setResultChartType] = useState<ChartType>('bar');
  const [feedbackChartType, setFeedbackChartType] = useState<ChartType>('line');
  const [categoryChartType, setCategoryChartType] = useState<ChartType>('pie');

  const CATEGORY_OPTIONS = [
    { label: t('performance.feedbackCategories.TEACHING_QUALITY'), value: 'TEACHING_QUALITY' },
    { label: t('performance.feedbackCategories.DISCIPLINE'), value: 'DISCIPLINE' },
    { label: t('performance.feedbackCategories.PUNCTUALITY'), value: 'PUNCTUALITY' },
    { label: t('performance.feedbackCategories.PARENT_FEEDBACK'), value: 'PARENT_FEEDBACK' },
    { label: t('performance.feedbackCategories.PEER_REVIEW'), value: 'PEER_REVIEW' },
    { label: t('performance.feedbackCategories.OTHER'), value: 'OTHER' },
  ];

  const load = useCallback(() => {
    setLoading(true);
    getEmployeePerformance(schoolId, employee.id)
      .then(setSummary)
      .catch((e) => showToast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  }, [schoolId, employee.id, showToast]);

  useEffect(load, [load]);

  const resetForm = () => {
    setRating('');
    setCategory('TEACHING_QUALITY');
    setComment('');
    setFeedbackDate(todayString());
  };

  const handleSubmitFeedback = async () => {
    const ratingValue = Number(rating);
    if (!rating.trim() || Number.isNaN(ratingValue) || ratingValue < 0 || ratingValue > 5) {
      showToast(t('performance.errors.rating'), 'error');
      return;
    }
    if (!feedbackDate) {
      showToast(t('performance.errors.feedbackDate'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      await submitEmployeeFeedback(schoolId, employee.id, {
        rating: ratingValue,
        category,
        comment: comment.trim() || undefined,
        feedbackDate,
        submittedBy: 'Principal',
      });
      resetForm();
      setShowEntryForm(false);
      load();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !summary) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={employee.name} subtitle={t('performance.title')} onBack={() => navigation.goBack()} />
        <ActivityIndicator style={styles.loadingSpinner} color={accent.base} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title={employee.name} subtitle={t('performance.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {showEntryForm ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t('performance.addFeedback')}</Text>
            <LabeledInput
              label={t('performance.rating')}
              required
              value={rating}
              onChangeText={setRating}
              keyboardType="numeric"
              placeholder="0-5"
            />
            <Dropdown
              label={t('performance.feedbackCategory')}
              required
              value={category}
              options={CATEGORY_OPTIONS}
              onSelect={(v) => setCategory(v as FeedbackCategory)}
            />
            <LabeledInput label={t('performance.comment')} value={comment} onChangeText={setComment} />
            <DateField label={t('performance.feedbackDate')} required value={feedbackDate} onChange={setFeedbackDate} maximumDate={new Date()} />

            <Pressable style={[styles.submitButton, submitting && styles.submitDisabled]} onPress={handleSubmitFeedback} disabled={submitting}>
              <Text style={styles.submitText}>{submitting ? t('common.saving') : t('performance.saveFeedback')}</Text>
            </Pressable>
            <Pressable onPress={() => { setShowEntryForm(false); resetForm(); }}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addButton} onPress={() => setShowEntryForm(true)}>
            <Text style={styles.addButtonText}>{t('performance.addFeedback')}</Text>
          </Pressable>
        )}

        {summary && (
          <>
            <View style={styles.overallCard}>
              <Text style={styles.overallLabel}>{t('performance.resultPerformance')}</Text>
              <Text style={styles.overallValue}>{summary.overallResultPercentage}%</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('performance.byClassSection')}</Text>
              {summary.byClassSection.map((s) => (
                <Text key={s.sectionId} style={styles.breakdownLine}>
                  {s.className} - {s.section}: {s.averagePercentage}%
                </Text>
              ))}
              <PerformanceChart
                type={resultChartType}
                onTypeChange={setResultChartType}
                valueSuffix="%"
                data={summary.byClassSection.map((s) => ({ label: `${s.className}-${s.section}`, value: s.averagePercentage }))}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t('performance.feedback')}</Text>
              <Text style={styles.statLine}>{t('performance.averageRating', { value: summary.averageFeedbackRating })}</Text>

              <Text style={styles.subCardTitle}>{t('performance.feedbackTrend')}</Text>
              <PerformanceChart
                type={feedbackChartType}
                onTypeChange={setFeedbackChartType}
                data={[...summary.feedbackHistory].reverse().map((f) => ({ label: f.feedbackDate.slice(5), value: f.rating }))}
              />

              <Text style={styles.subCardTitle}>{t('performance.feedbackByCategory')}</Text>
              <PerformanceChart
                type={categoryChartType}
                onTypeChange={setCategoryChartType}
                availableTypes={['bar', 'pie']}
                data={summary.feedbackByCategory.map((c) => ({
                  label: t(`performance.feedbackCategories.${c.category}`),
                  value: c.averageRating,
                }))}
              />
            </View>
          </>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingSpinner: { marginTop: 60 },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  subCardTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginTop: spacing.md, marginBottom: spacing.xs },
  statLine: { fontSize: 14, color: colors.textPrimary, marginBottom: spacing.xs, fontWeight: '600' },
  breakdownLine: { fontSize: 12, color: colors.textMuted, marginBottom: 2 },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
  cancelText: { color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  overallCard: {
    backgroundColor: accent.light,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  overallLabel: { fontSize: 13, fontWeight: '700', color: accent.base, textTransform: 'uppercase', letterSpacing: 0.4 },
  overallValue: { fontSize: 36, fontWeight: '800', color: accent.base, marginTop: spacing.xs },
});
