import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';

import { BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';
import type { Announcement, Message } from './types';

const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

let client: Client | null = null;
let connecting: Promise<Client> | null = null;
const subscriptions = new Map<string, StompSubscription>();

/** Exported so callSocket.ts can share this one connection instead of opening a second WebSocket. */
export function ensureClient(schoolId: string): Promise<Client> {
  if (client && client.active) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
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

export async function subscribeToConversation(
  schoolId: string,
  conversationId: string,
  onMessage: (message: Message) => void
): Promise<() => void> {
  const activeClient = await ensureClient(schoolId);
  const destination = `/topic/conversations/${conversationId}`;

  subscriptions.get(destination)?.unsubscribe();
  const subscription = activeClient.subscribe(destination, (frame: IMessage) => {
    onMessage(JSON.parse(frame.body) as Message);
  });
  subscriptions.set(destination, subscription);

  return () => {
    subscription.unsubscribe();
    subscriptions.delete(destination);
  };
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

async function subscribeToDestination(
  schoolId: string,
  destination: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  const activeClient = await ensureClient(schoolId);

  subscriptions.get(destination)?.unsubscribe();
  const subscription = activeClient.subscribe(destination, (frame: IMessage) => {
    onAnnouncement(JSON.parse(frame.body) as Announcement);
  });
  subscriptions.set(destination, subscription);

  return () => {
    subscription.unsubscribe();
    subscriptions.delete(destination);
  };
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
  subscriptions.forEach((sub) => sub.unsubscribe());
  subscriptions.clear();
  client?.deactivate();
  client = null;
}
