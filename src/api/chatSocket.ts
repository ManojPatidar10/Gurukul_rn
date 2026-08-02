import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';

import { BASE_URL } from './client';
import type { Announcement, Message } from './types';

const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

let client: Client | null = null;
let connecting: Promise<Client> | null = null;
const subscriptions = new Map<string, StompSubscription>();

/** Exported so callSocket.ts can share this one connection instead of opening a second WebSocket. */
export function ensureClient(token: string, schoolId: string): Promise<Client> {
  if (client && client.active) return Promise.resolve(client);
  if (connecting) return connecting;

  connecting = new Promise((resolve, reject) => {
    const next = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
        'X-School-Id': schoolId,
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
  token: string,
  schoolId: string,
  conversationId: string,
  onMessage: (message: Message) => void
): Promise<() => void> {
  const activeClient = await ensureClient(token, schoolId);
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

export async function sendMessage(token: string, schoolId: string, conversationId: string, content: string) {
  const activeClient = await ensureClient(token, schoolId);
  activeClient.publish({
    destination: `/app/conversations/${conversationId}/messages`,
    body: JSON.stringify({ content }),
  });
}

async function subscribeToDestination(
  token: string,
  schoolId: string,
  destination: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  const activeClient = await ensureClient(token, schoolId);

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
  token: string,
  schoolId: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  return subscribeToDestination(token, schoolId, `/topic/schools/${schoolId}/announcements`, onAnnouncement);
}

export function subscribeToSectionAnnouncements(
  token: string,
  schoolId: string,
  sectionId: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  return subscribeToDestination(token, schoolId, `/topic/sections/${sectionId}/announcements`, onAnnouncement);
}

/** className must have spaces replaced with underscores per the backend contract ("Grade 6" -> "Grade_6"). */
export function subscribeToGradeAnnouncements(
  token: string,
  schoolId: string,
  className: string,
  onAnnouncement: (announcement: Announcement) => void
): Promise<() => void> {
  const encodedClassName = className.replace(/ /g, '_');
  return subscribeToDestination(
    token,
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
