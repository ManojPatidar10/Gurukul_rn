import { Client, type IMessage, type StompSubscription } from '@stomp/stompjs';

import { BASE_URL } from './client';
import type { Message } from './types';

const WS_URL = BASE_URL.replace(/^http/, 'ws') + '/ws/websocket';

let client: Client | null = null;
let connecting: Promise<Client> | null = null;
const subscriptions = new Map<string, StompSubscription>();

function ensureClient(token: string, schoolId: string): Promise<Client> {
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

export function disconnectChatSocket() {
  subscriptions.forEach((sub) => sub.unsubscribe());
  subscriptions.clear();
  client?.deactivate();
  client = null;
}
