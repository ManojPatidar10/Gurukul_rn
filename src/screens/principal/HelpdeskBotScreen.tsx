import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getOrCreateBotConversation } from '../../api/chat';
import { useSchoolId } from '../../context/SchoolContext';
import { colors, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'HelpdeskBot'>;

export function HelpdeskBotScreen({ navigation }: Props) {
  const schoolId = useSchoolId();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateBotConversation(schoolId)
      .then((conversation) => {
        navigation.replace('ConversationThread', { conversationId: conversation.id, title: 'Helpdesk Bot' });
      })
      .catch((e) => setError((e as Error).message));
  }, [schoolId, navigation]);

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.error, padding: spacing.lg, textAlign: 'center' },
});
