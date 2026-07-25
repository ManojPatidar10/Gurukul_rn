import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme/colors';
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
  const vendor = route.params.vendor;

  return (
    <View style={styles.root}>
      <ScreenHeader title={vendor.name} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <Field label="Contact phone" value={vendor.contactPhone} />
        <Field label="Contact email" value={vendor.contactEmail} />
        <Field label="Bank account" value={vendor.bankAccount} />
        <Field label="UPI ID" value={vendor.upiId} />
        <Field label="Address" value={vendor.address} />

        <Pressable
          style={styles.actionButton}
          onPress={() => navigation.navigate('VendorForm', { vendor })}
        >
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  field: { marginBottom: spacing.md },
  fieldLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  fieldValue: { fontSize: 16, color: colors.textPrimary, marginTop: 2 },
  actionButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
  },
  actionText: { color: colors.primary, fontWeight: '600' },
});
