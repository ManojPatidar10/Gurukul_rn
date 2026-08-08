import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'VendorDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function VendorDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const vendor = route.params.vendor;

  return (
    <View style={styles.root}>
      <ScreenHeader title={vendor.name} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.heroRow}>
          <AvatarBadge name={vendor.name} accentKey="vendors" size={56} />
          <Text style={styles.heroName}>{vendor.name}</Text>
        </View>

        <View style={styles.card}>
          <Field label={t('vendors.detail.contactPhone')} value={vendor.contactPhone} />
          <Field label={t('vendors.detail.contactEmail')} value={vendor.contactEmail} />
          <Field label={t('vendors.detail.bankAccount')} value={vendor.bankAccount} />
          <Field label={t('vendors.detail.upiId')} value={vendor.upiId} />
          <Field label={t('vendors.detail.address')} value={vendor.address} />
        </View>

        <Pressable style={styles.actionButton} onPress={() => navigation.navigate('VendorForm', { vendor })}>
          <Text style={styles.actionText}>{t('common.edit')}</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const accent = accents.vendors;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginLeft: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...softShadow,
  },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '700' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  actionButton: {
    backgroundColor: accent.light,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
  },
  actionText: { color: accent.base, fontWeight: '700' },
});
