import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { downloadIdCardPdf, getMyIdCards } from '../api/idCards';
import type { IdCard } from '../api/idCards';
import { usePdfDownload } from '../hooks/usePdfDownload';
import { colors, radius, spacing } from '../theme/colors';
import { missingLabelKey } from '../utils/idCard';

interface Props {
  schoolId: string;
  /** Bump to reload (e.g. when the profile screen regains focus after editing card details). */
  refreshKey: number;
  onOpen: (card: IdCard) => void;
}

/**
 * The ID-card block on the profile page: a "complete your profile" prompt listing what's missing,
 * plus Download ID card and Digital ID card / edit details. The download works either way.
 */
export function IdCardProfileSection({ schoolId, refreshKey, onOpen }: Props) {
  const { t } = useTranslation();
  const [card, setCard] = useState<IdCard | null>(null);
  const [failed, setFailed] = useState(false);
  const { busy, run } = usePdfDownload(t('idCard.shareTitle'));

  useEffect(() => {
    getMyIdCards(schoolId)
      .then((cards) => {
        setCard(cards[0] ?? null);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [schoolId, refreshKey]);

  if (failed) return <Text style={styles.muted}>{t('idCard.loadError')}</Text>;
  if (!card) return null;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('idCard.sectionTitle')}</Text>
      {card.missing.length > 0 && (
        <View style={styles.prompt}>
          <Text style={styles.promptTitle}>{t('idCard.completeProfile')}</Text>
          {card.missing.map((code) => (
            <Text key={code} style={styles.promptItem}>
              {'• '}
              {t(missingLabelKey(code))}
            </Text>
          ))}
          <Text style={styles.promptHint}>{t('idCard.placeholderHint')}</Text>
        </View>
      )}
      <Pressable style={styles.primary} onPress={() => onOpen(card)}>
        <Text style={styles.primaryText}>{card.canEdit ? t('idCard.openAndEdit') : t('idCard.open')}</Text>
      </Pressable>
      <Pressable
        style={[styles.secondary, busy && styles.disabled]}
        disabled={busy}
        onPress={() => run(() => downloadIdCardPdf(schoolId, card))}
      >
        {busy ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.secondaryText}>{t('idCard.download')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: '100%', marginTop: spacing.lg },
  title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: spacing.sm },
  muted: { fontSize: 12, color: colors.textMuted, marginTop: spacing.md },
  prompt: {
    backgroundColor: '#FFF7E6',
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#F5D48A',
  },
  promptTitle: { fontSize: 13, fontWeight: '800', color: colors.warning, marginBottom: spacing.xs },
  promptItem: { fontSize: 13, color: colors.textPrimary, marginTop: 2 },
  promptHint: { fontSize: 11, color: colors.textSecondary, marginTop: spacing.sm },
  primary: {
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  secondary: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
});
