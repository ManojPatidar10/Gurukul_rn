import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listConversations } from '../../api/chat';
import { listEmployees } from '../../api/employees';
import { listStudents } from '../../api/students';
import type { Conversation } from '../../api/types';
import { ScreenContainer } from '../../components/ScreenContainer';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ConversationsList'>;

export function ConversationsListScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listConversations(schoolId), listEmployees(schoolId), listStudents(schoolId)])
      .then(([convos, employees, students]) => {
        setConversations(convos);
        const map: Record<string, string> = {};
        employees.forEach((e) => (map[e.id] = e.name));
        students.forEach((s) => (map[s.id] = s.name));
        setNames(map);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', load);
    load();
    return unsubscribe;
  }, [schoolId, navigation]);

  const otherPartyName = (conversation: Conversation) => {
    const other = conversation.participants.find((p) => p.ownerId !== session.ownerId);
    if (!other) return 'Conversation';
    return names[other.ownerId] ?? 'Unknown';
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Messages" onBack={() => navigation.goBack()} />
      <ScreenContainer padded={false}>
        <View style={styles.actionsRow}>
          <Pressable style={styles.newButton} onPress={() => navigation.navigate('NewConversation')}>
            <Text style={styles.newButtonText}>+ New Conversation</Text>
          </Pressable>
          <Pressable style={styles.botButton} onPress={() => navigation.navigate('HelpdeskBot')}>
            <Text style={styles.botButtonText}>Helpdesk Bot</Text>
          </Pressable>
        </View>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && conversations.length === 0 && <Text style={styles.empty}>No conversations yet.</Text>}
        <FlatList
          data={conversations}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                navigation.navigate('ConversationThread', { conversationId: item.id, title: otherPartyName(item) })
              }
            >
              <Text style={styles.rowTitle}>{otherPartyName(item)}</Text>
            </Pressable>
          )}
        />
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  newButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  newButtonText: { color: colors.white, fontWeight: '700' },
  botButton: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  botButtonText: { color: colors.primary, fontWeight: '700' },
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, paddingHorizontal: spacing.lg, fontSize: 13 },
  empty: { color: colors.textMuted, paddingHorizontal: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
});
