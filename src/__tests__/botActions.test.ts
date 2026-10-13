import type { BotAction, BotActionItem, BotCellState } from '../api/types';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import {
  assignmentCount,
  botActionCardState,
  botActionChipLabel,
  botActionChipVariant,
  botActionExpiresIn,
  botActionFailureText,
  botActionInlineError,
  botActionNotes,
  botActionTitle,
  clientDeadlineMs,
  confirmAlertBody,
  formatBotActionItem,
  isBotAction,
  notPendingMessage,
} from '../utils/botActions';
import { formatIsoDate } from '../utils/timetable';

const MIN = 60_000;
const SERVER_TIME = '2026-10-13T05:10:00Z';
const SERVER_MS = Date.parse(SERVER_TIME);

function cell(subjectName: string | null, teacherName: string | null, roomName: string | null = null, extra: Partial<BotCellState> = {}): BotCellState {
  return { subjectName, teacherName, teacherDetail: null, teacherHasLogin: null, roomName, ...extra };
}

function item(kind: string, extra: Partial<BotActionItem> = {}): BotActionItem {
  return {
    index: 1,
    kind,
    replacesExisting: false,
    undoesKind: null,
    date: '2026-10-14',
    dayOfWeek: 'WEDNESDAY',
    periodNumber: 3,
    periodLabel: null,
    startTime: '09:20',
    endTime: '10:00',
    sectionId: 'sec7a',
    className: 'Grade 7',
    section: 'A',
    academicYear: '2026-27',
    classLabel: 'Grade 7 - A',
    periodEnded: false,
    before: null,
    after: null,
    regularTeacherName: null,
    assignsTeacher: false,
    summary: 'The server summary.',
    ...extra,
  };
}

function action(extra: Partial<BotAction> = {}): BotAction {
  return {
    id: 'act1',
    messageId: 'm2',
    conversationId: 'c1',
    code: 'K7QX4',
    type: 'TIMETABLE_CHANGES',
    status: 'PENDING',
    changeCount: 2,
    title: '2 timetable changes',
    items: [],
    reason: null,
    requestedByOwnerType: 'EMPLOYEE',
    requestedByOwnerId: 'admin1',
    createdAt: '2026-10-13T05:09:50Z',
    expiresAt: new Date(SERVER_MS + 15 * MIN).toISOString(),
    decidedAt: null,
    failureCode: null,
    failureReason: null,
    footer: '\n\n----------\nfooter',
    version: 1,
    serverTime: SERVER_TIME,
    ...extra,
  };
}

const ADMIN = { ownerType: 'EMPLOYEE', ownerId: 'admin1' };
const OTHER_ADMIN = { ownerType: 'EMPLOYEE', ownerId: 'admin2' };

// A SUBSTITUTE on Wed 14 Oct, period 3, Grade 7 - A.
const DATE_EN = formatIsoDate('2026-10-14', 'en');
const DATE_HI = formatIsoDate('2026-10-14', 'hi');
const WHEN_EN = `${DATE_EN}, period 3 (09:20-10:00)`;
const WHEN_HI = `${fill(hi.helpdeskBot.item.whenDate, { date: DATE_HI, n: 3 })} (09:20-10:00)`;

const substitute = item('SUBSTITUTE', {
  before: cell('Maths', 'Sunita Sharma', 'Lab 1'),
  after: cell('Maths', 'Ravi Kumar', 'Lab 1', { teacherHasLogin: true }),
  regularTeacherName: 'Sunita Sharma',
});

describe('botActionCardState', () => {
  it('gives each status its chip', () => {
    const chips = ['PENDING', 'EXECUTED', 'FAILED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED'].map(
      (status) => botActionCardState(action({ status }), ADMIN, SERVER_MS, SERVER_MS).chip
    );
    expect(chips).toEqual(['waiting', 'saved', 'failed', 'cancelled', 'expired', 'replaced']);
    expect(botActionChipVariant('saved')).toBe('success');
    expect(botActionChipVariant('failed')).toBe('error');
    expect(botActionChipLabel(botActionCardState(action(), ADMIN, SERVER_MS, SERVER_MS), tEn)).toBe('Waiting for you');
    expect(botActionChipLabel(botActionCardState(action({ status: 'SUPERSEDED' }), ADMIN, SERVER_MS, SERVER_MS), tHi)).toBe(
      hi.helpdeskBot.card.status.replaced
    );
  });

  it('lets only the admin who asked act, only while it is waiting and has time left', () => {
    expect(botActionCardState(action(), ADMIN, SERVER_MS + MIN, SERVER_MS)).toMatchObject({
      status: 'PENDING',
      canAct: true,
      msLeft: 14 * MIN,
    });
    expect(botActionCardState(action(), OTHER_ADMIN, SERVER_MS + MIN, SERVER_MS).canAct).toBe(false);
    expect(botActionCardState(action(), { ownerType: 'STUDENT', ownerId: 'admin1' }, SERVER_MS, SERVER_MS).canAct).toBe(false);
    expect(botActionCardState(action(), null, SERVER_MS, SERVER_MS).canAct).toBe(false);
    for (const status of ['EXECUTED', 'FAILED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED']) {
      expect(botActionCardState(action({ status }), ADMIN, SERVER_MS, SERVER_MS)).toMatchObject({ canAct: false, msLeft: 0 });
    }
  });

  it('expires a waiting card by its deadline', () => {
    expect(botActionCardState(action(), ADMIN, SERVER_MS + 15 * MIN - 1, SERVER_MS).canAct).toBe(true);
    expect(botActionCardState(action(), ADMIN, SERVER_MS + 15 * MIN, SERVER_MS)).toMatchObject({
      status: 'EXPIRED',
      chip: 'expired',
      canAct: false,
      msLeft: 0,
    });
  });

  it("corrects a phone clock that is 5 minutes behind the server's", () => {
    // The card arrived when the phone said 05:05 and the server said 05:10.
    const receivedAt = SERVER_MS - 5 * MIN;
    expect(clientDeadlineMs(action(), receivedAt)).toBe(SERVER_MS + 10 * MIN);
    // Without the correction it would have been usable until 05:25 by the phone's clock, 5 minutes too long.
    expect(botActionCardState(action(), ADMIN, receivedAt + 14 * MIN, receivedAt)).toMatchObject({ canAct: true, msLeft: MIN });
    expect(botActionCardState(action(), ADMIN, receivedAt + 15 * MIN, receivedAt)).toMatchObject({
      status: 'EXPIRED',
      canAct: false,
    });
  });

  it('treats a status it does not know as unknown, with no buttons', () => {
    const state = botActionCardState(action({ status: 'ON_HOLD' }), ADMIN, SERVER_MS, SERVER_MS);
    expect(state).toMatchObject({ status: 'ON_HOLD', chip: 'unknown', canAct: false });
    expect(botActionChipLabel(state, tEn)).toBe('ON_HOLD');
    expect(botActionChipVariant(state.chip)).toBe('neutral');
  });

  it('counts down in whole minutes while waiting', () => {
    const fresh = botActionCardState(action(), ADMIN, SERVER_MS, SERVER_MS);
    expect(botActionExpiresIn(fresh, tEn)).toBe('Expires in 15 min');
    expect(botActionExpiresIn(botActionCardState(action(), ADMIN, SERVER_MS + 14 * MIN + 30_000, SERVER_MS), tEn)).toBe(
      'Expires in 1 min'
    );
    expect(botActionExpiresIn(fresh, tHi)).toBe(fill(hi.helpdeskBot.card.expiresIn, { minutes: 15 }));
    expect(botActionExpiresIn(botActionCardState(action({ status: 'EXECUTED' }), ADMIN, SERVER_MS, SERVER_MS), tEn)).toBeNull();
  });
});

describe('botActionInlineError', () => {
  it('shows a confirm error only while the card still waits', () => {
    const waiting = botActionCardState(action(), ADMIN, SERVER_MS, SERVER_MS);
    expect(botActionInlineError(waiting, 'No internet connection')).toBe('No internet connection');
    expect(botActionInlineError(waiting, null)).toBeNull();
    // The refresh after a lost answer found it saved: "Saved" alone, not "Saved" over an error.
    for (const status of ['EXECUTED', 'FAILED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED']) {
      const decided = botActionCardState(action({ status }), ADMIN, SERVER_MS, SERVER_MS);
      expect(botActionInlineError(decided, 'No internet connection')).toBeNull();
    }
    // Ran out by the phone's clock while the error showed.
    const expired = botActionCardState(action(), ADMIN, SERVER_MS + 15 * MIN, SERVER_MS);
    expect(botActionInlineError(expired, 'The request timed out')).toBeNull();
  });
});

describe('card title and failure', () => {
  it('counts the changes in the app language', () => {
    expect(botActionTitle(action({ changeCount: 1 }), tEn)).toBe('1 timetable change');
    expect(botActionTitle(action({ changeCount: 3 }), tEn)).toBe('3 timetable changes');
    expect(botActionTitle(action({ changeCount: 3 }), tHi)).toBe(fill(hi.helpdeskBot.card.title_other, { count: 3 }));
  });

  it("shows a failed card's reason", () => {
    const failed = action({ status: 'FAILED', failureCode: 'TIMETABLE_CLASH', failureReason: 'Ravi Kumar already teaches Grade 6 - B.' });
    expect(botActionFailureText(failed, tEn)).toBe("Couldn't save: Ravi Kumar already teaches Grade 6 - B.");
    expect(botActionFailureText(action(), tEn)).toBeNull();
  });
});

describe('formatBotActionItem', () => {
  it('says who takes a period instead of whom', () => {
    expect(formatBotActionItem(substitute, tEn, 'en')).toEqual({
      text: `${WHEN_EN}, Grade 7 - A: Ravi Kumar takes Maths instead of Sunita Sharma`,
      room: null,
    });
    expect(formatBotActionItem(substitute, tHi, 'hi').text).toBe(
      fill(hi.helpdeskBot.item.substitute, {
        when: WHEN_HI,
        class: 'Grade 7 - A',
        teacher: 'Ravi Kumar',
        subject: 'Maths',
        original: 'Sunita Sharma',
      })
    );
  });

  it('names the old substitute and the regular teacher when a substitute is replaced', () => {
    const replacing = item('SUBSTITUTE', {
      replacesExisting: true,
      before: cell('Maths', 'Meena Joshi', 'Lab 2'),
      after: cell('Maths', 'Ravi Kumar', 'Lab 2'),
      regularTeacherName: 'Sunita Sharma',
    });
    expect(formatBotActionItem(replacing, tEn, 'en').text).toBe(
      `${WHEN_EN}, Grade 7 - A: Ravi Kumar takes Maths instead of Meena Joshi (covering for Sunita Sharma)`
    );
    expect(formatBotActionItem(replacing, tHi, 'hi').text).toBe(
      fill(hi.helpdeskBot.item.replacing, {
        when: WHEN_HI,
        class: 'Grade 7 - A',
        teacher: 'Ravi Kumar',
        subject: 'Maths',
        original: 'Meena Joshi',
        regular: 'Sunita Sharma',
      })
    );
  });

  it('formats a cancellation and an extra class', () => {
    const cancel = item('CANCEL', { before: cell('Maths', 'Sunita Sharma', 'Lab 1'), regularTeacherName: 'Sunita Sharma' });
    expect(formatBotActionItem(cancel, tEn, 'en')).toEqual({ text: `${WHEN_EN}, Grade 7 - A: no Maths class`, room: null });
    expect(formatBotActionItem(cancel, tHi, 'hi').text).toBe(
      fill(hi.helpdeskBot.item.cancel, { when: WHEN_HI, class: 'Grade 7 - A', subject: 'Maths' })
    );

    const extra = item('EXTRA', { after: cell('Science', 'Ravi Kumar', 'Lab 2', { teacherHasLogin: true }) });
    expect(formatBotActionItem(extra, tEn, 'en')).toEqual({
      text: `${WHEN_EN}, Grade 7 - A: extra Science class with Ravi Kumar`,
      room: 'Room: Lab 2',
    });
    expect(formatBotActionItem(extra, tHi, 'hi')).toEqual({
      text: fill(hi.helpdeskBot.item.extra, { when: WHEN_HI, class: 'Grade 7 - A', teacher: 'Ravi Kumar', subject: 'Science' }),
      room: fill(hi.helpdeskBot.card.room, { room: 'Lab 2' }),
    });
  });

  it('formats an undo, with its own line for an extra class', () => {
    const undo = item('UNDO', {
      undoesKind: 'SUBSTITUTE',
      before: cell('Maths', 'Ravi Kumar', 'Lab 2'),
      after: cell('Maths', 'Sunita Sharma', 'Lab 1'),
    });
    expect(formatBotActionItem(undo, tEn, 'en')).toEqual({
      text: `${WHEN_EN}, Grade 7 - A: back to the regular timetable`,
      room: 'Room: Lab 1',
    });
    const undoExtra = item('UNDO', { undoesKind: 'EXTRA', before: cell('Science', 'Ravi Kumar', 'Lab 2') });
    expect(formatBotActionItem(undoExtra, tEn, 'en')).toEqual({
      text: `${WHEN_EN}, Grade 7 - A: the extra class is removed`,
      room: null,
    });
    expect(formatBotActionItem(undoExtra, tHi, 'hi').text).toBe(
      fill(hi.helpdeskBot.item.undoExtra, { when: WHEN_HI, class: 'Grade 7 - A' })
    );
  });

  it('formats a weekly change with the long weekday', () => {
    const set = item('SET', {
      date: null,
      dayOfWeek: 'MONDAY',
      periodNumber: 2,
      startTime: '08:40',
      endTime: '09:20',
      before: cell('Maths', 'Sunita Sharma'),
      after: cell('Science', 'Ravi Kumar', 'Lab 2'),
      assignsTeacher: true,
    });
    expect(formatBotActionItem(set, tEn, 'en')).toEqual({
      text: 'Every Monday, period 2 (08:40-09:20), Grade 7 - A: Science with Ravi Kumar (was Maths with Sunita Sharma)',
      room: 'Room: Lab 2',
    });
    const hindi = formatBotActionItem(set, tHi, 'hi').text;
    expect(hindi.startsWith('हर सोमवार, पीरियड 2 (08:40-09:20)')).toBe(true);
    expect(hindi).toBe(
      fill(hi.helpdeskBot.item.set, {
        when: 'हर सोमवार, पीरियड 2 (08:40-09:20)',
        class: 'Grade 7 - A',
        teacher: 'Ravi Kumar',
        subject: 'Science',
        before: fill(hi.helpdeskBot.item.subjectWithTeacher, { subject: 'Maths', teacher: 'Sunita Sharma' }),
      })
    );

    const fromFree = { ...set, before: null };
    expect(formatBotActionItem(fromFree, tEn, 'en').text).toBe(
      'Every Monday, period 2 (08:40-09:20), Grade 7 - A: Science with Ravi Kumar (was free)'
    );

    const clear = item('CLEAR', {
      date: null,
      dayOfWeek: 'FRIDAY',
      before: cell('Maths', 'Sunita Sharma', 'Lab 1'),
    });
    expect(formatBotActionItem(clear, tEn, 'en')).toEqual({
      text: 'Every Friday, period 3 (09:20-10:00), Grade 7 - A: free period (was Maths with Sunita Sharma)',
      room: null,
    });
  });

  it('adds "already over", leaves out missing times, and uses the class label as sent', () => {
    const ended = { ...substitute, periodEnded: true, classLabel: 'Grade 7 - A (2026-27)' };
    expect(formatBotActionItem(ended, tEn, 'en').text).toBe(
      `${WHEN_EN} (already over), Grade 7 - A (2026-27): Ravi Kumar takes Maths instead of Sunita Sharma`
    );
    expect(formatBotActionItem(ended, tHi, 'hi').text.startsWith(`${WHEN_HI} ${hi.helpdeskBot.item.ended},`)).toBe(true);
    const noTimes = { ...substitute, startTime: null, endTime: null };
    expect(formatBotActionItem(noTimes, tEn, 'en').text).toBe(
      `${DATE_EN}, period 3, Grade 7 - A: Ravi Kumar takes Maths instead of Sunita Sharma`
    );
  });

  it("puts a namesake's detail and a missing app login in brackets after the teacher", () => {
    const namesake = {
      ...substitute,
      after: cell('Maths', 'Ravi Kumar', 'Lab 1', { teacherDetail: 'TGT; Maths 7A', teacherHasLogin: false }),
    };
    expect(formatBotActionItem(namesake, tEn, 'en').text).toBe(
      `${WHEN_EN}, Grade 7 - A: Ravi Kumar (TGT; Maths 7A, no app login - won't be notified) takes Maths instead of Sunita Sharma`
    );
    expect(formatBotActionItem(namesake, tHi, 'hi').text).toContain(
      `Ravi Kumar (TGT; Maths 7A, ${hi.helpdeskBot.card.noLogin})`
    );
    const detailOnly = { ...substitute, after: cell('Maths', 'Ravi Kumar', 'Lab 1', { teacherDetail: 'PGT', teacherHasLogin: true }) };
    expect(formatBotActionItem(detailOnly, tEn, 'en').text).toContain('Ravi Kumar (PGT) takes');
  });

  it('adds a room line only when the room changes', () => {
    expect(formatBotActionItem(substitute, tEn, 'en').room).toBeNull();
    const moved = { ...substitute, after: cell('Maths', 'Ravi Kumar', 'Lab 3') };
    expect(formatBotActionItem(moved, tEn, 'en').room).toBe('Room: Lab 3');
    const noRoom = { ...substitute, after: cell('Maths', 'Ravi Kumar', null) };
    expect(formatBotActionItem(noRoom, tEn, 'en').room).toBeNull();
  });

  it("falls back to the server's summary for an unknown kind or a missing field", () => {
    const fallback = { text: 'The server summary.', room: null };
    expect(formatBotActionItem(item('SWAP', { after: cell('Maths', 'Ravi') }), tEn, 'en')).toEqual(fallback);
    expect(formatBotActionItem({ ...substitute, after: null }, tEn, 'en')).toEqual(fallback);
    expect(formatBotActionItem({ ...substitute, date: null }, tEn, 'en')).toEqual(fallback);
    expect(formatBotActionItem({ ...substitute, regularTeacherName: null, before: null }, tEn, 'en')).toEqual(fallback);
    expect(formatBotActionItem(item('CANCEL'), tEn, 'en')).toEqual(fallback);
    expect(formatBotActionItem(item('CLEAR', { date: null, dayOfWeek: 'MONDAY' }), tEn, 'en')).toEqual(fallback);
    expect(
      formatBotActionItem(
        item('SET', { date: null, dayOfWeek: 'MONDAY', before: cell('Maths', null), after: cell('Science', 'Ravi') }),
        tEn,
        'en'
      )
    ).toEqual(fallback);
    expect(
      formatBotActionItem(item('SET', { date: null, dayOfWeek: 'FUNDAY' as never, after: cell('Science', 'Ravi') }), tEn, 'en')
    ).toEqual(fallback);
  });
});

describe('notes and the confirm alert', () => {
  const set = item('SET', {
    index: 2,
    date: null,
    dayOfWeek: 'MONDAY',
    after: cell('Science', 'Ravi Kumar', 'Lab 2'),
    assignsTeacher: true,
  });
  const withBoth = action({ items: [substitute, set], reason: 'On leave' });

  it('lists the reason the teachers will see, then the access an assignment gives', () => {
    expect(botActionNotes(withBoth, tEn)).toEqual([
      'Reason (the teachers involved will see this): On leave',
      "Also assigns Ravi Kumar to teach Science in Grade 7 - A: they can add marks and message or call this class's students and parents.",
    ]);
    expect(botActionNotes(withBoth, tHi)).toEqual([
      fill(hi.helpdeskBot.card.reason, { reason: 'On leave' }),
      fill(hi.helpdeskBot.card.assigns, { teacher: 'Ravi Kumar', subject: 'Science', class: 'Grade 7 - A' }),
    ]);
    expect(botActionNotes(action({ items: [substitute] }), tEn)).toEqual([]);
  });

  it('says in the confirm alert what saving does, the access it grants and the reason', () => {
    expect(assignmentCount(withBoth)).toBe(1);
    expect(confirmAlertBody(withBoth, tEn)).toBe(
      'The timetable will change as shown. Teachers and students affected by date changes get a notification.\n\n' +
        'This also gives 1 teacher access to a class.\n\n' +
        'Reason the teachers will see: On leave'
    );
    const twoAssignments = action({ items: [set, { ...set, index: 3, sectionId: 'sec8b' }] });
    expect(confirmAlertBody(twoAssignments, tEn)).toBe(
      'The timetable will change as shown. Teachers and students affected by date changes get a notification.\n\n' +
        'This also gives 2 teachers access to a class.'
    );
    expect(confirmAlertBody(action({ items: [substitute] }), tEn)).toBe(
      'The timetable will change as shown. Teachers and students affected by date changes get a notification.'
    );
    expect(confirmAlertBody(withBoth, tHi)).toBe(
      [
        hi.helpdeskBot.card.confirmBody,
        fill(hi.helpdeskBot.card.confirmAssigns_one, { count: 1 }),
        fill(hi.helpdeskBot.card.confirmReason, { reason: 'On leave' }),
      ].join('\n\n')
    );
  });
});

describe('notPendingMessage', () => {
  it('words each reason a card can no longer be confirmed, in English and Hindi', () => {
    expect(notPendingMessage('EXECUTED', tEn)).toBe('This change is already saved.');
    expect(notPendingMessage('CANCELLED', tEn)).toBe('This change was cancelled. Nothing was saved.');
    expect(notPendingMessage('EXPIRED', tEn)).toBe('This change expired - nothing was saved. Ask the bot again.');
    expect(notPendingMessage('SUPERSEDED', tEn)).toBe('A newer proposal replaced this one.');
    expect(notPendingMessage('FAILED', tEn)).toBe("This change couldn't be saved.");
    for (const status of ['EXECUTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED', 'FAILED'] as const) {
      expect(notPendingMessage(status, tHi)).toBe(hi.helpdeskBot.card.notPending[status]);
    }
  });

  it('is null for any other status', () => {
    expect(notPendingMessage('PENDING', tEn)).toBeNull();
    expect(notPendingMessage('ON_HOLD', tEn)).toBeNull();
    expect(notPendingMessage(undefined, tEn)).toBeNull();
  });
});

describe('isBotAction', () => {
  it("recognises a card in a 409's data", () => {
    expect(isBotAction(action())).toBe(true);
    expect(isBotAction({ id: 'a', status: 'EXECUTED' })).toBe(false);
    expect(isBotAction(null)).toBe(false);
    expect(isBotAction('EXECUTED')).toBe(false);
  });
});
