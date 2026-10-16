import { Client, type IMessage } from '@stomp/stompjs';

import { BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';
import { createSubscriptionRegistry, type AddOptions } from './subscriptionRegistry';
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
    // Whether the next connect is reported as a reconnect: this client connected before (frames sent
    // while it was down are lost), or an attempt failed (stompjs keeps retrying, and a screen that
    // loaded its history meanwhile missed whatever came before the subscriptions went through).
    let reportNextConnect = false;
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
        if (reportNextConnect) {
          // Frames sent while the socket was down are lost; listeners refetch what they show.
          reconnectListeners.forEach((listener) => {
            try {
              listener();
            } catch {
              // One screen's refetch failing mustn't stop the others.
            }
          });
        }
        reportNextConnect = true;
        resolve(next);
      },
      onStompError: (frame) => {
        connecting = null;
        reportNextConnect = true;
        // The server ends the session after an ERROR frame. If it refused a guarded destination (an
        // older server and /updates, see subscribeToConversationUpdates), subscribing it again on the
        // reconnect would fail the same way every 3 s, so it is forgotten; its screen checks the
        // server again and subscribes anew.
        registry.dropGuarded();
        reject(new Error(frame.headers['message'] ?? 'STOMP error'));
      },
      onWebSocketError: (event) => {
        connecting = null;
        reportNextConnect = true;
        reject(event as unknown as Error);
      },
    });
    client = next;
    next.activate();
  });
  return connecting;
}

/**
 * Calls `listener` after every reconnect of the shared socket, and after the first connect that
 * follows a failed attempt, once the kept subscriptions are back. Use it to refetch whatever may
 * have been sent while it was down. Returns a function that stops the calls.
 */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

export interface SubscribeOptions extends AddOptions {
  /**
   * The socket's connect attempt failed. The subscription stays: stompjs keeps retrying, and the
   * connect that succeeds subscribes it (and is reported to onReconnect listeners).
   */
  onError?: (error: unknown) => void;
}

/**
 * Subscribes through the registry: now when the socket is connected, otherwise on its next
 * connect, and again after every reconnect, until the returned function is called. It is kept even
 * when the first connect attempt fails, which is reported to `onError`.
 */
function subscribeKept(
  schoolId: string,
  destination: string,
  onFrame: (frame: IMessage) => void,
  { onError, ...options }: SubscribeOptions = {}
): () => void {
  // First, so `client` is the one whose next connect subscribes everything kept.
  ensureClient(schoolId).catch((error: unknown) => onError?.(error));
  return registry.add(destination, onFrame, client, options);
}

export function subscribeToConversation(
  schoolId: string,
  conversationId: string,
  onMessage: (message: Message) => void,
  options?: SubscribeOptions
): () => void {
  return subscribeKept(
    schoolId,
    `/topic/conversations/${conversationId}`,
    (frame) => {
      onMessage(JSON.parse(frame.body) as Message);
    },
    options
  );
}

/**
 * Updates to messages already sent in a conversation - today, a helpdesk-bot card changing state
 * (saved, cancelled, expired, replaced). Only a server with bot actions knows this destination; an
 * older one refuses it with an ERROR frame that ends the socket, so callers subscribe only once
 * they've seen a message with the `action` key (see supportsBotActions). It is guarded: a STOMP
 * ERROR forgets it and calls `onDropped` (the server may have been rolled back), and the caller
 * checks again before subscribing anew. Unknown frame types and unreadable frames are ignored.
 */
export function subscribeToConversationUpdates(
  schoolId: string,
  conversationId: string,
  onFrame: (frame: ChatUpdateFrame) => void,
  options?: Omit<SubscribeOptions, 'guarded'>
): () => void {
  return subscribeKept(
    schoolId,
    `/topic/conversations/${conversationId}/updates`,
    (frame) => {
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
    },
    { ...options, guarded: true }
  );
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
  onAnnouncement: (announcement: Announcement) => void,
  options?: SubscribeOptions
): () => void {
  return subscribeKept(
    schoolId,
    destination,
    (frame) => {
      onAnnouncement(JSON.parse(frame.body) as Announcement);
    },
    options
  );
}

export function subscribeToSchoolAnnouncements(
  schoolId: string,
  onAnnouncement: (announcement: Announcement) => void,
  options?: SubscribeOptions
): () => void {
  return subscribeToDestination(schoolId, `/topic/schools/${schoolId}/announcements`, onAnnouncement, options);
}

export function subscribeToSectionAnnouncements(
  schoolId: string,
  sectionId: string,
  onAnnouncement: (announcement: Announcement) => void,
  options?: SubscribeOptions
): () => void {
  return subscribeToDestination(schoolId, `/topic/sections/${sectionId}/announcements`, onAnnouncement, options);
}

/** className must have spaces replaced with underscores per the backend contract ("Grade 6" -> "Grade_6"). */
export function subscribeToGradeAnnouncements(
  schoolId: string,
  className: string,
  onAnnouncement: (announcement: Announcement) => void,
  options?: SubscribeOptions
): () => void {
  const encodedClassName = className.replace(/ /g, '_');
  return subscribeToDestination(
    schoolId,
    `/topic/schools/${schoolId}/classes/${encodedClassName}/announcements`,
    onAnnouncement,
    options
  );
}

export function disconnectChatSocket() {
  registry.clear();
  client?.deactivate();
  client = null;
}
