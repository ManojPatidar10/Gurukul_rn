import type { IMessage } from '@stomp/stompjs';

/** The part of a stompjs Client the registry uses, so tests can pass a fake. */
export interface SubscribingClient {
  readonly connected: boolean;
  subscribe(destination: string, callback: (frame: IMessage) => void): { unsubscribe(): void };
}

export type FrameCallback = (frame: IMessage) => void;

interface Entry {
  destination: string;
  callback: FrameCallback;
  handle: { unsubscribe(): void } | null;
}

export interface SubscriptionRegistry {
  /**
   * Keeps `callback` for `destination` (replacing an earlier one for the same destination) and
   * subscribes now when `client` is connected; otherwise the next connect subscribes it. Returns a
   * function that unsubscribes and forgets this entry - it does nothing once a newer `add` for the
   * same destination has replaced it.
   */
  add(destination: string, callback: FrameCallback, client?: SubscribingClient | null): () => void;
  /** Unsubscribes and forgets whatever is kept for `destination`. */
  remove(destination: string): void;
  /**
   * Subscribes every kept destination on `client`. Called on every (re)connect: stompjs keeps
   * subscriptions per connection, so after a reconnect nothing arrives until this runs. The old
   * handles belonged to the dropped connection and are just replaced.
   */
  resubscribeAll(client: SubscribingClient): void;
  /** Unsubscribes and forgets everything. */
  clear(): void;
  destinations(): string[];
}

function safeUnsubscribe(handle: { unsubscribe(): void } | null) {
  try {
    handle?.unsubscribe();
  } catch {
    // The handle's connection is already gone (it dropped, or a reconnect is under way); the
    // server forgot the subscription with it.
  }
}

function subscribeEntry(entry: Entry, client: SubscribingClient) {
  try {
    entry.handle = client.subscribe(entry.destination, entry.callback);
  } catch {
    // The connection dropped between the check and the call; the next connect subscribes it.
    entry.handle = null;
  }
}

/**
 * Every destination chatSocket.ts subscribes to, with its callback, so they can all be subscribed
 * again after the socket reconnects (Android drops it whenever the app is in the background).
 * Pure apart from the client calls it is handed, so it can be unit-tested.
 */
export function createSubscriptionRegistry(): SubscriptionRegistry {
  const entries = new Map<string, Entry>();

  const forget = (entry: Entry) => {
    if (entries.get(entry.destination) !== entry) return;
    entries.delete(entry.destination);
    safeUnsubscribe(entry.handle);
    entry.handle = null;
  };

  return {
    add(destination, callback, client) {
      const previous = entries.get(destination);
      if (previous) forget(previous);
      const entry: Entry = { destination, callback, handle: null };
      entries.set(destination, entry);
      if (client?.connected) subscribeEntry(entry, client);
      return () => forget(entry);
    },
    remove(destination) {
      const entry = entries.get(destination);
      if (entry) forget(entry);
    },
    resubscribeAll(client) {
      for (const entry of entries.values()) subscribeEntry(entry, client);
    },
    clear() {
      for (const entry of [...entries.values()]) forget(entry);
    },
    destinations() {
      return [...entries.keys()];
    },
  };
}
