import type { BotAction, Message } from '../api/types';

/**
 * Pure helpers for a conversation's message list: frames from the socket, history pages from REST
 * and helpdesk-bot card updates all go through these, so a frame that arrives twice (or a refetch
 * that overlaps what the socket already delivered) never shows twice, and an older card state never
 * overwrites a newer one.
 */

function time(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Oldest first, by `sentAt`, then by id so two messages from the same moment keep one order. */
export function compareMessages(a: Message, b: Message): number {
  const byTime = time(a.sentAt) - time(b.sentAt);
  if (byTime !== 0) return byTime;
  if (a.sentAt !== b.sentAt) return a.sentAt < b.sentAt ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/** The newer of two states of one card: the higher `version`, the one already held on a tie. */
export function newerAction(
  current: BotAction | null | undefined,
  incoming: BotAction | null | undefined
): BotAction | null | undefined {
  if (!current) return incoming ?? current;
  if (!incoming) return current;
  return incoming.version > current.version ? incoming : current;
}

function sameMessage(a: Message, b: Message): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)] as (keyof Message)[]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function insertSorted(list: Message[], msg: Message): Message[] {
  let at = list.length;
  while (at > 0 && compareMessages(list[at - 1], msg) > 0) at -= 1;
  return [...list.slice(0, at), msg, ...list.slice(at)];
}

/** When an S3 presigned link stops working (its X-Amz-Date plus X-Amz-Expires), or null if it doesn't say. */
export function presignedUrlExpiresAt(url: string): number | null {
  const signed = /[?&]X-Amz-Date=(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z(?:&|$)/.exec(url);
  const expires = /[?&]X-Amz-Expires=(\d+)(?:&|$)/.exec(url);
  if (!signed || !expires) return null;
  const [, year, month, day, hour, minute, second] = signed;
  const signedAt = Date.parse(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
  if (Number.isNaN(signedAt)) return null;
  return signedAt + Number(expires[1]) * 1000;
}

/** A kept attachment link is swapped for the newly signed one when it has less than this left. */
export const ATTACHMENT_URL_REFRESH_MARGIN_MS = 10 * 60_000;

/**
 * The attachment link a message keeps when it arrives again (a frame, a refetch). The server signs
 * a new S3 link on every read, so each refetch brings a different URL for the same file; taking it
 * would make every image in the list download again and flicker. The link already shown is kept
 * while it points at the same file and has more than ATTACHMENT_URL_REFRESH_MARGIN_MS left (or
 * doesn't say when it expires); otherwise the new one is taken, so a chat left open for an hour
 * still opens its files.
 */
export function keptAttachmentUrl(existing: string, incoming: string, nowMs: number): string {
  if (existing === incoming) return existing;
  const sameFile = existing.split('?')[0] === incoming.split('?')[0];
  if (!sameFile) return incoming;
  const expiresAt = presignedUrlExpiresAt(existing);
  if (expiresAt !== null && expiresAt - nowMs <= ATTACHMENT_URL_REFRESH_MARGIN_MS) return incoming;
  return existing;
}

/**
 * Adds `msg` to a list sorted oldest first, or merges it into the message with the same id. When
 * both carry a card, the higher `version` is kept, and a still-valid attachment link is kept (see
 * keptAttachmentUrl; `nowMs` is the time it's judged at). Returns the same list when nothing
 * changed (an identical duplicate frame, or a refetch with only newly signed links), so React
 * doesn't re-render for it.
 */
export function upsertMessage(list: Message[], msg: Message, nowMs: number = Date.now()): Message[] {
  const index = list.findIndex((m) => m.id === msg.id);
  if (index < 0) return insertSorted(list, msg);

  const existing = list[index];
  const merged: Message = { ...existing, ...msg };
  // Only when one of them has the key: an added `action: undefined` would make an older server's
  // message look like a newer server's (see supportsBotActions).
  if ('action' in existing || 'action' in msg) merged.action = newerAction(existing.action, msg.action);
  if (existing.attachmentUrl && msg.attachmentUrl) {
    merged.attachmentUrl = keptAttachmentUrl(existing.attachmentUrl, msg.attachmentUrl, nowMs);
  }
  if (sameMessage(existing, merged)) return list;

  const without = [...list.slice(0, index), ...list.slice(index + 1)];
  if (merged.sentAt === existing.sentAt) {
    return [...without.slice(0, index), merged, ...without.slice(index)];
  }
  return insertSorted(without, merged);
}

/**
 * Puts a card's new state (from a confirm or cancel answer) on the message that shows it, unless
 * that message already holds the same or a newer version. A card for a message not in the list is
 * ignored - the next refetch brings the message with its card.
 */
export function applyActionUpdate(list: Message[], action: BotAction): Message[] {
  const index = list.findIndex((m) => m.id === action.messageId);
  if (index < 0) return list;
  const existing = list[index];
  if (existing.action && existing.action.version >= action.version) return list;
  return [...list.slice(0, index), { ...existing, action }, ...list.slice(index + 1)];
}

/** Every message of a history page, merged in by id (used for the first load and every refetch). */
export function mergeHistoryPage(list: Message[], page: Message[], nowMs: number = Date.now()): Message[] {
  return page.reduce((merged, msg) => upsertMessage(merged, msg, nowMs), list);
}

/** The messages of `page` that `list` doesn't have yet. */
export function newMessages(list: Message[], page: Message[]): Message[] {
  const known = new Set(list.map((m) => m.id));
  const seen = new Set<string>();
  return page.filter((m) => {
    if (known.has(m.id) || seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * The text a message shows. When a card is drawn, the plain-text footer the server appended for
 * older apps ("Reply CONFIRM K7QX4 to save…") is hidden - but only when the content ends with it
 * exactly, so nothing else is ever cut.
 */
export function visibleContent(msg: Message): string {
  const content = msg.content ?? '';
  const footer = msg.action?.footer;
  if (footer && content.endsWith(footer)) return content.slice(0, content.length - footer.length);
  return content;
}

/**
 * Whether the server that sent `msg` knows bot actions: it always writes the `action` key, null
 * when there is no card. An older server leaves the key out and would refuse a subscription to the
 * updates destination.
 */
export function supportsBotActions(msg: Message | null | undefined): boolean {
  return !!msg && typeof msg === 'object' && 'action' in msg;
}

/** How long "typing…" shows after sending to the helpdesk bot if no reply arrives. */
export const BOT_TYPING_TIMEOUT_MS = 90_000;

/** When the user last sent something the bot hasn't answered yet; `since: null` when nothing is pending. */
export interface TypingState {
  since: number | null;
}

export const NOT_TYPING: TypingState = { since: null };

/** The user just sent a message to the bot. */
export function startTyping(now: number): TypingState {
  return { since: now };
}

/** A message that is new to the list arrived (from a frame or a refetch): a bot message ends "typing…". */
export function onIncoming(state: TypingState, msg: Message): TypingState {
  if (state.since === null || msg.senderKind !== 'BOT') return state;
  return NOT_TYPING;
}

/** Whether "typing…" shows now: something was sent, no bot message came, and it hasn't timed out. */
export function isTyping(state: TypingState, now: number, timeoutMs: number = BOT_TYPING_TIMEOUT_MS): boolean {
  return state.since !== null && now - state.since < timeoutMs;
}

/**
 * The 90 s timer armed for the send at `armedSince` fired: "typing…" ends, unless a newer send
 * restarted it (that send armed its own timer). It doesn't read the clock again, so a timer that
 * fires a millisecond early, or a phone clock moved back meanwhile, can't leave "typing…" showing
 * with no timer left to end it.
 */
export function onTypingTimeout(state: TypingState, armedSince: number | null): TypingState {
  return state.since !== null && state.since === armedSince ? NOT_TYPING : state;
}
