import type { IMessage, StompSubscription } from '@stomp/stompjs';

import { ensureClient } from './chatSocket';
import type { CallEvent, OwnerType } from './types';

const subscriptions = new Map<string, StompSubscription>();

/**
 * Subscribes to the caller's own personal call-events topic (see CallEventPublisher /
 * StompSubscribeAuthorizationInterceptor on the backend - the school/ownerType/ownerId in the
 * path must exactly match the authenticated principal). Reuses the same shared STOMP connection
 * as chatSocket.ts rather than opening a second WebSocket.
 */
export async function subscribeToMyCallEvents(
  token: string,
  schoolId: string,
  ownerType: OwnerType,
  ownerId: string,
  onEvent: (event: CallEvent) => void
): Promise<() => void> {
  const activeClient = await ensureClient(token, schoolId);
  const destination = `/topic/users/${schoolId}/${ownerType}/${ownerId}/calls`;

  subscriptions.get(destination)?.unsubscribe();
  const subscription = activeClient.subscribe(destination, (frame: IMessage) => {
    onEvent(JSON.parse(frame.body) as CallEvent);
  });
  subscriptions.set(destination, subscription);

  return () => {
    subscription.unsubscribe();
    subscriptions.delete(destination);
  };
}
