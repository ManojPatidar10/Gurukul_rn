import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { listEmployees, searchEmployees } from '../../api/employees';
import type { Employee } from '../../api/types';
import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useToast } from '../../context/ToastContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'EmployeesList'>;

const PAGE_SIZE = 50;

export function EmployeesListScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const { showToast } = useToast();

  const load = useCallback(
    (pageToLoad: number, append: boolean) => {
      setError(null);
      if (debouncedQuery) {
        return searchEmployees(schoolId, debouncedQuery)
          .then((rows) => {
            setEmployees(rows);
            setHasNext(false);
          })
          .catch((e) => {
            setError(e.message);
            showToast(e.message, 'error');
          });
      }
      return listEmployees(schoolId, pageToLoad, PAGE_SIZE)
        .then((res) => {
          setEmployees((prev) => (append ? [...prev, ...res.content] : res.content));
          setHasNext(res.hasNext);
          setPage(pageToLoad);
        })
        .catch((e) => {
          setError(e.message);
          showToast(e.message, 'error');
        });
    },
    [schoolId, debouncedQuery, showToast]
  );

  useEffect(() => {
    setLoading(true);
    load(0, false).finally(() => setLoading(false));
  }, [load]);

  const hasMounted = useRef(false);
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (!hasMounted.current) {
        hasMounted.current = true;
        return;
      }
      setLoading(true);
      load(0, false).finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(0, false).finally(() => setRefreshing(false));
  };

  const handleLoadMore = () => {
    if (!hasNext || loadingMore || debouncedQuery) return;
    setLoadingMore(true);
    load(page + 1, true).finally(() => setLoadingMore(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('employees.list.title')} onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('EmployeeForm', {})}>
          <Text style={styles.addButtonText}>{t('employees.list.addButton')}</Text>
        </Pressable>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name" />

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={employees}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={colors.primary} /> : null}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error
                  ? t('employees.list.loadError')
                  : debouncedQuery
                    ? t('employees.list.noSearchResults')
                    : t('employees.list.empty')}
              </Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('EmployeeDetail', { employee: item })}
            >
              <AvatarBadge name={item.name} accentKey="employees" />
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>{item.designation}</Text>
              </View>
              <StatusChip
                label={item.status === 'ACTIVE' ? t('common.active') : item.status === 'INACTIVE' ? t('common.inactive') : item.status}
                variant={item.status === 'ACTIVE' ? 'success' : 'neutral'}
              />
            </Pressable>
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
  error: { color: colors.error, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 40 },
  footerLoader: { marginVertical: spacing.md },
  loader: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginLeft: spacing.md, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
