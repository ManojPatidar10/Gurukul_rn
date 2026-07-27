import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { createConversation } from '../../api/chat';
import { listEmployees } from '../../api/employees';
import { listStudents } from '../../api/students';
import type { OwnerType } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'NewConversation'>;

interface Party {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
}

export function NewConversationScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingId, setCreatingId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([listEmployees(schoolId), listStudents(schoolId)])
      .then(([employees, students]) => {
        const list: Party[] = [
          ...employees
            .filter((e) => e.id !== session.ownerId)
            .map((e) => ({ ownerType: 'EMPLOYEE' as const, ownerId: e.id, name: `${e.name} (Staff)` })),
          ...students.map((s) => ({ ownerType: 'STUDENT' as const, ownerId: s.id, name: `${s.name} (Student)` })),
        ];
        setParties(list);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, session.ownerId]);

  const handleSelect = async (party: Party) => {
    setCreatingId(party.ownerId);
    setError(null);
    try {
      const conversation = await createConversation(schoolId, {
        otherPartyOwnerType: party.ownerType,
        otherPartyOwnerId: party.ownerId,
      });
      navigation.replace('ConversationThread', { conversationId: conversation.id, title: party.name });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="New Conversation" onBack={() => navigation.goBack()} />
      <ScreenContainer padded={false}>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        <FlatList
          data={parties}
          scrollEnabled={false}
          keyExtractor={(item) => `${item.ownerType}:${item.ownerId}`}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => handleSelect(item)} disabled={creatingId === item.ownerId}>
              <Text style={styles.rowTitle}>{item.name}</Text>
              {creatingId === item.ownerId && <ActivityIndicator color={colors.primary} />}
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
});
