import { FontAwesome5 } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { accents, colors, radius, softShadow, spacing, type AccentKey } from '../theme/colors';

interface Props {
  accentKey: AccentKey;
  icon: string;
  label: string;
  value: number | null;
  loading?: boolean;
}

export function StatSummaryCard({ accentKey, icon, label, value, loading }: Props) {
  const { t } = useTranslation();
  const accent = accents[accentKey];

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: accent.light }]}>
        <FontAwesome5 name={icon} size={14} color={accent.base} />
      </View>
      {loading ? (
        <ActivityIndicator color={accent.base} size="small" style={styles.loading} />
      ) : (
        <Text style={styles.value}>{value === null ? t('common.emptyValue') : value}</Text>
      )}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31%',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...softShadow,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  loading: {
    alignSelf: 'flex-start',
    marginVertical: 2,
  },
  label: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
});
