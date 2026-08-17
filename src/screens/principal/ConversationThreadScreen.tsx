import { FontAwesome5 } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getConversationMessages, presignChatAttachment } from '../../api/chat';
import { sendMessage, subscribeToConversation } from '../../api/chatSocket';
import type { Message } from '../../api/types';
import { markConversationRead } from '../../api/unreadStore';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../context/AuthContext';
import { useSchoolId } from '../../context/SchoolContext';
import { useToast } from '../../context/ToastContext';
import { colors, radius, spacing } from '../../theme/colors';
import type { PrincipalStackParamList } from '../../types/principal';

type Props = NativeStackScreenProps<PrincipalStackParamList, 'ConversationThread'>;

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function uploadFile(uploadUrl: string, uri: string, contentType: string) {
  const file = await fetch(uri);
  const blob = await file.blob();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!put.ok) throw new Error('Attachment upload failed');
}

export function ConversationThreadScreen({ route, navigation }: Props) {
  const { conversationId, title } = route.params;
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
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
    if (!content || sending) return;
    setDraft('');
    setSending(true);
    try {
      await sendMessage(session.token, schoolId, conversationId, content);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const uploadAndSend = async (uri: string, fileName: string, contentType: string, fileSizeBytes: number) => {
    if (fileSizeBytes > MAX_ATTACHMENT_BYTES) {
      setError('That file is too large - attachments are limited to 10MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const presigned = await presignChatAttachment(schoolId, conversationId, {
        fileName,
        contentType,
        fileSizeBytes,
      });
      await uploadFile(presigned.uploadUrl, uri, contentType);
      await sendMessage(session.token, schoolId, conversationId, draft.trim(), {
        attachmentObjectKey: presigned.objectKey,
        attachmentContentType: contentType,
        attachmentFileName: fileName,
      });
      setDraft('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const fileName = asset.fileName ?? `photo-${Date.now()}.jpg`;
    const contentType = asset.mimeType ?? 'image/jpeg';
    const fileSizeBytes = asset.fileSize ?? 0;
    await uploadAndSend(asset.uri, fileName, contentType, fileSizeBytes);
  };

  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const contentType = asset.mimeType ?? 'application/pdf';
    const fileSizeBytes = asset.size ?? 0;
    await uploadAndSend(asset.uri, asset.name, contentType, fileSizeBytes);
  };

  const handleCopy = async (content: string) => {
    await Clipboard.setStringAsync(content);
    showToast('Copied to clipboard', 'success');
  };

  const handleAttach = () => {
    Alert.alert('Add attachment', undefined, [
      { text: 'Photo', onPress: handlePickImage },
      { text: 'PDF document', onPress: handlePickDocument },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: Message }) => {
    const isMine = item.senderOwnerId === session.ownerId;
    const isBot = item.senderKind === 'BOT';
    const isImage = item.attachmentContentType?.startsWith('image/');
    return (
      <View style={[styles.bubbleRow, isMine && styles.bubbleRowMine]}>
        <Pressable
          onLongPress={() => item.content && handleCopy(item.content)}
          style={[styles.bubble, isMine ? styles.bubbleMine : isBot ? styles.bubbleBot : styles.bubbleTheirs]}
        >
          {item.attachmentUrl && isImage && (
            <Pressable onPress={() => Linking.openURL(item.attachmentUrl!)}>
              <Image source={{ uri: item.attachmentUrl }} style={styles.attachmentImage} resizeMode="cover" />
            </Pressable>
          )}
          {item.attachmentUrl && !isImage && (
            <Pressable style={styles.fileChip} onPress={() => Linking.openURL(item.attachmentUrl!)}>
              <FontAwesome5 name="file-pdf" size={16} color={isMine ? colors.white : colors.primary} />
              <Text style={[styles.fileChipText, isMine && styles.bubbleTextMine]} numberOfLines={1}>
                {item.attachmentFileName ?? 'Attachment'}
              </Text>
            </Pressable>
          )}
          {item.content ? (
            <Text
              selectable
              style={[styles.bubbleText, isMine && styles.bubbleTextMine, item.attachmentUrl && styles.bubbleTextWithAttachment]}
            >
              {item.content}
            </Text>
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
        <Pressable style={styles.attachButton} onPress={handleAttach} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            <FontAwesome5 name="paperclip" size={18} color={colors.primary} />
          )}
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable style={styles.sendButton} onPress={handleSend} disabled={uploading || sending}>
          {sending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.sendButtonText}>Send</Text>}
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
  bubbleTextWithAttachment: { marginTop: spacing.xs },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  fileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    maxWidth: 220,
  },
  fileChipText: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
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
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
