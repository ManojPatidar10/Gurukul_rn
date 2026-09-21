import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { getOrCreateBotConversation } from '../../api/chat';
import { ApiError } from '../../api/client';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'HelpdeskBot'>;

/**
 * Thin redirector, not a chat UI of its own: resolves (or creates, on first use) the caller's private
 * Helpdesk BOT conversation and hands off to ConversationThreadScreen's existing STOMP-based chat UI -
 * the same real-time transport/UI already used for human-to-human conversations. Previously this
 * screen called the tool-less POST /api/v1/ai/chat directly (see git history), which meant the
 * Helpdesk bot had no real school-data access at all; routing through the STOMP BOT conversation flow
 * is what makes BotReplyService's tools (including the admin school-metrics tool) actually reachable.
 */
export function HelpdeskBotScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const schoolId = useSchoolId();
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    getOrCreateBotConversation(schoolId)
      .then((conversation) => {
        if (cancelled) return;
        navigation.replace('ConversationThread', { conversationId: conversation.id, title: t('helpdeskBot.title') });
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.message : (e as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [schoolId, navigation, t, retryToken]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('helpdeskBot.title')} onBack={() => navigation.goBack()} />
      <View style={styles.center}>
        {error ? (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => setRetryToken((n) => n + 1)}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={colors.primary} size="large" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  errorText: { color: colors.error, fontSize: 15, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  retryText: { color: colors.white, fontWeight: '700' },
});
