import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
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
        <View style={styles.heroRow}>
          <AvatarBadge name={employee.name} accentKey="employees" size={56} />
          <View style={styles.heroText}>
            <Text style={styles.heroName}>{employee.name}</Text>
            <StatusChip label={employee.status} variant={employee.status === 'ACTIVE' ? 'success' : 'neutral'} />
          </View>
        </View>

        <View style={styles.card}>
          <Field label="Designation" value={employee.designation} />
          <Field label="Join date" value={employee.joinDate} />
          <Field label="Bank account" value={employee.bankAccount} />
          <Field label="Contact phone" value={employee.contactPhone} />
        </View>

        <View style={styles.actions}>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('EmployeeForm', { employee })}>
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={() => navigation.navigate('SalaryHistory', { employee })}>
            <Text style={styles.actionText}>Salary history</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    </View>
  );
}

const accent = accents.employees;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg },
  heroText: { marginLeft: spacing.md, gap: spacing.xs },
  heroName: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
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
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  actionButton: {
    backgroundColor: accent.light,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: { color: accent.base, fontWeight: '700' },
});
