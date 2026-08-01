import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'gurukul.chat.lastRead.';

export async function getLastReadAt(conversationId: string): Promise<string | null> {
  return AsyncStorage.getItem(`${KEY_PREFIX}${conversationId}`);
}

export async function markConversationRead(conversationId: string, atIso: string): Promise<void> {
  await AsyncStorage.setItem(`${KEY_PREFIX}${conversationId}`, atIso);
}
