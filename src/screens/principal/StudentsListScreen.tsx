import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listStudents, searchStudents } from '../../api/students';
import type { Student } from '../../api/types';
import { AvatarBadge } from '../../components/AvatarBadge';
import { ScreenHeader } from '../../components/ScreenHeader';
import { SearchBar } from '../../components/SearchBar';
import { StatusChip } from '../../components/StatusChip';
import { useSchoolId } from '../../context/SchoolContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'StudentsList'>;

export function StudentsListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim());

  const load = useCallback(() => {
    setError(null);
    return (debouncedQuery ? searchStudents(schoolId, debouncedQuery) : listStudents(schoolId))
      .then(setStudents)
      .catch((e) => setError(e.message));
  }, [schoolId, debouncedQuery]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(true);
      load().finally(() => setLoading(false));
    });
    return unsubscribe;
  }, [navigation, load]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Students" onBack={() => navigation.goBack()} />
      <View style={styles.body}>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('StudentForm', {})}>
          <Text style={styles.addButtonText}>+ Enroll student</Text>
        </Pressable>

        <SearchBar value={query} onChangeText={setQuery} placeholder="Search by name or roll number" />

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={students}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            !loading ? (
              <Text style={styles.empty}>
                {error
                  ? 'Could not load students.'
                  : debouncedQuery
                    ? 'No students match your search.'
                    : '0 students yet — enroll the first one.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => navigation.navigate('StudentDetail', { student: item })}
            >
              <AvatarBadge name={item.name} accentKey="students" />
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{item.name}</Text>
                <Text style={styles.rowMeta}>
                  Roll {item.rollNumber} · {item.classSectionLabel || 'Unassigned'}
                </Text>
              </View>
              <StatusChip label={item.status} variant={item.status === 'ACTIVE' ? 'success' : 'neutral'} />
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
