import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createInfraExpenseRequest } from '../../api/infraExpenseRequests';
import InfraCategoryPicker from '../../components/InfraCategoryPicker';
import LabeledInput from '../../components/LabeledInput';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'InfraExpenseForm'>;

export function InfraExpenseFormScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !!categoryId && !!description && Number(estimatedAmount) > 0;

  const handleSubmit = async () => {
    if (!categoryId) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createInfraExpenseRequest(schoolId, {
        categoryId,
        description,
        estimatedAmount: Number(estimatedAmount),
      });
      navigation.replace('InfraExpenseDetail', { request: created });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="New expense request" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Text style={styles.label}>Category</Text>
        <InfraCategoryPicker
          schoolId={schoolId}
          selectedId={categoryId}
          onSelect={(cat) => {
            setCategoryId(cat.id);
            setCategoryLabel(`${cat.name} (${cat.code})`);
          }}
        />
        {categoryLabel ? <Text style={styles.selectedHint}>Selected: {categoryLabel}</Text> : null}

        <LabeledInput label="Description" value={description} onChangeText={setDescription} />
        <LabeledInput
          label="Estimated amount"
          value={estimatedAmount}
          onChangeText={setEstimatedAmount}
          keyboardType="numeric"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
        >
          <Text style={styles.submitText}>{submitting ? 'Creating…' : 'Create request'}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  selectedHint: { fontSize: 12, color: colors.textMuted, marginTop: spacing.sm, marginBottom: spacing.sm },
  error: { color: colors.error, marginTop: spacing.md },
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
