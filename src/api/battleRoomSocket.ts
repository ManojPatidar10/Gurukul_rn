import type { IMessage, StompSubscription } from '@stomp/stompjs';

import { ensureClient } from './chatSocket';
import type { BattleRoomState } from './types';

const subscriptions = new Map<string, StompSubscription>();

/** Reuses the same shared STOMP connection as chatSocket.ts rather than opening a second WebSocket. */
export async function subscribeToBattleRoom(
  token: string,
  schoolId: string,
  roomId: string,
  onState: (state: BattleRoomState) => void
): Promise<() => void> {
  const activeClient = await ensureClient(token, schoolId);
  const destination = `/topic/battle-rooms/${roomId}`;

  subscriptions.get(destination)?.unsubscribe();
  const subscription = activeClient.subscribe(destination, (frame: IMessage) => {
    onState(JSON.parse(frame.body) as BattleRoomState);
  });
  subscriptions.set(destination, subscription);

  return () => {
    subscription.unsubscribe();
    subscriptions.delete(destination);
  };
}

export async function sendBuzz(token: string, schoolId: string, roomId: string) {
  const activeClient = await ensureClient(token, schoolId);
  activeClient.publish({ destination: `/app/battle-rooms/${roomId}/buzz`, body: '' });
}

export async function sendBattleAnswer(
  token: string,
  schoolId: string,
  roomId: string,
  selectedOption: 'A' | 'B' | 'C' | 'D'
) {
  const activeClient = await ensureClient(token, schoolId);
  activeClient.publish({
    destination: `/app/battle-rooms/${roomId}/answer`,
    body: JSON.stringify({ selectedOption }),
  });
}
