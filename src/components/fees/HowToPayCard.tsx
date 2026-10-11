import { FontAwesome5 } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { accents, colors, radius, spacing } from '../../theme/colors';

/**
 * Tells a student or parent how to pay a bill while paying in the app isn't available: at the
 * school office, keeping the receipt. Fixed text for now; a school-specific version is a follow-up.
 */
export function HowToPayCard() {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <FontAwesome5 name="school" size={14} color={accents.fees.base} />
        <Text style={styles.title}>{t('fees.howToPay.title')}</Text>
      </View>
      <Text style={styles.body}>{t('fees.howToPay.body')}</Text>
      <Text style={styles.later}>{t('fees.howToPay.later')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: accents.fees.light,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },
  later: { fontSize: 12.5, color: colors.textSecondary, marginTop: spacing.sm },
});
