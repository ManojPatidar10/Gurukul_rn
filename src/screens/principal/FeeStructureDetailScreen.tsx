import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getFeeStructure } from '../../api/feeStructures';
import type { GenerateBillsResult } from '../../api/types';
import { GenerateBillsDialog } from '../../components/fees/GenerateBillsDialog';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';
import { formatDueDate, generateResultText, structureTotal } from '../../utils/feeBills';
import { formatRupees } from '../../utils/money';
import { getErrorMessage } from '../../api/errorMessage';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'FeeStructureDetail'>;

export function FeeStructureDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  // The route param is only the first paint: the structure is fetched again on focus, so an edit or
  // a Generate (which sets its due date) shows straight away.
  const [feeStructure, setFeeStructure] = useState(route.params.feeStructure);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const { showToast } = useToast();

  const reload = useCallback(() => {
    getFeeStructure(schoolId, route.params.feeStructure.id)
      .then(setFeeStructure)
      .catch((e) => showToast(getErrorMessage(e), 'error'));
  }, [schoolId, route.params.feeStructure.id, showToast]);

  useEffect(() => navigation.addListener('focus', reload), [navigation, reload]);

  const total = structureTotal(feeStructure);

  const handleGenerated = (result: GenerateBillsResult) => {
    setGenerateOpen(false);
    setGeneratedText(generateResultText(result, t));
    reload();
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
            <Text style={styles.lineAmount}>{formatRupees(line.amount)}</Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{t('fees.structureDetail.totalPerStudent')}</Text>
          <Text style={styles.totalAmount}>{formatRupees(total)}</Text>
        </View>
        <Text style={styles.dueDate}>
          {feeStructure.dueDate
            ? t('fees.structureDetail.dueDate', { date: formatDueDate(feeStructure.dueDate, t) })
            : t('fees.structureDetail.noDueDate')}
        </Text>

        <Pressable
          style={styles.editButton}
          onPress={() => {
            setGeneratedText(null);
            navigation.navigate('FeeStructureForm', { feeStructure });
          }}
        >
          <Text style={styles.editText}>{t('fees.structureDetail.editLines')}</Text>
        </Pressable>

        {generatedText !== null && <Text style={styles.success}>{generatedText}</Text>}

        <Pressable
          style={styles.generateButton}
          onPress={() => {
            setGeneratedText(null);
            setGenerateOpen(true);
          }}
        >
          <Text style={styles.generateText}>{t('fees.structureDetail.generateBills')}</Text>
        </Pressable>
      </ScreenContainer>

      <GenerateBillsDialog
        schoolId={schoolId}
        structure={feeStructure}
        visible={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerated={handleGenerated}
      />
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
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  totalAmount: { fontSize: 15, fontWeight: '800', color: accent.base },
  dueDate: { fontSize: 13, color: colors.textSecondary, marginBottom: spacing.lg },
  success: { color: colors.success, marginBottom: spacing.md },
  editButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  editText: { color: colors.primary, fontWeight: '700' },
  generateButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...softShadow,
  },
  generateText: { color: colors.white, fontWeight: '700' },
});
