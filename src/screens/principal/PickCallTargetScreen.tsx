import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { startImmediateCall } from '../../api/calls';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { useCallTargets, type CallTarget } from '../../hooks/useCallTargets';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'PickCallTarget'>;

export function PickCallTargetScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { targets, loading, error } = useCallTargets();
  const [callingId, setCallingId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const handleCall = async (target: CallTarget) => {
    setCallingId(target.ownerId);
    setCallError(null);
    try {
      const session = await startImmediateCall(schoolId, {
        calleeOwnerType: target.ownerType,
        calleeOwnerId: target.ownerId,
      });
      navigation.replace('InCall', {
        roomName: session.roomName,
        displayName: target.name,
        callLogId: session.callLogId,
      });
    } catch (e) {
      setCallError((e as Error).message);
    } finally {
      setCallingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Start a call" onBack={() => navigation.goBack()} />
      <ScreenContainer padded={false}>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {(error || callError) && <Text style={styles.error}>{error ?? callError}</Text>}
        {!loading && targets.length === 0 && !error && (
          <Text style={styles.empty}>No one available to call right now.</Text>
        )}
        <FlatList
          data={targets}
          scrollEnabled={false}
          keyExtractor={(item) => `${item.ownerType}:${item.ownerId}`}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleCall(item)}
              disabled={callingId === item.ownerId}
            >
              <Text style={styles.rowTitle}>{item.name}</Text>
              {callingId === item.ownerId ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.callLabel}>Call</Text>
              )}
            </Pressable>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, padding: spacing.lg, fontSize: 13 },
  empty: { color: colors.textMuted, padding: spacing.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  callLabel: { color: colors.primary, fontWeight: '700' },
});
