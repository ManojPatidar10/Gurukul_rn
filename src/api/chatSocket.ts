import { Client, type IMessage } from '@stomp/stompjs';

import { BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';
import { createSubscriptionRegistry } from './subscriptionRegistry';
import type { Announcement, ChatUpdateFrame, Message } from './types';

const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

let client: Client | null = null;
let connecting: Promise<Client> | null = null;
/**
 * Every destination subscribed through this file, with its callback. stompjs forgets subscriptions
 * when the socket drops (Android drops it whenever the app is in the background) and reconnects on
 * its own, so onConnect subscribes all of them again - otherwise no frame would arrive until the
 * screen was reopened.
 */
const registry = createSubscriptionRegistry();
const reconnectListeners = new Set<() => void>();

/** Exported so callSocket.ts can share this one connection instead of opening a second WebSocket. */
export function ensureClient(schoolId: string): Promise<Client> {
  if (client && client.active) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
    // Whether this client has connected before, so a later connect is reported as a reconnect.
    let connectedBefore = false;
    const next = new Client({
      brokerURL: WS_URL,
      // Runs before the first connect and every automatic reconnect, so a reconnect after the
      // access token was silently refreshed (or after it expired while the app sat in the
      // background) authenticates with the current token, not the one from when this was created.
      beforeConnect: async () => {
        await ensureFreshAccessToken().catch(() => {});
        next.connectHeaders = {
          Authorization: `Bearer ${getAuthToken() ?? ''}`,
          'X-School-Id': schoolId,
        };
      },
      forceBinaryWSFrames: true,
      appendMissingNULLonIncoming: true,
      reconnectDelay: 3000,
      onConnect: () => {
        connecting = null;
        registry.resubscribeAll(next);
        if (connectedBefore) {
          // Frames sent while the socket was down are lost; listeners refetch what they show.
          reconnectListeners.forEach((listener) => {
            try {
              listener();
            } catch {
              // One screen's refetch failing mustn't stop the others.
            }
          });
        }
        connectedBefore = true;
        resolve(next);
      },
      onStompError: (frame) => {
        connecting = null;
        reject(new Error(frame.headers['message'] ?? 'STOMP error'));
      },
      onWebSocketError: (event) => {
        connecting = null;
        reject(event as unknown as Error);
      },
    });
    client = next;
    next.activate();
  });
  return connecting;
}

/**
 * Calls `listener` after every reconnect of the shared socket (not its first connect), once the
 * kept subscriptions are back. Use it to refetch whatever may have been sent while it was down.
 * Returns a function that stops the calls.
 */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

/**
 * Subscribes through the registry: now when the socket is connected, otherwise on its next
 * connect, and again after every reconnect, until the returned function is called.
 */
async function subscribeKept(
  schoolId: string,
  destination: string,
  onFrame: (frame: IMessage) => void
): Promise<() => void> {
  const activeClient = await ensureClient(schoolId);
  return registry.add(destination, onFrame, activeClient);
}

export function subscribeToConversation(
  schoolId: string,
  conversationId: string,
  onMessage: (message: Message) => void
): Promise<() => void> {
  return subscribeKept(schoolId, `/topic/conversations/${conversationId}`, (frame) => {
    onMessage(JSON.parse(frame.body) as Message);
  });
}

/**
 * Updates to messages already sent in a conversation - today, a helpdesk-bot card changing state
 * (saved, cancelled, expired, replaced). Only a server with bot actions knows this destination; an
 * older one refuses it with an ERROR frame that can end the socket, so callers subscribe only once
 * they've seen a message with the `action` key (see supportsBotActions). Unknown frame types and
 * unreadable frames are ignored.
 */
export function subscribeToConversationUpdates(
  schoolId: string,
  conversationId: string,
  onFrame: (frame: ChatUpdateFrame) => void
): Promise<() => void> {
  return subscribeKept(schoolId, `/topic/conversations/${conversationId}/updates`, (frame) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(frame.body);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const update = parsed as Partial<ChatUpdateFrame>;
    if (update.type !== 'MESSAGE_UPDATED' || !update.message || typeof update.message.id !== 'string') return;
    onFrame(update as ChatUpdateFrame);
  });
}

export interface SendMessageAttachment {
  attachmentObjectKey: string;
  attachmentContentType: string;
  attachmentFileName: string;
}

export async function sendMessage(
  schoolId: string,
  conversationId: string,
  content: string,
  attachment?: SendMessageAttachment
) {
  const activeClient = await ensureClient(schoolId);
  activeClient.publish({
    destination: `/app/conversations/${conversationId}/messages`,
    body: JSON.stringify({ content: content || undefined, ...attachment }),
  });
}

function subscribeToDestination(
  schoolId: string,
  destination: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  return subscribeKept(schoolId, destination, (frame) => {
    onAnnouncement(JSON.parse(frame.body) as Announcement);
  });
}

export function subscribeToSchoolAnnouncements(
  schoolId: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  return subscribeToDestination(schoolId, `/topic/schools/${schoolId}/announcements`, onAnnouncement);
}

export function subscribeToSectionAnnouncements(
  schoolId: string,
  sectionId: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  return subscribeToDestination(schoolId, `/topic/sections/${sectionId}/announcements`, onAnnouncement);
}

/** className must have spaces replaced with underscores per the backend contract ("Grade 6" -> "Grade_6"). */
export function subscribeToGradeAnnouncements(
  schoolId: string,
  className: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  const encodedClassName = className.replace(/ /g, '_');
  return subscribeToDestination(
    schoolId,
    `/topic/schools/${schoolId}/classes/${encodedClassName}/announcements`,
    onAnnouncement
  );
}

export function disconnectChatSocket() {
  registry.clear();
  client?.deactivate();
  client = null;
}
