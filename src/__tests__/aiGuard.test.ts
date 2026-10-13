import type { AiStatus } from '../api/ai';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import {
  AI_CATEGORIES,
  AI_LOOKUP_OUTCOMES,
  AI_SCOPE_KEYS,
  AI_TOOLS,
  AI_VERDICTS,
  categoryLabelKey,
  errorMaySayOff,
  featureLabelKey,
  historyForRequest,
  isMissingEndpoint,
  isPaused,
  messageSaysOff,
  misuseLogView,
  msUntilUnpaused,
  noticeKind,
  outcomeLabelKey,
  pauseAfterStatus,
  pausedUntilFromError,
  pausedUntilFromMessage,
  pausedUntilFromReply,
  pausedUntilFromStatus,
  pausedUntilLabel,
  rangeForDays,
  roleLabelKey,
  scopeKeyLabelKey,
  scopeSummary,
  toolFallbackLabel,
  toolLabelKey,
  verdictLabelKey,
  watchPauseEnd,
  type AiChatEntry,
} from '../utils/aiGuard';

type Tree = { [key: string]: string | Tree };

function lookup(tree: Tree, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Tree)[part] : undefined), tree);
}

/** Spaces as plain spaces: newer ICU puts a narrow no-break space before AM/PM. */
const plain = (text: string) => text.replace(/\s/g, ' ');

const NOW = Date.parse('2026-10-13T09:45:00Z'); // 3:15 PM in India
const IN_AN_HOUR = '2026-10-13T10:45:00Z'; // 4:15 PM in India

const STUDY_REPLY = 'Photosynthesis is how plants make food from sunlight.';
const REFUSAL =
  "Sorry, I can only help with school work, like your studies, teaching or your school's information. Please ask me something about that.";
const WELLBEING =
  "I'm sorry you're feeling this way. Please talk to a parent, a teacher or another adult you trust today. In India you can also call Childline on 1098, any time.";

describe('historyForRequest', () => {
  const entry = (id: string, role: 'user' | 'assistant', content: string, refused?: boolean): AiChatEntry => ({
    id,
    role,
    content,
    ...(refused === undefined ? {} : { refused, excludeFromHistory: refused }),
  });

  it('sends answered exchanges as role and content only', () => {
    const messages = [entry('1', 'user', 'What is photosynthesis?'), entry('2', 'assistant', STUDY_REPLY, false), entry('3', 'user', 'Give an example')];
    expect(historyForRequest(messages)).toEqual([
      { role: 'user', content: 'What is photosynthesis?' },
      { role: 'assistant', content: STUDY_REPLY },
      { role: 'user', content: 'Give an example' },
    ]);
  });

  it('drops a refused reply together with the question before it', () => {
    const messages = [
      entry('1', 'user', 'What is photosynthesis?'),
      entry('2', 'assistant', STUDY_REPLY),
      entry('3', 'user', 'Tell me a joke'),
      entry('4', 'assistant', REFUSAL, true),
      entry('5', 'user', 'Give an example of photosynthesis'),
    ];
    expect(historyForRequest(messages)).toEqual([
      { role: 'user', content: 'What is photosynthesis?' },
      { role: 'assistant', content: STUDY_REPLY },
      { role: 'user', content: 'Give an example of photosynthesis' },
    ]);
  });

  it('drops every refused pair, including one at the very start', () => {
    const messages = [
      entry('1', 'user', 'Tell me a joke'),
      entry('2', 'assistant', REFUSAL, true),
      entry('3', 'user', 'Write a love letter'),
      entry('4', 'assistant', REFUSAL, true),
      entry('5', 'user', 'Explain fractions'),
    ];
    expect(historyForRequest(messages)).toEqual([{ role: 'user', content: 'Explain fractions' }]);
  });

  it('keeps a supportive reply (refused: false) like any answer', () => {
    const messages = [
      entry('1', 'user', 'I feel very stressed about my exams'),
      entry('2', 'assistant', WELLBEING, false),
      entry('3', 'user', 'How do I make a study timetable?'),
    ];
    expect(historyForRequest(messages)).toHaveLength(3);
    expect(historyForRequest(messages)[1]).toEqual({ role: 'assistant', content: WELLBEING });
  });

  it('honours excludeFromHistory on its own', () => {
    const messages: AiChatEntry[] = [
      { id: '1', role: 'user', content: 'Tell me a joke' },
      { id: '2', role: 'assistant', content: REFUSAL, excludeFromHistory: true },
      { id: '3', role: 'user', content: 'hi' },
    ];
    expect(historyForRequest(messages)).toEqual([{ role: 'user', content: 'hi' }]);
  });
});

describe('the paused state', () => {
  it('is paused only while pausedUntil is ahead of now', () => {
    expect(isPaused(IN_AN_HOUR, NOW)).toBe(true);
    expect(isPaused(IN_AN_HOUR, Date.parse(IN_AN_HOUR))).toBe(false);
    expect(isPaused(IN_AN_HOUR, Date.parse(IN_AN_HOUR) + 1)).toBe(false);
    expect(isPaused(null, NOW)).toBe(false);
    expect(isPaused(undefined, NOW)).toBe(false);
    expect(isPaused('not a time', NOW)).toBe(false);
  });

  it('counts down to the end of the pause', () => {
    expect(msUntilUnpaused(IN_AN_HOUR, NOW)).toBe(60 * 60 * 1000);
    expect(msUntilUnpaused(IN_AN_HOUR, Date.parse(IN_AN_HOUR) + 5)).toBe(0);
    expect(msUntilUnpaused(null, NOW)).toBe(0);
  });

  it("enters it from the Academic Helper reply that starts a pause (the 5th refusal itself)", () => {
    expect(pausedUntilFromReply({ notice: { kind: 'PAUSED', pausedUntil: IN_AN_HOUR } })).toBe(IN_AN_HOUR);
    // Every other refusal, an answer, and an older server's reply don't.
    expect(pausedUntilFromReply({ notice: { kind: 'REFUSED', pausedUntil: null } })).toBeNull();
    expect(pausedUntilFromReply({ notice: null })).toBeNull();
    expect(pausedUntilFromReply({})).toBeNull();
    expect(pausedUntilFromReply(null)).toBeNull();
  });

  it("enters it from a live bot message's aiNotice, never from REST history", () => {
    expect(pausedUntilFromMessage({ aiNotice: { kind: 'PAUSED', pausedUntil: IN_AN_HOUR } })).toBe(IN_AN_HOUR);
    expect(pausedUntilFromMessage({ aiNotice: { kind: 'REFUSED', pausedUntil: null } })).toBeNull();
    expect(pausedUntilFromMessage({ aiNotice: null })).toBeNull();
    expect(pausedUntilFromMessage({})).toBeNull();
  });

  it('enters it from a 429 AI_PAUSED and nothing else', () => {
    expect(pausedUntilFromError({ status: 429, errorCode: 'AI_PAUSED', data: { pausedUntil: IN_AN_HOUR } })).toBe(IN_AN_HOUR);
    expect(pausedUntilFromError({ status: 429, errorCode: 'AI_PAUSED' })).toBeNull();
    expect(pausedUntilFromError({ status: 429, errorCode: 'AI_RATE_LIMITED', data: { pausedUntil: IN_AN_HOUR } })).toBeNull();
    expect(pausedUntilFromError(new Error('offline'))).toBeNull();
    expect(pausedUntilFromError(undefined)).toBeNull();
  });

  it('reads the pause from GET /ai/status while it lasts', () => {
    const status: AiStatus = {
      paused: true,
      pausedUntil: IN_AN_HOUR,
      assistantEnabled: true,
      botEnabled: true,
      refusalsInWindow: 5,
      pauseThreshold: 5,
      pauseMinutes: 60,
    };
    expect(pausedUntilFromStatus(status, NOW)).toBe(IN_AN_HOUR);
    expect(pausedUntilFromStatus(status, Date.parse(IN_AN_HOUR) + 1000)).toBeNull();
    expect(pausedUntilFromStatus({ ...status, paused: false, pausedUntil: null }, NOW)).toBeNull();
    expect(pausedUntilFromStatus(null, NOW)).toBeNull();
  });

  it('reads an unknown notice kind from a newer server as a refusal', () => {
    expect(noticeKind('PAUSED')).toBe('PAUSED');
    expect(noticeKind('SCHOOL_LIMIT')).toBe('SCHOOL_LIMIT');
    expect(noticeKind('OFF')).toBe('OFF');
    expect(noticeKind('SOMETHING_NEW')).toBe('REFUSED');
    expect(noticeKind(undefined)).toBe('REFUSED');
  });
});

describe('noticing the AI was switched off', () => {
  it("reads a live bot message's OFF notice, and nothing else, as off", () => {
    expect(messageSaysOff({ aiNotice: { kind: 'OFF', pausedUntil: null } })).toBe(true);
    expect(messageSaysOff({ aiNotice: { kind: 'REFUSED', pausedUntil: null } })).toBe(false);
    expect(messageSaysOff({ aiNotice: { kind: 'PAUSED', pausedUntil: IN_AN_HOUR } })).toBe(false);
    // An unknown kind reads as a refusal, not as off; REST history has no notice at all.
    expect(messageSaysOff({ aiNotice: { kind: 'SOMETHING_NEW' as never, pausedUntil: null } })).toBe(false);
    expect(messageSaysOff({ aiNotice: null })).toBe(false);
    expect(messageSaysOff({})).toBe(false);
    expect(messageSaysOff(null)).toBe(false);
  });

  it("takes the Academic Helper's 503 AI_UNAVAILABLE as a reason to read the status again", () => {
    expect(errorMaySayOff({ status: 503, errorCode: 'AI_UNAVAILABLE', message: 'The Academic Helper is turned off right now.' })).toBe(
      true
    );
    expect(errorMaySayOff({ status: 429, errorCode: 'AI_PAUSED' })).toBe(false);
    expect(errorMaySayOff({ status: 503 })).toBe(false);
    expect(errorMaySayOff(new Error('offline'))).toBe(false);
    expect(errorMaySayOff(undefined)).toBe(false);
  });
});

describe('pauseAfterStatus', () => {
  const LATER = '2026-10-13T11:00:00Z';
  const EARLIER = '2026-10-13T10:30:00Z';

  it("takes the server's word for a request sent after the pause was entered", () => {
    expect(pauseAfterStatus(IN_AN_HOUR, null, false, NOW)).toBeNull(); // lifted by an admin
    expect(pauseAfterStatus(IN_AN_HOUR, EARLIER, false, NOW)).toBe(EARLIER);
    expect(pauseAfterStatus(null, IN_AN_HOUR, false, NOW)).toBe(IN_AN_HOUR);
    expect(pauseAfterStatus(null, null, false, NOW)).toBeNull();
  });

  it('never lets an answer to a request sent before the pause began end or shorten it', () => {
    // GET /ai/status went out on focus, reached the server before the 5th refusal paused the user,
    // and came back after the reply that locked the composer.
    expect(pauseAfterStatus(IN_AN_HOUR, null, true, NOW)).toBe(IN_AN_HOUR);
    expect(pauseAfterStatus(IN_AN_HOUR, EARLIER, true, NOW)).toBe(IN_AN_HOUR);
    expect(pauseAfterStatus(IN_AN_HOUR, IN_AN_HOUR, true, NOW)).toBe(IN_AN_HOUR);
    // It can still make it longer.
    expect(pauseAfterStatus(IN_AN_HOUR, LATER, true, NOW)).toBe(LATER);
  });

  it('has nothing to protect once the pause on show is over', () => {
    const after = Date.parse(IN_AN_HOUR) + 1000;
    expect(pauseAfterStatus(IN_AN_HOUR, null, true, after)).toBeNull();
    expect(pauseAfterStatus(null, null, true, NOW)).toBeNull();
    expect(pauseAfterStatus(null, IN_AN_HOUR, true, NOW)).toBe(IN_AN_HOUR);
  });
});

describe('watchPauseEnd', () => {
  const START = Date.parse('2026-10-13T09:45:00Z');
  const UNTIL = '2026-10-13T10:45:00Z'; // an hour after START
  const HOUR = 60 * 60 * 1000;
  let offsetMs = 0;
  // The server-corrected clock: the device clock (faked) plus the offset from the Date headers.
  const serverClock = () => Date.now() + offsetMs;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START);
    offsetMs = 0;
  });
  afterEach(() => jest.useRealTimers());

  it('ends the pause when it runs out', () => {
    const onEnd = jest.fn();
    watchPauseEnd(UNTIL, serverClock, onEnd);
    jest.advanceTimersByTime(HOUR - 1);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(HOUR);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('still ends it when the clock offset drops while waiting (it wakes "early")', () => {
    const onEnd = jest.fn();
    watchPauseEnd(UNTIL, serverClock, onEnd);
    // A status re-read mid-pause: the whole-second Date header puts the offset 700 ms lower.
    offsetMs = -700;
    jest.advanceTimersByTime(HOUR);
    expect(onEnd).not.toHaveBeenCalled(); // 700 ms left by the server's clock
    jest.advanceTimersByTime(699);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('still ends it when the device clock is set back during the pause', () => {
    const onEnd = jest.fn();
    watchPauseEnd(UNTIL, serverClock, onEnd);
    jest.advanceTimersByTime(HOUR / 2);
    jest.setSystemTime(Date.now() - 5000); // e.g. an NTP correction
    jest.advanceTimersByTime(HOUR / 2);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(5000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('waits out a pause longer than the longest timer', () => {
    const onEnd = jest.fn();
    watchPauseEnd(UNTIL, serverClock, onEnd, 10 * 60 * 1000);
    jest.advanceTimersByTime(HOUR - 1);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('ends a pause that is already over on the next tick, not inside the call', () => {
    const onEnd = jest.fn();
    watchPauseEnd('2026-10-13T09:00:00Z', serverClock, onEnd);
    expect(onEnd).not.toHaveBeenCalled();
    jest.advanceTimersByTime(0);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('does nothing once cancelled, also after waking early', () => {
    const onEnd = jest.fn();
    const cancel = watchPauseEnd(UNTIL, serverClock, onEnd);
    offsetMs = -700;
    jest.advanceTimersByTime(HOUR); // woke early and waits again
    cancel();
    jest.advanceTimersByTime(HOUR);
    expect(onEnd).not.toHaveBeenCalled();
  });
});

describe('pausedUntilLabel', () => {
  const now = new Date(NOW);

  it('shows the time in India for a phone in India', () => {
    expect(plain(pausedUntilLabel(IN_AN_HOUR, 'en', { now, timeZone: 'Asia/Kolkata' }))).toBe('4:15 PM');
  });

  it("shows the phone's own local time elsewhere", () => {
    expect(plain(pausedUntilLabel(IN_AN_HOUR, 'en', { now, timeZone: 'UTC' }))).toBe('10:45 AM');
    expect(plain(pausedUntilLabel(IN_AN_HOUR, 'en', { now, timeZone: 'America/New_York' }))).toBe('6:45 AM');
  });

  it('adds the day for a pause that runs past midnight', () => {
    const lateNight = new Date('2026-10-13T18:00:00Z'); // 11:30 PM in India
    const label = plain(pausedUntilLabel('2026-10-13T19:00:00Z', 'en', { now: lateNight, timeZone: 'Asia/Kolkata' }));
    expect(label).toBe('Oct 14, 12:30 AM');
    expect(plain(pausedUntilLabel('2026-10-13T19:00:00Z', 'en-IN', { now: lateNight, timeZone: 'Asia/Kolkata' }))).toMatch(
      /^14 Oct, 12:30 (am|AM)$/
    );
  });

  it('is empty for something that is not a time', () => {
    expect(pausedUntilLabel('soon', 'en')).toBe('');
  });
});

describe('rangeForDays', () => {
  it('covers the given number of days ending today', () => {
    expect(rangeForDays(1, '2026-10-13')).toEqual({ from: '2026-10-13', to: '2026-10-13' });
    expect(rangeForDays(7, '2026-10-13')).toEqual({ from: '2026-10-07', to: '2026-10-13' });
    expect(rangeForDays(30, '2026-03-01')).toEqual({ from: '2026-01-31', to: '2026-03-01' });
    expect(rangeForDays(365, '2026-10-13')).toEqual({ from: '2025-10-14', to: '2026-10-13' });
  });
});

describe('misuse log labels', () => {
  const expectKeyInBoth = (key: string) => {
    expect({ key, en: typeof lookup(en as unknown as Tree, key) }).toEqual({ key, en: 'string' });
    expect({ key, hi: typeof lookup(hi as unknown as Tree, key) }).toEqual({ key, hi: 'string' });
  };

  it('has words for every category the guard can record, server-only ones included', () => {
    expect(AI_CATEGORIES).toContain('refusal_cyber');
    expect(AI_CATEGORIES).toContain('refusal_bio');
    for (const category of AI_CATEGORIES) expectKeyInBoth(categoryLabelKey(category));
    // camelCase in the translations: "unsafe_other" would read as half of an i18next plural pair.
    expect(categoryLabelKey('unsafe_other')).toBe('aiMisuse.categories.unsafeOther');
    expect(categoryLabelKey('refusal_cyber')).toBe('aiMisuse.categories.refusalCyber');
    expect(categoryLabelKey('study')).toBe('aiMisuse.categories.study');
    expect(toolLabelKey('get_class_marks')).toBe('aiMisuse.tools.getClassMarks');
  });

  it('shows an unknown category as "Other"', () => {
    expect(categoryLabelKey('brand_new_category')).toBe('aiMisuse.categories.other');
    expect(categoryLabelKey(null)).toBe('aiMisuse.categories.other');
    expect(en.aiMisuse.categories.other).toBe('Other');
  });

  it('has words for every verdict, tool, outcome, role and feature', () => {
    for (const verdict of AI_VERDICTS) expectKeyInBoth(verdictLabelKey(verdict));
    expectKeyInBoth(verdictLabelKey('NEW_VERDICT'));
    for (const tool of AI_TOOLS) expectKeyInBoth(toolLabelKey(tool)!);
    for (const outcome of AI_LOOKUP_OUTCOMES) expectKeyInBoth(outcomeLabelKey(outcome)!);
    for (const role of ['STUDENT', 'TEACHER', 'PARENT', 'ADMIN']) expectKeyInBoth(roleLabelKey(role)!);
    for (const feature of ['BOT', 'ASSISTANT']) expectKeyInBoth(featureLabelKey(feature)!);
  });

  it('falls back to readable text for a tool, role or feature added later', () => {
    expect(toolLabelKey('get_class_homework')).toBeNull();
    expect(toolFallbackLabel('get_class_homework')).toBe('Get class homework');
    expect(roleLabelKey('DRIVER')).toBeNull();
    expect(featureLabelKey('QUIZ')).toBeNull();
    expect(outcomeLabelKey('PARTIAL')).toBeNull();
  });
});

describe('scopeSummary', () => {
  it('puts what was asked for on one line, without ids', () => {
    expect(
      scopeSummary({ class: '7 A', sectionId: '7f3c0c1e-0000-4000-8000-000000000001', from: '2026-09-14', to: '2026-10-13' })
    ).toBe('class: 7 A · from: 2026-09-14 · to: 2026-10-13');
  });

  it('spells out nested filters and skips empty values', () => {
    expect(
      scopeSummary({ entity: 'marks', metric: 'averagePercentage', filters: { className: '7', section: 'A', term: null } })
    ).toBe('entity: marks · metric: averagePercentage · filters: className=7, section=A');
    expect(scopeSummary({ class: '8 B', subject: '', assessmentId: 'x', belowPercent: 40, listAll: false })).toBe(
      'class: 8 B · belowPercent: 40 · listAll: false'
    );
  });

  it('is empty for a scope the server could not read back', () => {
    expect(scopeSummary({})).toBe('');
    expect(scopeSummary(null)).toBe('');
  });

  it("words the keys in the app's language, and shows an unknown key as it is", () => {
    const labelIn = (locale: Tree) => (key: string) => {
      const labelKey = scopeKeyLabelKey(key);
      return labelKey ? String(lookup(locale, labelKey)) : key;
    };
    const scope = { class: '7 A', sectionId: 'x', from: '2026-09-14', to: '2026-10-13', newKey: 'y' };
    expect(scopeSummary(scope, labelIn(en as unknown as Tree))).toBe(
      'Class: 7 A · From: 2026-09-14 · To: 2026-10-13 · newKey: y'
    );
    expect(scopeSummary(scope, labelIn(hi as unknown as Tree))).toBe(
      'कक्षा: 7 A · से: 2026-09-14 · तक: 2026-10-13 · newKey: y'
    );
    // Nested keys go through the same words (a metric's own field names stay as they are).
    expect(scopeSummary({ entity: 'marks', filters: { className: '7', status: 'PAID' } }, labelIn(en as unknown as Tree))).toBe(
      'Data: marks · Filters: className=7, Status=PAID'
    );
  });

  it('has words for every scope key the server records', () => {
    for (const key of AI_SCOPE_KEYS) {
      const labelKey = scopeKeyLabelKey(key)!;
      expect({ key, en: typeof lookup(en as unknown as Tree, labelKey) }).toEqual({ key, en: 'string' });
      expect({ key, hi: typeof lookup(hi as unknown as Tree, labelKey) }).toEqual({ key, hi: 'string' });
    }
    expect(scopeKeyLabelKey('sectionId')).toBeNull();
    expect(scopeKeyLabelKey(undefined)).toBeNull();
  });
});

describe('misuseLogView', () => {
  const REFUSED_7 = 'refused|7||';
  const REFUSED_30 = 'refused|30||';
  const RAVI = 'refused|7|STUDENT|ravi';

  it('shows the rows only once they were loaded for exactly this tab, range and person', () => {
    expect(misuseLogView(REFUSED_7, REFUSED_7, null)).toBe('list');
    expect(misuseLogView(REFUSED_7, null, null)).toBe('loading');
    // A new chip or name: a spinner, not the previous query's rows under the new filter.
    expect(misuseLogView(REFUSED_30, REFUSED_7, null)).toBe('loading');
    expect(misuseLogView(RAVI, REFUSED_7, null)).toBe('loading');
  });

  it("shows a failed first load as a failure, never as an empty 'nothing refused' list", () => {
    expect(misuseLogView(REFUSED_7, null, { key: REFUSED_7, unavailable: false })).toBe('error');
    expect(misuseLogView(REFUSED_30, REFUSED_7, { key: REFUSED_30, unavailable: false })).toBe('error');
    // A server without the log (404, e.g. after a rollback) says so.
    expect(misuseLogView(REFUSED_7, null, { key: REFUSED_7, unavailable: true })).toBe('unavailable');
    // A failure for another query doesn't count.
    expect(misuseLogView(REFUSED_30, REFUSED_7, { key: REFUSED_7, unavailable: false })).toBe('loading');
  });

  it("keeps the rows on show when a refresh of the same query fails", () => {
    expect(misuseLogView(REFUSED_7, REFUSED_7, { key: REFUSED_7, unavailable: false })).toBe('list');
  });

  it('takes a 404 as a server without the log', () => {
    expect(isMissingEndpoint({ status: 404, message: 'Resource not found: api/v1/ai/misuse' })).toBe(true);
    expect(isMissingEndpoint({ status: 403 })).toBe(false);
    expect(isMissingEndpoint({ status: 500 })).toBe(false);
    expect(isMissingEndpoint(new Error('offline'))).toBe(false);
    expect(isMissingEndpoint(null)).toBe(false);
  });
});
