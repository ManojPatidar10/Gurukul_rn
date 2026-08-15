import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listSectionAssessments } from '../../api/assessments';
import type { Assessment } from '../../api/types';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'SectionAssessmentsList'>;

// Whether the assessment date has passed yet - a full "awaiting results / published" tri-state
// would need a per-term publication check against the backend; this stays a simple two-state
// signal computed purely from the date, no extra network calls.
function examStatus(assessmentDate: string): { label: string; variant: 'info' | 'success' } {
  const today = new Date().toISOString().slice(0, 10);
  return assessmentDate > today ? { label: 'Upcoming', variant: 'info' } : { label: 'Completed', variant: 'success' };
}

export function SectionAssessmentsListScreen({ route, navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const canManage = session.ownerType === 'EMPLOYEE';
  const classSection = route.params.classSection;
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    return listSectionAssessments(schoolId, classSection.id)
      .then(setAssessments)
      .catch((e) => setError(e.message));
  }, [schoolId, classSection.id]);

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
      <ScreenHeader
        title={`${classSection.className} - ${classSection.section}`}
        subtitle="Assessments"
        onBack={() => navigation.goBack()}
      />
      <View style={styles.body}>
        {canManage && (
          <Pressable
            style={styles.addButton}
            onPress={() => navigation.navigate('AssessmentForm', { classSection })}
          >
            <Text style={styles.addButtonText}>+ New assessment</Text>
          </Pressable>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <FlatList
          data={assessments}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <Text style={styles.empty}>
                {error ? 'Could not load assessments.' : '0 assessments yet — create the first one.'}
              </Text>
            )
          }
          renderItem={({ item }) => {
            const status = examStatus(item.assessmentDate);
            return (
              <Pressable
                style={styles.row}
                onPress={() => navigation.navigate('AssessmentDetail', { assessment: item, classSection })}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{item.title}</Text>
                  <Text style={styles.rowMeta}>
                    {item.subjectName} · {item.assessmentDate} · Max {item.maxMarks}
                  </Text>
                </View>
                <View style={styles.chipStack}>
                  <StatusChip label={item.type} variant="neutral" />
                  <StatusChip label={status.label} variant={status.variant} />
                </View>
              </Pressable>
            );
          }}
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
  loader: { marginTop: 40 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  rowMain: { flex: 1, marginRight: spacing.sm },
  rowName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  rowMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  chipStack: { alignItems: 'flex-end', gap: spacing.xs },
});
