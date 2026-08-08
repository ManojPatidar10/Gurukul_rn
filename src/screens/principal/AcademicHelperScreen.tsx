import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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
import { useTranslation } from 'react-i18next';

import { askBedrock, BedrockError, type ChatMessage } from '../../services/bedrock/bedrockClient';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useToast } from '../../context/ToastContext';
import { accents, colors, radius, softShadow, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AcademicHelper'>;

type Mode = 'student' | 'teacher';

interface Message extends ChatMessage {
  id: string;
}

const STUDENT_SYSTEM_PROMPT =
  'You are a friendly, patient academic tutor helping a school student (grades K-12) understand ' +
  'concepts and solve homework problems. Explain step by step in simple, encouraging language ' +
  "appropriate for their level. If the question is ambiguous, ask a clarifying question. Always " +
  "answer in the same language the student's question is written in.";

const TEACHER_SYSTEM_PROMPT =
  'You are an expert teaching assistant helping a school teacher with lesson planning, pedagogy, ' +
  'explaining difficult concepts, drafting quiz/test questions, and classroom management ' +
  "strategies. Be thorough, professional, and practical. Always answer in the same language the " +
  "teacher's question is written in.";

const accent = accents.academicHelper;

export function AcademicHelperScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>('student');
  const [messagesByMode, setMessagesByMode] = useState<Record<Mode, Message[]>>({ student: [], teacher: [] });
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const messages = messagesByMode[mode];

  const handleSend = async () => {
    const question = input.trim();
    if (!question || sending) return;

    const userMessage: Message = { id: `${Date.now()}-u`, role: 'user', content: question };
    const history = [...messages, userMessage];
    setMessagesByMode((prev) => ({ ...prev, [mode]: history }));
    setInput('');
    setSending(true);

    try {
      const systemPrompt = mode === 'student' ? STUDENT_SYSTEM_PROMPT : TEACHER_SYSTEM_PROMPT;
      const reply = await askBedrock(
        systemPrompt,
        history.map((m) => ({ role: m.role, content: m.content }))
      );
      const assistantMessage: Message = { id: `${Date.now()}-a`, role: 'assistant', content: reply };
      setMessagesByMode((prev) => ({ ...prev, [mode]: [...prev[mode], assistantMessage] }));
    } catch (e) {
      const message = e instanceof BedrockError ? e.message : (e as Error).message;
      showToast(message, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('academicHelper.title')} onBack={() => navigation.goBack()} />

      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeButton, mode === 'student' && styles.modeButtonActive]}
          onPress={() => setMode('student')}
        >
          <Text style={[styles.modeText, mode === 'student' && styles.modeTextActive]}>
            {t('academicHelper.studentMode')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.modeButton, mode === 'teacher' && styles.modeButtonActive]}
          onPress={() => setMode('teacher')}
        >
          <Text style={[styles.modeText, mode === 'teacher' && styles.modeTextActive]}>
            {t('academicHelper.teacherMode')}
          </Text>
        </Pressable>
      </View>

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
              {mode === 'student' ? t('academicHelper.emptyStudent') : t('academicHelper.emptyTeacher')}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleUser : styles.bubbleAssistant]}>
              <Text style={item.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
                {item.content}
              </Text>
            </View>
          )}
        />

        {sending && (
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={accent.base} />
            <Text style={styles.thinkingText}>{t('academicHelper.thinking')}</Text>
          </View>
        )}

        <View style={styles.inputRow}>
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
  modeRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    margin: spacing.lg,
    marginBottom: spacing.sm,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: accent.base,
  },
  modeText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  modeTextActive: { color: colors.white },
  listContent: { flexGrow: 1, padding: spacing.lg, paddingTop: spacing.sm },
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
