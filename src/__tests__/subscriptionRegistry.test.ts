import type { IMessage } from '@stomp/stompjs';

import { createSubscriptionRegistry, type SubscribingClient } from '../api/subscriptionRegistry';

/** A stand-in for one stompjs connection: records what was subscribed and delivers frames. */
function fakeClient(connected = true) {
  const live = new Map<string, (frame: IMessage) => void>();
  const unsubscribed: string[] = [];
  let calls = 0;
  const client: { connected: boolean; subscribe: SubscribingClient['subscribe'] } = {
    connected,
    subscribe(destination, callback) {
      calls += 1;
      live.set(destination, callback);
      return {
        unsubscribe() {
          unsubscribed.push(destination);
          live.delete(destination);
        },
      };
    },
  };
  const deliver = (destination: string, body: string) => live.get(destination)?.({ body } as IMessage);
  return { client, live, unsubscribed, deliver, calls: () => calls };
}

describe('createSubscriptionRegistry', () => {
  it('subscribes straight away on a connected client', () => {
    const registry = createSubscriptionRegistry();
    const conn = fakeClient();
    const received: string[] = [];
    registry.add('/topic/conversations/c1', (frame) => received.push(frame.body), conn.client);
    conn.deliver('/topic/conversations/c1', 'hello');
    expect(received).toEqual(['hello']);
    expect(registry.destinations()).toEqual(['/topic/conversations/c1']);
  });

  it('subscribes every kept destination with its own callback again after a reconnect', () => {
    const registry = createSubscriptionRegistry();
    const first = fakeClient();
    const got: string[] = [];
    registry.add('/topic/conversations/c1', (frame) => got.push(`messages:${frame.body}`), first.client);
    registry.add('/topic/conversations/c1/updates', (frame) => got.push(`updates:${frame.body}`), first.client);

    // The socket dropped; stompjs's next connection has no subscriptions until they are made again.
    const second = fakeClient();
    registry.resubscribeAll(second.client);
    expect([...second.live.keys()].sort()).toEqual(['/topic/conversations/c1', '/topic/conversations/c1/updates']);
    second.deliver('/topic/conversations/c1', 'a');
    second.deliver('/topic/conversations/c1/updates', 'b');
    expect(got).toEqual(['messages:a', 'updates:b']);
    // The old connection's handles were replaced, not unsubscribed through the dead socket.
    expect(first.unsubscribed).toEqual([]);
  });

  it('unsubscribes with the newest handle, and a removed destination is not subscribed again', () => {
    const registry = createSubscriptionRegistry();
    const first = fakeClient();
    const stop = registry.add('/topic/conversations/c1', () => {}, first.client);
    registry.add('/topic/schools/s1/announcements', () => {}, first.client);

    const second = fakeClient();
    registry.resubscribeAll(second.client);
    stop();
    expect(second.unsubscribed).toEqual(['/topic/conversations/c1']);
    expect(registry.destinations()).toEqual(['/topic/schools/s1/announcements']);

    const third = fakeClient();
    registry.resubscribeAll(third.client);
    expect([...third.live.keys()]).toEqual(['/topic/schools/s1/announcements']);

    registry.remove('/topic/schools/s1/announcements');
    expect(third.unsubscribed).toEqual(['/topic/schools/s1/announcements']);
    const fourth = fakeClient();
    registry.resubscribeAll(fourth.client);
    expect(fourth.calls()).toBe(0);
  });

  it('waits for the next connect when the client is not connected yet', () => {
    const registry = createSubscriptionRegistry();
    const offline = fakeClient(false);
    registry.add('/topic/conversations/c1', () => {}, offline.client);
    expect(offline.calls()).toBe(0);
    offline.client.connected = true;
    registry.resubscribeAll(offline.client);
    expect([...offline.live.keys()]).toEqual(['/topic/conversations/c1']);
  });

  it('keeps one entry per destination, and an older unsubscribe leaves a newer one alone', () => {
    const registry = createSubscriptionRegistry();
    const conn = fakeClient();
    const got: string[] = [];
    const stopOld = registry.add('/topic/conversations/c1', () => got.push('old'), conn.client);
    registry.add('/topic/conversations/c1', () => got.push('new'), conn.client);
    stopOld();
    conn.deliver('/topic/conversations/c1', 'x');
    expect(got).toEqual(['new']);
    expect(registry.destinations()).toEqual(['/topic/conversations/c1']);
  });

  it('survives a handle or a client that throws because the connection is gone', () => {
    const registry = createSubscriptionRegistry();
    const broken: SubscribingClient = {
      connected: true,
      subscribe: () => {
        throw new TypeError('There is no underlying STOMP connection');
      },
    };
    expect(() => registry.add('/topic/conversations/c1', () => {}, broken)).not.toThrow();
    const conn = fakeClient();
    registry.resubscribeAll(conn.client);
    expect([...conn.live.keys()]).toEqual(['/topic/conversations/c1']);

    const throwingHandle: SubscribingClient = {
      connected: true,
      subscribe: () => ({
        unsubscribe: () => {
          throw new Error('socket closed');
        },
      }),
    };
    const stop = registry.add('/topic/conversations/c2', () => {}, throwingHandle);
    expect(() => stop()).not.toThrow();
    expect(() => registry.clear()).not.toThrow();
    expect(registry.destinations()).toEqual([]);
  });
});
