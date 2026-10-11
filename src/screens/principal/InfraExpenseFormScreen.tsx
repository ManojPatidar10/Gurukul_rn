import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { createInfraExpenseRequest } from '../../api/infraExpenseRequests';
import InfraCategoryPicker from '../../components/InfraCategoryPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { getErrorMessage } from '../../api/errorMessage';
import { ErrorNotice } from '../../components/ErrorNotice';
import { DESCRIPTION_COUNTER_FROM, DESCRIPTION_MAX_LENGTH } from '../../utils/expenses';
import { amountProblemKey, parseInrAmount } from '../../utils/money';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraExpenseForm'>;

export function InfraExpenseFormScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  // Errors for untouched fields show once Create has been tapped.
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = parseInrAmount(estimatedAmount);
  const amountError = !amount.ok && (attempted || amount.problem !== 'empty') ? t(amountProblemKey(amount.problem)) : null;
  const categoryError = attempted && !categoryId ? t('infraExpenses.form.errors.category') : null;
  const descriptionError = attempted && !description.trim() ? t('infraExpenses.form.errors.description') : null;

  const handleSubmit = async () => {
    setAttempted(true);
    if (!categoryId || !description.trim() || !amount.ok) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createInfraExpenseRequest(schoolId, {
        categoryId,
        description: description.trim(),
        estimatedAmount: amount.value,
      });
      navigation.replace('InfraExpenseDetail', { requestId: created.id, request: created });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('infraExpenses.form.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>{t('infraExpenses.form.category')}</Text>
        <InfraCategoryPicker schoolId={schoolId} selectedId={categoryId} onSelect={(cat) => setCategoryId(cat.id)} />
        {categoryError && <Text style={styles.fieldError}>{categoryError}</Text>}
        <View style={styles.gap} />

        <LabeledInput
          label={t('infraExpenses.form.description')}
          required
          value={description}
          onChangeText={setDescription}
          placeholder={t('infraExpenses.form.descriptionPlaceholder')}
          maxLength={DESCRIPTION_MAX_LENGTH}
          multiline
        />
        {description.length >= DESCRIPTION_COUNTER_FROM && (
          <Text style={styles.counter}>
            {t('infraExpenses.form.descriptionCounter', { count: description.length, max: DESCRIPTION_MAX_LENGTH })}
          </Text>
        )}
        {descriptionError && <Text style={styles.fieldError}>{descriptionError}</Text>}

        <LabeledInput
          label={t('infraExpenses.form.amount')}
          required
          value={estimatedAmount}
          onChangeText={setEstimatedAmount}
          keyboardType="decimal-pad"
        />
        {amountError && <Text style={styles.fieldError}>{amountError}</Text>}

        {error && <ErrorNotice message={error} />}

        <Pressable style={[styles.submit, submitting && styles.submitDisabled]} onPress={handleSubmit} disabled={submitting}>
          <Text style={styles.submitText}>{submitting ? t('infraExpenses.form.submitting') : t('infraExpenses.form.submit')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  gap: { height: spacing.md },
  counter: { fontSize: 12, color: colors.textMuted, textAlign: 'right', marginTop: -spacing.sm, marginBottom: spacing.sm },
  fieldError: { fontSize: 13, color: colors.error, marginTop: -spacing.xs, marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    ...softShadow,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontWeight: '700' },
});
