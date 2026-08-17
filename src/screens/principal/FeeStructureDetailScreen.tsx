import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { generateAssessments } from '../../api/feeStructures';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructureDetail'>;

export function FeeStructureDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const feeStructure = route.params.feeStructure;
  const [generating, setGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState<number | null>(null);
  const { showToast } = useToast();

  const total = feeStructure.lines.reduce((sum, line) => sum + line.amount, 0);

  const handleGenerate = async () => {
    setGenerating(true);
    setGeneratedCount(null);
    try {
      const assessments = await generateAssessments(schoolId, feeStructure.id);
      setGeneratedCount(assessments.length);
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('fees.structureDetail.titleFormat', { className: feeStructure.className, section: feeStructure.section })}
        subtitle={feeStructure.academicYear}
        onBack={() => navigation.goBack()}
      />
      <ScreenContainer>
        <Text style={styles.label}>{t('fees.structureDetail.feeLines')}</Text>
        {feeStructure.lines.map((line) => (
          <View key={line.id} style={styles.lineRow}>
            <Text style={styles.lineName}>
              {t('fees.structureDetail.lineFormat', { name: line.feeCategoryName, code: line.feeCategoryCode })}
            </Text>
            <Text style={styles.lineAmount}>₹{line.amount.toLocaleString('en-IN')}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('fees.structureDetail.totalPerStudent')}</Text>
          <Text style={styles.totalAmount}>₹{total.toLocaleString('en-IN')}</Text>
        </View>

        {generatedCount !== null && (
          <Text style={styles.success}>
            {t('fees.structureDetail.generatedMessage', { count: generatedCount })}
          </Text>
        )}

        <Pressable style={styles.generateButton} onPress={handleGenerate} disabled={generating}>
          <Text style={styles.generateText}>
            {generating ? t('fees.structureDetail.generating') : t('fees.structureDetail.generateButton')}
          </Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const accent = accents.fees;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  label: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: spacing.sm },
  lineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  lineName: { fontSize: 14, color: colors.textPrimary },
  lineAmount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
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
  totalAmount: { fontSize: 15, fontWeight: '800', color: accent.base },
  success: { color: colors.success, marginBottom: spacing.md },
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  generateText: { color: colors.white, fontWeight: '700' },
});
