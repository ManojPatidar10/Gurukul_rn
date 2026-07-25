import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollHub'>;

const items: { route: keyof PrincipalStackParamList; title: string; description: string }[] = [
  {
    route: 'SalaryStructuresList',
    title: 'Salary Structures',
    description: 'Basic, allowances, and deductions per employee',
  },
  {
    route: 'PayrollRun',
    title: 'Run Payroll',
    description: 'Create a run, process it, and pay employees for the month',
  },
];

export function PayrollHubScreen({ navigation }: Props) {
  return (
    <View style={styles.root}>
      <ScreenHeader title="Payroll" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {items.map((item) => (
          <Pressable
            key={item.route}
            style={styles.row}
            onPress={() => navigation.navigate(item.route as never)}
          >
            <Text style={styles.rowTitle}>{item.title}</Text>
            <Text style={styles.rowDescription}>{item.description}</Text>
          </Pressable>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
