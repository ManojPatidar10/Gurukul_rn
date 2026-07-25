import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { ScreenHeader } from '../../components/ScreenHeader';
import { quizPrompts } from '../../data/mockTeacherDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { TeacherStackParamList } from '../../types/teacher';

type Props = NativeStackScreenProps<TeacherStackParamList, 'QuizAssistant'>;

interface ChatMsg {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

export function QuizAssistantScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: '1', role: 'bot', text: 'Hello! I am your AI Assistant. I can help you generate quizzes, lesson plans, or summarize meetings. What would you like to do today?' }
  ]);
  const [input, setInput] = useState('');
  const messageId = useRef(2);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const uMsg: ChatMsg = { id: String(messageId.current++), role: 'user', text: text.trim() };
    const bMsg: ChatMsg = {
      id: String(messageId.current++),
      role: 'bot',
      text: `I've started generating content for: "${text.trim()}". I'll have the formatted questions/summary ready in a moment.`
    };

    setMessages(prev => [...prev, uMsg, bMsg]);
    setInput('');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="AI Quiz Assistant" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[styles.bubble, msg.role === 'user' ? styles.userBubble : styles.botBubble]}
            >
              <Text style={[styles.bubbleText, msg.role === 'user' && styles.userBubbleText]}>
                {msg.text}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Type a topic or use a prompt above..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage(input)}
          />
          <TouchableOpacity style={styles.sendButton} onPress={() => sendMessage(input)}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: spacing.lg,
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  suggestionChip: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
  },
  suggestionText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  bubble: {
    maxWidth: '85%',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
  },
  botBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  userBubbleText: {
    color: colors.white,
  },
  inputBar: {
    flexDirection: 'row',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  sendText: {
    color: colors.white,
    fontWeight: '600',
  },
});
