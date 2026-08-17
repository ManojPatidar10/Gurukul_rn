import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { getConversationMessages, listConversations } from '../../api/chat';
import { listAllEmployees } from '../../api/employees';
import { listAllStudents } from '../../api/students';
import type { Conversation } from '../../api/types';
import { getLastReadAt } from '../../api/unreadStore';
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
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const otherParty = (conversation: Conversation) =>
    conversation.participants.find((p) => p.ownerId !== session.ownerId);

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([listConversations(schoolId), listAllEmployees(schoolId), listAllStudents(schoolId)])
      .then(async ([convos, employees, students]) => {
        const withOthers = convos.filter((c) => otherParty(c));
        setConversations(withOthers);

        const map: Record<string, string> = {};
        employees.forEach((e) => (map[e.id] = e.name));
        students.forEach((s) => (map[s.id] = s.name));
        setNames(map);

        const counts = await Promise.all(
          withOthers.map(async (conversation) => {
            const [history, lastReadAt] = await Promise.all([
              getConversationMessages(schoolId, conversation.id),
              getLastReadAt(conversation.id),
            ]);
            const unread = (history.messages ?? []).filter(
              (m) => m.senderOwnerId !== session.ownerId && (!lastReadAt || m.sentAt > lastReadAt)
            ).length;
            return [conversation.id, unread] as const;
          })
        );
        setUnreadCounts(Object.fromEntries(counts));
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
    const other = otherParty(conversation);
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
        </View>
        {loading && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {error && <Text style={styles.error}>{error}</Text>}
        {!loading && conversations.length === 0 && <Text style={styles.empty}>No conversations yet.</Text>}
        <FlatList
          data={conversations}
          scrollEnabled={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const unread = unreadCounts[item.id] ?? 0;
            return (
              <Pressable
                style={styles.row}
                onPress={() =>
                  navigation.navigate('ConversationThread', { conversationId: item.id, title: otherPartyName(item) })
                }
              >
                <Text style={styles.rowTitle}>{otherPartyName(item)}</Text>
                {unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unread > 99 ? '99+' : unread}</Text>
                  </View>
                )}
              </Pressable>
            );
          }}
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
  loading: { marginTop: spacing.xl },
  error: { color: colors.error, paddingHorizontal: spacing.lg, fontSize: 13 },
  empty: { color: colors.textMuted, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  unreadBadge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
});
