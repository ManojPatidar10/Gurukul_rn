import type { BotAction, Message } from '../api/types';
import {
  BOT_TYPING_TIMEOUT_MS,
  NOT_TYPING,
  applyActionUpdate,
  compareMessages,
  isTyping,
  keptAttachmentUrl,
  mergeHistoryPage,
  newMessages,
  onIncoming,
  onTypingTimeout,
  presignedUrlExpiresAt,
  startTyping,
  supportsBotActions,
  upsertMessage,
  visibleContent,
} from '../utils/chatMessages';

const FOOTER =
  '\n\n----------\nWaiting for your OK (code K7QX4):\n1. Wed 14 Oct, period 3: Ravi Kumar takes Maths instead of Sunita Sharma.\n' +
  'Reply CONFIRM K7QX4 to save, or CANCEL K7QX4. Expires in 15 minutes.\n' +
  'सेव करने के लिए CONFIRM K7QX4 लिखें, रद्द करने के लिए CANCEL K7QX4 लिखें।';

/** A message as a server with bot actions sends it: the `action` key is always there. */
function msg(id: string, sentAt: string, extra: Partial<Message> = {}): Message {
  return {
    id,
    senderKind: 'HUMAN',
    senderOwnerType: 'EMPLOYEE',
    senderOwnerId: 'admin1',
    content: `message ${id}`,
    sentAt,
    attachmentUrl: null,
    attachmentContentType: null,
    attachmentFileName: null,
    action: null,
    ...extra,
  };
}

function action(version: number, extra: Partial<BotAction> = {}): BotAction {
  return {
    id: 'act1',
    messageId: 'm2',
    conversationId: 'c1',
    code: 'K7QX4',
    type: 'TIMETABLE_CHANGES',
    status: 'PENDING',
    changeCount: 1,
    title: '1 timetable change',
    items: [],
    reason: null,
    requestedByOwnerType: 'EMPLOYEE',
    requestedByOwnerId: 'admin1',
    createdAt: '2026-10-13T05:10:02Z',
    expiresAt: '2026-10-13T05:25:10Z',
    decidedAt: null,
    failureCode: null,
    failureReason: null,
    footer: FOOTER,
    version,
    serverTime: '2026-10-13T05:10:12Z',
    ...extra,
  };
}

function botMsg(id: string, sentAt: string, extra: Partial<Message> = {}): Message {
  return msg(id, sentAt, { senderKind: 'BOT', senderOwnerType: null, senderOwnerId: null, ...extra });
}

const ids = (list: Message[]) => list.map((m) => m.id);

/** A link like the server's S3 presigner makes: signed at `amzDate`, valid for an hour. */
function s3Url(amzDate: string, signature: string, key = 'a.jpg') {
  return (
    `https://bucket.s3.ap-south-1.amazonaws.com/chat-attachments/s1/c1/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256` +
    `&X-Amz-Date=${amzDate}&X-Amz-SignedHeaders=host&X-Amz-Expires=3600&X-Amz-Signature=${signature}`
  );
}

describe('upsertMessage', () => {
  it('inserts new messages in time order, whatever order they arrive in', () => {
    let list: Message[] = [];
    list = upsertMessage(list, msg('b', '2026-10-13T05:10:00Z'));
    list = upsertMessage(list, msg('c', '2026-10-13T05:11:00Z'));
    list = upsertMessage(list, msg('a', '2026-10-13T05:09:00Z'));
    expect(ids(list)).toEqual(['a', 'b', 'c']);
  });

  it('orders by the instant, not the text, when fractions of a second differ', () => {
    const list = upsertMessage([msg('early', '2026-10-13T05:10:00Z')], msg('late', '2026-10-13T05:10:00.500Z'));
    expect(ids(list)).toEqual(['early', 'late']);
    // The same moment: by id, so every device shows one order.
    expect(compareMessages(msg('x', '2026-10-13T05:10:00Z'), msg('y', '2026-10-13T05:10:00Z'))).toBeLessThan(0);
  });

  it('ignores an identical duplicate frame and returns the same list', () => {
    const list = [msg('a', '2026-10-13T05:09:00Z'), msg('b', '2026-10-13T05:10:00Z')];
    const again = upsertMessage(list, { ...list[1] });
    expect(again).toBe(list);
  });

  it('replaces the fields of a message it already has', () => {
    const list = [msg('a', '2026-10-13T05:09:00Z', { attachmentUrl: 'https://old' }), msg('b', '2026-10-13T05:10:00Z')];
    const next = upsertMessage(list, msg('a', '2026-10-13T05:09:00Z', { attachmentUrl: 'https://new' }));
    expect(ids(next)).toEqual(['a', 'b']);
    expect(next[0].attachmentUrl).toBe('https://new');
    expect(list[0].attachmentUrl).toBe('https://old');
  });

  it("keeps a still-valid attachment link when a refetch brings a newly signed one, so images don't reload", () => {
    const signedAt = Date.parse('2026-10-13T05:00:00Z');
    const shown = s3Url('20261013T050000Z', 'sig1');
    const list = [msg('a', '2026-10-13T05:09:00Z', { attachmentUrl: shown, attachmentContentType: 'image/jpeg' })];
    const resigned = msg('a', '2026-10-13T05:09:00Z', {
      attachmentUrl: s3Url('20261013T052000Z', 'sig2'),
      attachmentContentType: 'image/jpeg',
    });
    // Twenty minutes in: nothing changed but the signature, so the same list comes back.
    expect(upsertMessage(list, resigned, signedAt + 20 * 60_000)).toBe(list);
    expect(mergeHistoryPage(list, [resigned], signedAt + 20 * 60_000)).toBe(list);
    // Under ten minutes left: the new link is taken, so the file still opens.
    expect(upsertMessage(list, resigned, signedAt + 51 * 60_000)[0].attachmentUrl).toBe(resigned.attachmentUrl);
  });

  it('never lets a lower card version overwrite a higher one', () => {
    const saved = action(3, { status: 'EXECUTED' });
    const list = [botMsg('m2', '2026-10-13T05:10:00Z', { action: saved })];
    const stale = upsertMessage(list, botMsg('m2', '2026-10-13T05:10:00Z', { action: action(1) }));
    expect(stale).toBe(list);
    expect(stale[0].action).toBe(saved);

    const newer = action(4, { status: 'EXECUTED', decidedAt: '2026-10-13T05:12:00Z' });
    const updated = upsertMessage(list, botMsg('m2', '2026-10-13T05:10:00Z', { action: newer }));
    expect(updated[0].action).toBe(newer);
  });

  it('keeps a card when a later copy of the message comes without one', () => {
    const card = action(1);
    const list = [botMsg('m2', '2026-10-13T05:10:00Z', { action: card })];
    const { action: _omitted, ...withoutKey } = botMsg('m2', '2026-10-13T05:10:00Z');
    expect(_omitted).toBeNull();
    expect(upsertMessage(list, withoutKey as Message)[0].action).toBe(card);
    expect(upsertMessage(list, botMsg('m2', '2026-10-13T05:10:00Z', { action: null }))[0].action).toBe(card);
  });

  it("doesn't add an action key to an older server's message", () => {
    const { action: _a, ...old } = msg('a', '2026-10-13T05:09:00Z');
    expect(_a).toBeNull();
    const list = upsertMessage([old as Message], { ...(old as Message), content: 'edited' });
    expect('action' in list[0]).toBe(false);
  });
});

describe('attachment links', () => {
  const signedAt = Date.parse('2026-10-13T05:00:00Z');

  it('reads when an S3 presigned link expires', () => {
    expect(presignedUrlExpiresAt(s3Url('20261013T050000Z', 'sig'))).toBe(signedAt + 3600 * 1000);
    expect(presignedUrlExpiresAt('https://bucket.s3.amazonaws.com/a.jpg')).toBeNull();
    expect(presignedUrlExpiresAt('https://bucket.s3.amazonaws.com/a.jpg?X-Amz-Date=yesterday&X-Amz-Expires=60')).toBeNull();
  });

  it('keeps the shown link for the same file while it has time left, and takes a new file or a fresh link', () => {
    const shown = s3Url('20261013T050000Z', 'sig1');
    const resigned = s3Url('20261013T053000Z', 'sig2');
    expect(keptAttachmentUrl(shown, resigned, signedAt + 49 * 60_000)).toBe(shown);
    expect(keptAttachmentUrl(shown, resigned, signedAt + 50 * 60_000)).toBe(resigned);
    expect(keptAttachmentUrl(shown, resigned, signedAt + 2 * 3600_000)).toBe(resigned);
    // Another object key is another file.
    const other = s3Url('20261013T050000Z', 'sig1', 'b.pdf');
    expect(keptAttachmentUrl(shown, other, signedAt)).toBe(other);
    // A link that doesn't say when it expires is kept for the same file.
    expect(keptAttachmentUrl('https://cdn.example/a.jpg?v=1', 'https://cdn.example/a.jpg?v=2', signedAt)).toBe(
      'https://cdn.example/a.jpg?v=1'
    );
  });
});

describe('applyActionUpdate', () => {
  const list = [msg('m1', '2026-10-13T05:09:00Z'), botMsg('m2', '2026-10-13T05:10:00Z', { action: action(1) })];

  it('puts the new card state on the message that shows it', () => {
    const saved = action(2, { status: 'EXECUTED' });
    const next = applyActionUpdate(list, saved);
    expect(next[1].action).toBe(saved);
    expect(next[0]).toBe(list[0]);
    expect(list[1].action?.status).toBe('PENDING');
  });

  it('ignores an older or equal version, and a message it does not have', () => {
    const current = [list[0], botMsg('m2', '2026-10-13T05:10:00Z', { action: action(5, { status: 'EXECUTED' }) })];
    expect(applyActionUpdate(current, action(4, { status: 'FAILED' }))).toBe(current);
    expect(applyActionUpdate(current, action(5, { status: 'FAILED' }))).toBe(current);
    expect(applyActionUpdate(list, action(9, { messageId: 'elsewhere' }))).toBe(list);
  });
});

describe('visibleContent', () => {
  it('hides the plain-text footer when the content ends with it exactly', () => {
    const m = botMsg('m2', '2026-10-13T05:10:00Z', { content: `Ready for you to confirm.${FOOTER}`, action: action(1) });
    expect(visibleContent(m)).toBe('Ready for you to confirm.');
  });

  it('leaves the content alone when the footer is not its exact ending', () => {
    const notAtEnd = botMsg('m2', '2026-10-13T05:10:00Z', { content: `Before${FOOTER} and after`, action: action(1) });
    expect(visibleContent(notAtEnd)).toBe(`Before${FOOTER} and after`);
    const changed = botMsg('m2', '2026-10-13T05:10:00Z', { content: 'Ready.\n\n----------\nsomething else', action: action(1) });
    expect(visibleContent(changed)).toBe('Ready.\n\n----------\nsomething else');
    // No card, or a card with an empty footer: nothing is cut.
    expect(visibleContent(botMsg('m3', '2026-10-13T05:10:00Z', { content: 'Hello' }))).toBe('Hello');
    expect(visibleContent(botMsg('m4', '2026-10-13T05:10:00Z', { content: 'Hello', action: action(1, { footer: '' }) }))).toBe(
      'Hello'
    );
  });

  it('gives an empty string for a message with no text', () => {
    expect(visibleContent(msg('a', '2026-10-13T05:09:00Z', { content: null }))).toBe('');
    expect(visibleContent(botMsg('m2', '2026-10-13T05:10:00Z', { content: null, action: action(1) }))).toBe('');
  });
});

describe('supportsBotActions', () => {
  it('is true only when the server wrote the action key, even as null', () => {
    expect(supportsBotActions(msg('a', '2026-10-13T05:09:00Z'))).toBe(true);
    expect(supportsBotActions(botMsg('m2', '2026-10-13T05:10:00Z', { action: action(1) }))).toBe(true);
    const { action: _a, ...older } = msg('a', '2026-10-13T05:09:00Z');
    expect(_a).toBeNull();
    expect(supportsBotActions(older as Message)).toBe(false);
    expect(supportsBotActions(null)).toBe(false);
    expect(supportsBotActions(undefined)).toBe(false);
  });
});

describe('mergeHistoryPage', () => {
  it('after a reconnect, adds a missed bot reply and follow-up and updates a card to its newer version', () => {
    const shown = [
      msg('q1', '2026-10-13T05:09:00Z'),
      botMsg('m2', '2026-10-13T05:10:00Z', { action: action(1) }),
      msg('q2', '2026-10-13T05:11:00Z'),
    ];
    // The history API sends the newest first.
    const page = [
      botMsg('followup', '2026-10-13T05:13:00Z', { content: 'Saved 1 timetable change (K7QX4).' }),
      botMsg('reply2', '2026-10-13T05:11:30Z'),
      msg('q2', '2026-10-13T05:11:00Z'),
      botMsg('m2', '2026-10-13T05:10:00Z', { action: action(2, { status: 'EXECUTED' }) }),
      msg('q1', '2026-10-13T05:09:00Z'),
    ];
    const merged = mergeHistoryPage(shown, page);
    expect(ids(merged)).toEqual(['q1', 'm2', 'q2', 'reply2', 'followup']);
    expect(merged[1].action?.status).toBe('EXECUTED');
    expect(merged[0]).toBe(shown[0]);
    expect(ids(newMessages(shown, page))).toEqual(['followup', 'reply2']);
  });

  it('changes nothing when the page has only what is already shown', () => {
    const shown = [msg('q1', '2026-10-13T05:09:00Z'), botMsg('m2', '2026-10-13T05:10:00Z', { action: action(2) })];
    const page = [botMsg('m2', '2026-10-13T05:10:00Z', { action: action(1) }), msg('q1', '2026-10-13T05:09:00Z')];
    expect(mergeHistoryPage(shown, page)).toBe(shown);
    expect(newMessages(shown, page)).toEqual([]);
  });

  it('counts a message that appears twice in one batch as new once', () => {
    expect(ids(newMessages([], [msg('a', '2026-10-13T05:09:00Z'), msg('a', '2026-10-13T05:09:00Z')]))).toEqual(['a']);
  });
});

describe('typing indicator', () => {
  const sentAt = 1_000_000;

  it('starts when the user sends', () => {
    const state = startTyping(sentAt);
    expect(isTyping(state, sentAt)).toBe(true);
    expect(isTyping(NOT_TYPING, sentAt)).toBe(false);
  });

  it('stops on a bot message, from a frame or a refetch', () => {
    const state = startTyping(sentAt);
    expect(isTyping(onIncoming(state, botMsg('r1', '2026-10-13T05:10:00Z')), sentAt + 1000)).toBe(false);

    // A refetch: only messages new to the list count, so an old bot reply on the page doesn't.
    const shown = [botMsg('old', '2026-10-13T05:00:00Z'), msg('q', '2026-10-13T05:09:00Z')];
    const page = [botMsg('r1', '2026-10-13T05:10:00Z'), ...shown];
    expect(isTyping(newMessages(shown, page).reduce(onIncoming, state), sentAt + 1000)).toBe(false);
    expect(isTyping(newMessages(shown, shown).reduce(onIncoming, state), sentAt + 1000)).toBe(true);
  });

  it("ignores the user's own message coming back", () => {
    const state = startTyping(sentAt);
    expect(onIncoming(state, msg('q', '2026-10-13T05:09:00Z'))).toBe(state);
    expect(isTyping(onIncoming(state, msg('q', '2026-10-13T05:09:00Z')), sentAt + 1000)).toBe(true);
  });

  it('times out after 90 seconds', () => {
    const state = startTyping(sentAt);
    expect(BOT_TYPING_TIMEOUT_MS).toBe(90_000);
    expect(isTyping(state, sentAt + 89_999)).toBe(true);
    expect(isTyping(state, sentAt + 90_000)).toBe(false);
  });

  it('ends when its timer fires, even 1 ms early or after the clock moved back', () => {
    const state = startTyping(sentAt);
    // The timer armed for this send fired while the clock reads 89 999 ms (or less) after it.
    expect(isTyping(state, sentAt + 89_999)).toBe(true);
    expect(onTypingTimeout(state, sentAt)).toBe(NOT_TYPING);
  });

  it("doesn't end a newer send's typing from an older send's timer", () => {
    const newer = startTyping(sentAt + 5000);
    expect(onTypingTimeout(newer, sentAt)).toBe(newer);
    expect(onTypingTimeout(NOT_TYPING, sentAt)).toBe(NOT_TYPING);
    expect(onTypingTimeout(NOT_TYPING, null)).toBe(NOT_TYPING);
  });
});
