import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getErrorMessage } from '../../api/errorMessage';
import { generateBills, getGeneratePreview } from '../../api/feeStructures';
import type { FeeStructure, GenerateBillsResult, GeneratePreview } from '../../api/types';
import { useBottomInset } from '../../hooks/useBottomInset';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import { clampIsoDate, generateConfirmation, generateDueDateBounds, todayIst } from '../../utils/feeBills';
import { DatePickerField, parseIsoDate } from '../DatePickerField';
import { ErrorNotice } from '../ErrorNotice';

interface Props {
  schoolId: string;
  structure: Pick<FeeStructure, 'id'>;
  visible: boolean;
  onClose: () => void;
  onGenerated: (result: GenerateBillsResult) => void;
}

/**
 * Generate, with a confirmation first: fetches what it would do (new bills, students already
 * billed and those for a different amount, withdrawn students skipped), lets the admin pick the
 * due date (the server suggests today + 30 days; never before today), and only then creates the
 * bills. With nobody left to bill it says so and offers no confirm button.
 */
export function GenerateBillsDialog({ schoolId, structure, visible, onClose, onGenerated }: Props) {
  const { t } = useTranslation();
  const sheetBottom = useBottomInset(spacing.lg);
  const [preview, setPreview] = useState<GeneratePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setPreview(null);
    getGeneratePreview(schoolId, structure.id)
      .then((result) => {
        setPreview(result);
        setDueDate(clampIsoDate(result.suggestedDueDate, generateDueDateBounds(todayIst())));
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, structure.id]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const handleGenerate = async () => {
    if (!dueDate) return;
    setGenerating(true);
    setError(null);
    try {
      onGenerated(await generateBills(schoolId, structure.id, dueDate));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setGenerating(false);
    }
  };

  const bounds = generateDueDateBounds(todayIst());
  const confirmation = preview ? generateConfirmation(preview, dueDate || preview.suggestedDueDate, t) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={generating ? undefined : onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: sheetBottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{t('fees.structureDetail.generate.title')}</Text>

          {loading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.muted}>{t('fees.structureDetail.generate.loading')}</Text>
            </View>
          )}

          {error && <ErrorNotice message={error} />}
          {error && !preview && (
            <Pressable style={styles.secondary} onPress={load} accessibilityRole="button">
              <Text style={styles.secondaryText}>{t('common.retry')}</Text>
            </Pressable>
          )}

          {preview && confirmation && (
            <>
              {confirmation.canGenerate && (
                <DatePickerField
                  label={t('fees.structureDetail.generate.dueDate')}
                  value={dueDate}
                  onChange={setDueDate}
                  minimumDate={parseIsoDate(bounds.min)}
                  maximumDate={parseIsoDate(bounds.max)}
                />
              )}
              {confirmation.lines.map((line, index) => (
                <Text key={index} style={index === 0 ? styles.question : styles.detail}>
                  {line}
                </Text>
              ))}
            </>
          )}

          <View style={styles.buttons}>
            <Pressable style={[styles.secondary, styles.button]} onPress={onClose} disabled={generating}>
              <Text style={styles.secondaryText}>{t('common.cancel')}</Text>
            </Pressable>
            {confirmation?.canGenerate && (
              <Pressable
                style={[styles.primary, styles.button, (generating || !dueDate) && styles.disabled]}
                onPress={handleGenerate}
                disabled={generating || !dueDate}
              >
                <Text style={styles.primaryText}>
                  {generating ? t('fees.structureDetail.generate.creating') : t('fees.structureDetail.generate.confirm')}
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    ...softShadow,
  },
  title: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.md },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  muted: { color: colors.textMuted },
  question: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: spacing.sm },
  detail: { fontSize: 13.5, color: colors.textSecondary, marginBottom: spacing.xs, lineHeight: 19 },
  buttons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  button: { flex: 1 },
  primary: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: spacing.md, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '700' },
  secondary: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: { color: colors.textPrimary, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
