import type { IMessage } from '@stomp/stompjs';

/** The part of a stompjs Client the registry uses, so tests can pass a fake. */
export interface SubscribingClient {
  readonly connected: boolean;
  subscribe(destination: string, callback: (frame: IMessage) => void): { unsubscribe(): void };
}

export type FrameCallback = (frame: IMessage) => void;

export interface AddOptions {
  /**
   * A destination an older server may refuse (it answers with an ERROR frame and closes the socket).
   * dropGuarded() forgets it, so a refused destination isn't sent again on every reconnect.
   */
  guarded?: boolean;
  /** Called when dropGuarded() forgets this callback's destination. */
  onDropped?: () => void;
}

interface Listener {
  callback: FrameCallback;
  guarded: boolean;
  onDropped?: () => void;
}

interface Entry {
  destination: string;
  listeners: Set<Listener>;
  handle: { unsubscribe(): void } | null;
}

export interface SubscriptionRegistry {
  /**
   * Keeps `callback` for `destination` and subscribes now when `client` is connected; otherwise the
   * next connect subscribes it. Several callbacks can share a destination (two screens for the same
   * conversation, e.g. a push tap that opened the chat again): there is one STOMP subscription per
   * destination, and every frame goes to all of them. Returns a function that removes this callback
   * only; the destination is unsubscribed when its last callback goes.
   */
  add(
    destination: string,
    callback: FrameCallback,
    client?: SubscribingClient | null,
    options?: AddOptions
  ): () => void;
  /** Unsubscribes and forgets `destination`, with every callback kept for it. */
  remove(destination: string): void;
  /**
   * Subscribes every kept destination on `client`. Called on every (re)connect: stompjs keeps
   * subscriptions per connection, so after a reconnect nothing arrives until this runs. The old
   * handles belonged to the dropped connection and are just replaced.
   */
  resubscribeAll(client: SubscribingClient): void;
  /**
   * Forgets every guarded destination (one with a guarded callback) and calls their callbacks'
   * `onDropped`. Called on a STOMP ERROR: if the server refused one of them, sending it again on the
   * reconnect would fail the same way, again and again. Returns the destinations it forgot.
   */
  dropGuarded(): string[];
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

/** Gives the frame to every callback, even when one of them throws; the first error is rethrown. */
function deliver(entry: Entry, frame: IMessage) {
  let failure: { error: unknown } | null = null;
  for (const listener of [...entry.listeners]) {
    try {
      listener.callback(frame);
    } catch (error) {
      failure ??= { error };
    }
  }
  if (failure) throw failure.error;
}

function subscribeEntry(entry: Entry, client: SubscribingClient) {
  try {
    entry.handle = client.subscribe(entry.destination, (frame) => deliver(entry, frame));
  } catch {
    // The connection dropped between the check and the call; the next connect subscribes it.
    entry.handle = null;
  }
}

/**
 * Every destination chatSocket.ts subscribes to, with its callbacks, so they can all be subscribed
 * again after the socket reconnects (Android drops it whenever the app is in the background).
 * Pure apart from the client calls it is handed, so it can be unit-tested.
 */
export function createSubscriptionRegistry(): SubscriptionRegistry {
  const entries = new Map<string, Entry>();

  const forget = (entry: Entry) => {
    entry.listeners.clear();
    if (entries.get(entry.destination) === entry) entries.delete(entry.destination);
    safeUnsubscribe(entry.handle);
    entry.handle = null;
  };

  return {
    add(destination, callback, client, options) {
      let entry = entries.get(destination);
      if (!entry) {
        entry = { destination, listeners: new Set(), handle: null };
        entries.set(destination, entry);
      }
      const listener: Listener = { callback, guarded: !!options?.guarded, onDropped: options?.onDropped };
      entry.listeners.add(listener);
      // A destination already subscribed on this connection delivers to the new callback too.
      if (!entry.handle && client?.connected) subscribeEntry(entry, client);
      const kept = entry;
      return () => {
        if (!kept.listeners.delete(listener)) return;
        if (kept.listeners.size === 0) forget(kept);
      };
    },
    remove(destination) {
      const entry = entries.get(destination);
      if (entry) forget(entry);
    },
    resubscribeAll(client) {
      for (const entry of entries.values()) subscribeEntry(entry, client);
    },
    dropGuarded() {
      const dropped: string[] = [];
      const notify: (() => void)[] = [];
      for (const entry of [...entries.values()]) {
        const listeners = [...entry.listeners];
        if (!listeners.some((l) => l.guarded)) continue;
        dropped.push(entry.destination);
        for (const l of listeners) if (l.onDropped) notify.push(l.onDropped);
        forget(entry);
      }
      for (const onDropped of notify) {
        try {
          onDropped();
        } catch {
          // One screen failing to react mustn't stop the others.
        }
      }
      return dropped;
    },
    clear() {
      for (const entry of [...entries.values()]) forget(entry);
    },
    destinations() {
      return [...entries.keys()];
    },
  };
}
