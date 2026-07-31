import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { listMyCallHistory, listSchoolCallHistory } from '../../api/calls';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { StatusChip } from '../../components/StatusChip';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, softShadow, spacing } from '../../theme/colors';
import type { CallLogResponse } from '../../api/types';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'CallHistory'>;

export function CallHistoryScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [logs, setLogs] = useState<CallLogResponse[]>([]);
  const [showWholeSchool, setShowWholeSchool] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const fetch = showWholeSchool ? listSchoolCallHistory(schoolId) : listMyCallHistory(schoolId);
    fetch
      .then(setLogs)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, showWholeSchool]);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Call history" onBack={() => navigation.goBack()} />
      <ScreenContainer>
        {session.role === 'ADMIN' && (
          <View style={styles.toggleRow}>
            <Text
              style={[styles.toggleOption, !showWholeSchool && styles.toggleOptionActive]}
              onPress={() => setShowWholeSchool(false)}
            >
              My calls
            </Text>
            <Text
              style={[styles.toggleOption, showWholeSchool && styles.toggleOptionActive]}
              onPress={() => setShowWholeSchool(true)}
            >
              Whole school
            </Text>
          </View>
        )}
        {loading && <ActivityIndicator color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && logs.length === 0 && <Text style={styles.empty}>No calls yet.</Text>}
        {logs.map((log) => (
          <View key={log.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{new Date(log.startedAt).toLocaleString()}</Text>
              <StatusChip label={log.outcome} variant={outcomeVariant(log.outcome)} />
            </View>
            <Text style={styles.cardMeta}>
              {log.scheduledCallId ? 'Scheduled call' : 'Immediate call'}
              {log.durationSeconds != null ? ` · ${Math.round(log.durationSeconds / 60)} min` : ''}
            </Text>
          </View>
        ))}
      </ScreenContainer>
    </View>
  );
}

function outcomeVariant(outcome: string): 'success' | 'warning' | 'error' | 'neutral' | 'info' {
  if (outcome === 'COMPLETED') return 'success';
  if (outcome === 'MISSED' || outcome === 'DECLINED' || outcome === 'BUSY') return 'warning';
  if (outcome === 'CANCELLED') return 'neutral';
  return 'info';
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toggleRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  toggleOption: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  toggleOptionActive: { color: colors.white, backgroundColor: colors.primary },
  empty: { color: colors.textMuted },
  error: { color: colors.error, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  cardMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
});
