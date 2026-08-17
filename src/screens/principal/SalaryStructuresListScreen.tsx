import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listSalaryStructures } from '../../api/salaryStructures';
import type { SalaryStructure } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SalaryStructuresList'>;

function netOf(s: SalaryStructure) {
  return s.basic + s.allowances - s.deductions;
}

export function SalaryStructuresListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError(null);
    return listSalaryStructures(schoolId)
      .then(setStructures)
      .catch((e) => {
        setError(e.message);
        showToast(e.message, 'error');
      });
  }, [schoolId, showToast]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('payroll.salaryStructuresList.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('SalaryStructureForm')}>
          <Text style={styles.addButtonText}>{t('payroll.salaryStructuresList.addButton')}</Text>
        </Pressable>

        <FlatList
          data={structures}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error ? t('payroll.salaryStructuresList.loadError') : t('payroll.salaryStructuresList.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.rowName}>{item.employeeName}</Text>
                <Text style={styles.rowMeta}>
                  {t('payroll.salaryStructuresList.rowSubtitle', {
                    basic: item.basic.toLocaleString('en-IN'),
                    allowances: item.allowances.toLocaleString('en-IN'),
                    deductions: item.deductions.toLocaleString('en-IN'),
                  })}
                </Text>
                <Text style={styles.rowMeta}>
                  {t('payroll.salaryStructuresList.effectiveFrom', { date: item.effectiveFrom })}
                </Text>
              </View>
              <Text style={styles.rowNet}>₹{netOf(item).toLocaleString('en-IN')}</Text>
            </View>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  body: { flex: 1, paddingHorizontal: spacing.lg },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...softShadow,
  },
  addButtonText: { color: colors.white, fontWeight: '700' },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  loader: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  rowNet: { fontSize: 14, color: accents.payroll.base, fontWeight: '800' },
});
