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
import {
  chatResponses,
  initialChatMessages,
  suggestedChatQueries,
} from '../../data/mockPrincipalDashboard';
import { colors, radius, spacing } from '../../theme/colors';
import type { ChatMessage, PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'AIChatbot'>;

function getBotResponse(query: string): string {
  const lower = query.toLowerCase();
  if (lower.includes('absent')) return chatResponses.absent;
  if (lower.includes('fee') || lower.includes('class 10')) return chatResponses.fee;
  if (lower.includes('faculty') || lower.includes('leave')) return chatResponses.faculty;
  return chatResponses.default;
}

export function AIChatbotScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [input, setInput] = useState('');
  const messageId = useRef(2);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;

    const userId = String(messageId.current++);
    const botId = String(messageId.current++);
    const userMsg: ChatMessage = { id: userId, role: 'user', text: text.trim() };
    const botMsg: ChatMessage = {
      id: botId,
      role: 'bot',
      text: getBotResponse(text),
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput('');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="AI Chatbot" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.suggestions}>
            {suggestedChatQueries.map((query) => (
              <TouchableOpacity
                key={query}
                style={styles.suggestionChip}
                onPress={() => sendMessage(query)}
              >
                <Text style={styles.suggestionText}>{query}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
            placeholder="Ask about attendance, fees, admissions..."
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => sendMessage(input)}
            returnKeyType="send"
          />
          <TouchableOpacity
            style={styles.sendButton}
            onPress={() => sendMessage(input)}
            accessibilityRole="button"
          >
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
    paddingBottom: spacing.xl,
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
    color: colors.textPrimary,
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
    fontSize: 14,
  },
});
