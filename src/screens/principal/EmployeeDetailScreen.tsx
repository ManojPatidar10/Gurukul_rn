import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeeDetail'>;

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value || '—'}</Text>
    </View>
  );
}

export function EmployeeDetailScreen({ route, navigation }: Props) {
  const employee = route.params.employee;

  return (
    <View style={styles.root}>
      <ScreenHeader title={employee.name} subtitle={employee.designation} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        <View style={styles.statusRow}>
          <StatusChip label={employee.status} variant={employee.status === 'ACTIVE' ? 'success' : 'neutral'} />
        </View>

        <Field label="Designation" value={employee.designation} />
        <Field label="Join date" value={employee.joinDate} />
        <Field label="Bank account" value={employee.bankAccount} />
        <Field label="Contact phone" value={employee.contactPhone} />

        <Pressable
          style={styles.actionButton}
          onPress={() => navigation.navigate('EmployeeForm', { employee })}
        >
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  statusRow: { marginBottom: spacing.lg },
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
