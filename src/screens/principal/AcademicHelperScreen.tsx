import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { askAi, type AiChatMessage } from '../../api/ai';
import { ApiError } from '../../api/client';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AcademicHelper'>;

interface Message extends AiChatMessage {
  id: string;
}

const accent = accents.academicHelper;

/**
 * Open-ended tutoring for students, teaching support for staff. Distinct from HelpdeskBotScreen,
 * which answers questions about the user's own attendance/fees/subjects using real school data.
 *
 * The system prompt used to live here, alongside a student/teacher toggle the user could flip. Both
 * moved to the backend (AiChatService), which selects the prompt from the caller's role in the JWT.
 * That toggle was a real hole: a student could switch to teacher mode and ask for complete answer
 * keys to their own homework.
 */
export function AcademicHelperScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // Presentation only - it just picks the empty-state wording. The actual behaviour is decided
  // server-side from the JWT, so this can't be used to change how the assistant answers.
  const isStudent = session.ownerType === 'STUDENT';

  const handleCopy = async (content: string) => {
    await Clipboard.setStringAsync(content);
    showToast(t('common.copied'), 'success');
  };

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending) return;

    const userMessage: Message = { id: `${Date.now()}-u`, role: 'user', content: question };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput('');
    setSending(true);

    try {
      const response = await askAi(
        schoolId,
        history.map((m) => ({ role: m.role, content: m.content }))
      );
      setMessages((prev) => [...prev, { id: `${Date.now()}-a`, role: 'assistant', content: response.reply }]);
    } catch (e) {
      // The backend already returns messages written to be shown to a student or teacher as-is
      // (unconfigured, rate-limited, provider down), so there's nothing to translate here.
      showToast(e instanceof ApiError ? e.message : (e as Error).message, 'error');
      // Drop the unanswered question back into the input so a retry doesn't mean retyping it.
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setInput(question);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('academicHelper.title')} onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {isStudent ? t('academicHelper.emptyStudent') : t('academicHelper.emptyTeacher')}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              onLongPress={() => handleCopy(item.content)}
              style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}
            >
              <Text
                selectable
                style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}
              >
                {item.content}
              </Text>
            </Pressable>
          )}
        />

        {sending && (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={accent.base} />
            <Text style={styles.thinkingText}>{t('academicHelper.thinking')}</Text>
          </View>
        )}

        <View style={[styles.inputRow, { paddingBottom: spacing.sm + insets.bottom }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('academicHelper.inputPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
          />
          <Pressable
            style={[styles.sendButton, (!input.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Text style={styles.sendText}>{t('academicHelper.send')}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  listContent: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.md },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: spacing.xl },
  bubble: {
    maxWidth: '85%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    ...softShadow,
  },
  bubbleUser: {
    backgroundColor: accent.base,
    alignSelf: 'flex-end',
  },
  bubbleAssistant: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
  },
  bubbleTextUser: { color: colors.white, fontSize: 15 },
  bubbleTextAssistant: { color: colors.textPrimary, fontSize: 15 },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  thinkingText: { color: colors.textMuted, fontSize: 13 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.textPrimary,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: accent.base,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.5 },
  sendText: { color: colors.white, fontWeight: '700' },
});
