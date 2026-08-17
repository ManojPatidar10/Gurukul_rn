import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PayrollHub'>;

const accent = accents.payroll;

export function PayrollHubScreen({ navigation }: Props) {
  const { t } = useTranslation();

  const items: { route: keyof PrincipalStackParamList; title: string; description: string }[] = [
    {
      route: 'SalaryStructuresList',
      title: t('payroll.hub.salaryStructures.title'),
      description: t('payroll.hub.salaryStructures.description'),
    },
    {
      route: 'PayrollRun',
      title: t('payroll.hub.runPayroll.title'),
      description: t('payroll.hub.runPayroll.description'),
    },
    {
      route: 'PayrollOverview',
      title: t('payroll.hub.overview.title'),
      description: t('payroll.hub.overview.description'),
    },
  ];

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.hub.title')} onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {items.map((item) => (
          <Pressable
            key={item.route}
            style={styles.row}
            onPress={() => navigation.navigate(item.route as never)}
          >
            <View style={styles.accentBar} />
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{item.title}</Text>
              <Text style={styles.rowDescription}>{item.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...softShadow,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: radius.pill,
    backgroundColor: accent.base,
    marginRight: spacing.md,
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowDescription: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
