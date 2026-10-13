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

  it('shares one subscription between callbacks for the same destination, until the last one goes', () => {
    const registry = createSubscriptionRegistry();
    const conn = fakeClient();
    const got: string[] = [];
    // Two screens for the same conversation (a push tap stacked a second copy of the chat).
    const stopOld = registry.add('/topic/conversations/c1', (frame) => got.push(`old:${frame.body}`), conn.client);
    const stopNew = registry.add('/topic/conversations/c1', (frame) => got.push(`new:${frame.body}`), conn.client);
    expect(conn.calls()).toBe(1);
    conn.deliver('/topic/conversations/c1', 'a');
    expect(got).toEqual(['old:a', 'new:a']);

    // The newer screen closes: the older one still gets frames, and nothing was unsubscribed.
    stopNew();
    stopNew();
    conn.deliver('/topic/conversations/c1', 'b');
    expect(got).toEqual(['old:a', 'new:a', 'old:b']);
    expect(conn.unsubscribed).toEqual([]);

    // ...and after a reconnect, one subscription again delivers to it.
    const second = fakeClient();
    registry.resubscribeAll(second.client);
    expect(second.calls()).toBe(1);
    second.deliver('/topic/conversations/c1', 'c');
    expect(got).toEqual(['old:a', 'new:a', 'old:b', 'old:c']);

    stopOld();
    expect(second.unsubscribed).toEqual(['/topic/conversations/c1']);
    expect(registry.destinations()).toEqual([]);
  });

  it('gives a frame to every callback even when one throws, then rethrows', () => {
    const registry = createSubscriptionRegistry();
    const conn = fakeClient();
    const got: string[] = [];
    registry.add(
      '/topic/conversations/c1',
      () => {
        throw new SyntaxError('bad JSON');
      },
      conn.client
    );
    registry.add('/topic/conversations/c1', (frame) => got.push(frame.body), conn.client);
    expect(() => conn.deliver('/topic/conversations/c1', 'x')).toThrow('bad JSON');
    expect(got).toEqual(['x']);
  });

  it('drops guarded destinations on request, tells their owners, and does not send them again', () => {
    const registry = createSubscriptionRegistry();
    const conn = fakeClient();
    const dropped: string[] = [];
    registry.add('/topic/conversations/c1', () => {}, conn.client);
    const stopUpdates = registry.add('/topic/conversations/c1/updates', () => {}, conn.client, {
      guarded: true,
      onDropped: () => dropped.push('updates'),
    });

    // An older server refused /updates with an ERROR frame.
    expect(registry.dropGuarded()).toEqual(['/topic/conversations/c1/updates']);
    expect(dropped).toEqual(['updates']);
    expect(registry.destinations()).toEqual(['/topic/conversations/c1']);

    const next = fakeClient();
    registry.resubscribeAll(next.client);
    expect([...next.live.keys()]).toEqual(['/topic/conversations/c1']);

    // The owner's own unsubscribe afterwards is a no-op, and a second drop finds nothing.
    expect(() => stopUpdates()).not.toThrow();
    expect(registry.dropGuarded()).toEqual([]);
    expect(dropped).toEqual(['updates']);

    // Subscribing again later (the owner re-checked the server) works as usual.
    registry.add('/topic/conversations/c1/updates', () => {}, next.client, { guarded: true });
    expect([...next.live.keys()].sort()).toEqual(['/topic/conversations/c1', '/topic/conversations/c1/updates']);
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
