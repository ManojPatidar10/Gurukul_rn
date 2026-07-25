import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { generateAssessments } from '../../api/feeStructures';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructureDetail'>;

export function FeeStructureDetailScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const feeStructure = route.params.feeStructure;
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);

  const total = feeStructure.lines.reduce((sum, line) => sum + line.amount, 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setGeneratedCount(null);
    try {
      const assessments = await generateAssessments(schoolId, feeStructure.id);
      setGeneratedCount(assessments.length);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={`${feeStructure.className} - ${feeStructure.section}`}
        subtitle={feeStructure.academicYear}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.label}>Fee lines</Text>
        {feeStructure.lines.map((line) => (
          <View key={line.id} style={styles.lineRow}>
            <Text style={styles.lineName}>
              {line.feeCategoryName} ({line.feeCategoryCode})
            </Text>
            <Text style={styles.lineAmount}>₹{line.amount.toLocaleString('en-IN')}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total per student</Text>
          <Text style={styles.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {generatedCount !== null && (
          <Text style={styles.success}>
            Generated {generatedCount} assessment{generatedCount === 1 ? '' : 's'} for active students in this class-section.
          </Text>
        )}

        <Pressable style={styles.generateButton} onPress={handleGenerate} disabled={generating}>
          <Text style={styles.generateText}>
            {generating ? 'Generating…' : 'Generate assessments for this class'}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: spacing.sm },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  lineName: { fontSize: 14, color: colors.textPrimary },
  lineAmount: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  totalAmount: { fontSize: 15, fontWeight: '700', color: colors.accent },
  error: { color: colors.error, marginBottom: spacing.md },
  success: { color: colors.success, marginBottom: spacing.md },
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  generateText: { color: colors.white, fontWeight: '700' },
});
