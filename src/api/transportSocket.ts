import type { IMessage } from '@stomp/stompjs';

import { ensureClient } from './chatSocket';
import type { BusLocation } from './types';

/**
 * Live bus position for one trip, over the shared STOMP connection (see chatSocket.ts). The server
 * only lets the trip's driver, an admin, or the family of a child on board subscribe.
 */
export async function subscribeToBusLocation(
  schoolId: string,
  tripId: string,
  onLocation: (location: BusLocation) => void
): Promise<() => void> {
  const activeClient = await ensureClient(schoolId);
  const subscription = activeClient.subscribe(`/topic/transport/trips/${tripId}`, (frame: IMessage) => {
    onLocation(JSON.parse(frame.body) as BusLocation);
  });
  return () => subscription.unsubscribe();
}
