import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getConversationMessages } from '../../api/chat';
import { sendMessage, subscribeToConversation } from '../../api/chatSocket';
import type { Message } from '../../api/types';
import { markConversationRead } from '../../api/unreadStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ConversationThread'>;

export function ConversationThreadScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    getConversationMessages(schoolId, conversationId)
      .then((history) => {
        if (!cancelled) setMessages((history.messages ?? []).slice().reverse());
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));

    subscribeToConversation(session.token, schoolId, conversationId, (message) => {
      setMessages((prev) => [...prev, message]);
    })
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((e) => setError((e as Error).message));

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [schoolId, conversationId, session.token]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) markConversationRead(conversationId, last.sentAt);
  }, [messages, conversationId]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    try {
      await sendMessage(session.token, schoolId, conversationId, content);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = item.senderOwnerId === session.ownerId;
    const isBot = item.senderKind === 'BOT';
    return (
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : isBot ? styles.bubbleBot : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <ScreenHeader title={title} onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={[styles.inputRow, { paddingBottom: spacing.md + insets.bottom }]}>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loading: { marginTop: spacing.xl },
  listContent: { padding: spacing.lg, gap: spacing.sm },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  bubbleTheirs: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  bubbleBot: { backgroundColor: colors.primaryLight },
  bubbleMine: { backgroundColor: colors.primary },
  bubbleText: { fontSize: 15, color: colors.textPrimary },
  bubbleTextMine: { color: colors.white },
  error: { color: colors.error, paddingHorizontal: spacing.lg, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  sendButtonText: { color: colors.white, fontWeight: '700' },
});
