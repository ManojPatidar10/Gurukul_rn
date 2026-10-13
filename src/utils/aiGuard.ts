import type { AiChatMessage, AiStatus } from '../api/ai';
import type { AiNotice, AiNoticeKind } from '../api/types';
import { shiftIsoDate } from './feeBills';

/**
 * Pure helpers for the AI school-work guard (spec ai-school-scope-and-security): which Academic
 * Helper turns are re-sent, when the user's AI help is paused, and the labels of the admin's AI
 * misuse log. No API calls and no React, so they're unit-tested on their own.
 */

// ---------------------------------------------------------------------------------------------
// Academic Helper history

/** A message on the Academic Helper screen. */
export interface AiChatEntry extends AiChatMessage {
  id: string;
  /** A fixed server text with no model answer in it (shown muted, with an info icon). */
  refused?: boolean;
  /** Left out of what is sent next time, together with the user message right before it. */
  excludeFromHistory?: boolean;
}

/**
 * The turns to send with the next question: every exchange except the ones the server refused.
 * A refused reply is dropped together with the user message right before it, so a refused question
 * isn't asked again inside the history (the server drops such pairs too, for older app builds).
 * A supportive reply (`refused: false`) is an answer like any other and stays.
 */
export function historyForRequest(messages: AiChatEntry[]): AiChatMessage[] {
  const out: AiChatMessage[] = [];
  for (const message of messages) {
    if (message.role === 'assistant' && (message.excludeFromHistory || message.refused)) {
      if (out.length > 0 && out[out.length - 1].role === 'user') out.pop();
      continue;
    }
    out.push({ role: message.role, content: message.content });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Notices and the paused state

const NOTICE_KINDS: readonly AiNoticeKind[] = [
  'REFUSED',
  'PAUSED',
  'SCHOOL_LIMIT',
  'USER_LIMIT',
  'TOO_LONG',
  'CHECK_FAILED',
  'OFF',
];

/** A notice's kind, with a kind this app doesn't know yet (from a newer server) read as 'REFUSED'. */
export function noticeKind(kind: unknown): AiNoticeKind {
  return NOTICE_KINDS.includes(kind as AiNoticeKind) ? (kind as AiNoticeKind) : 'REFUSED';
}

/**
 * A live helpdesk-bot message saying the bot is turned off (`aiNotice.kind = "OFF"`). Switching it
 * off takes a server restart, so a chat opened before that still shows it as on: the screen reads
 * GET /ai/status again to show the "off" banner.
 */
export function messageSaysOff(message: { aiNotice?: AiNotice | null } | null | undefined): boolean {
  const notice = message?.aiNotice;
  return notice !== null && notice !== undefined && noticeKind(notice.kind) === 'OFF';
}

/**
 * An Academic Helper error that may mean the feature was switched off since the screen opened (503
 * AI_UNAVAILABLE, which a provider failure also gives), so the status is worth reading again.
 * Duck-typed so this file needs no API client.
 */
export function errorMaySayOff(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { errorCode?: unknown }).errorCode === 'AI_UNAVAILABLE';
}

/** The value as an ISO instant, or null when it isn't one. */
function instant(value: unknown): string | null {
  return typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value)) ? value : null;
}

/** When a notice says the user is now paused until; null when it doesn't. */
export function pausedUntilFromNotice(notice: AiNotice | null | undefined): string | null {
  return instant(notice?.pausedUntil);
}

/** An Academic Helper reply's pause (the 5th refusal itself carries it). */
export function pausedUntilFromReply(response: { notice?: AiNotice | null } | null | undefined): string | null {
  return pausedUntilFromNotice(response?.notice);
}

/** A live helpdesk-bot message's pause (REST history never has one). */
export function pausedUntilFromMessage(message: { aiNotice?: AiNotice | null } | null | undefined): string | null {
  return pausedUntilFromNotice(message?.aiNotice);
}

/**
 * The pause in a 429 AI_PAUSED (`data.pausedUntil`); null for any other error. Duck-typed so this
 * file needs no API client.
 */
export function pausedUntilFromError(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const { errorCode, data } = error as { errorCode?: unknown; data?: unknown };
  if (errorCode !== 'AI_PAUSED' || !data || typeof data !== 'object') return null;
  return instant((data as { pausedUntil?: unknown }).pausedUntil);
}

/** True while `pausedUntil` is still ahead of `nowMs`. */
export function isPaused(pausedUntil: string | null | undefined, nowMs: number): boolean {
  const until = instant(pausedUntil);
  return until !== null && Date.parse(until) > nowMs;
}

/** Milliseconds left in the pause (0 when it's over or there's none). */
export function msUntilUnpaused(pausedUntil: string | null | undefined, nowMs: number): number {
  return isPaused(pausedUntil, nowMs) ? Date.parse(pausedUntil!) - nowMs : 0;
}

/** The pause `GET /ai/status` reports, if it hasn't ended yet. */
export function pausedUntilFromStatus(status: AiStatus | null | undefined, nowMs: number): string | null {
  if (!status?.paused) return null;
  return isPaused(status.pausedUntil, nowMs) ? status.pausedUntil : null;
}

/**
 * The pause to show after a GET /ai/status answer. The status is the server's word, except for a
 * request that started before the screen entered its current pause (from a reply's notice or a 429):
 * the server may have answered it before that pause began, so it can lengthen the pause but never
 * end or shorten it. The next status read settles it.
 */
export function pauseAfterStatus(
  current: string | null,
  fromStatus: string | null,
  startedBeforePause: boolean,
  nowMs: number
): string | null {
  if (!startedBeforePause || !isPaused(current, nowMs)) return fromStatus;
  // Only a later end than the one on show.
  const later = fromStatus !== null && Date.parse(fromStatus) > Date.parse(current!);
  return later ? fromStatus : current;
}

// setTimeout misbehaves past ~24.8 days; a pause is an hour, so this only guards odd data.
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

/**
 * Calls `onEnd` once `now()` has passed `pausedUntil`, and returns a function that cancels it.
 *
 * `now` is the server-corrected clock, whose offset is re-read from every response's Date header
 * (whole seconds, so it moves by up to about a second) and which a device clock change also moves.
 * So a timer can wake while the pause still has a little left: it then waits again for what is left,
 * instead of giving up and leaving the composer locked after the pause has ended. A pause longer than
 * the longest timer is waited out the same way.
 */
export function watchPauseEnd(
  pausedUntil: string,
  now: () => number,
  onEnd: () => void,
  maxTimerMs: number = MAX_TIMER_MS
): () => void {
  const delay = () => Math.min(msUntilUnpaused(pausedUntil, now()), maxTimerMs);
  const wake = () => {
    const left = delay();
    if (left > 0) {
      timer = setTimeout(wake, left);
      return;
    }
    onEnd();
  };
  // Always through a timer, even when it has already ended, so onEnd never runs inside the caller.
  let timer = setTimeout(wake, delay());
  return () => clearTimeout(timer);
}

/**
 * "4:15 PM" for when the pause ends, in the phone's time zone (or `timeZone`), with the day added
 * when it isn't today there ("14 Oct, 12:30 AM" for a pause running past midnight).
 */
export function pausedUntilLabel(
  pausedUntil: string,
  language: string,
  options: { now?: Date; timeZone?: string } = {}
): string {
  const date = new Date(pausedUntil);
  if (Number.isNaN(date.getTime())) return '';
  const { now = new Date(), timeZone } = options;
  const time = date.toLocaleTimeString(language, { hour: 'numeric', minute: '2-digit', timeZone });
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone });
  if (day(date) === day(now)) return time;
  return `${date.toLocaleDateString(language, { day: 'numeric', month: 'short', timeZone })}, ${time}`;
}

// ---------------------------------------------------------------------------------------------
// The admin's AI misuse log

/** The date ranges the log offers, in days ending today. Data lookups also go back a year. */
export const MISUSE_RANGES = [1, 7, 30, 90] as const;
export const LOOKUP_RANGES = [1, 7, 30, 90, 365] as const;
export type AiRangeDays = (typeof LOOKUP_RANGES)[number];

/** India dates `from`..`to` covering `days` days ending on `today` (YYYY-MM-DD). */
export function rangeForDays(days: number, today: string): { from: string; to: string } {
  return { from: shiftIsoDate(today, { days: -(Math.max(1, days) - 1) }), to: today };
}

/** Every category the server's guard can record: the classifier's, plus the two server-only ones. */
export const AI_CATEGORIES = [
  'study',
  'teaching',
  'school_info',
  'school_data',
  'school_admin',
  'timetable',
  'greeting',
  'follow_up',
  'wellbeing',
  'other_school',
  'entertainment',
  'chit_chat',
  'news_politics',
  'religion_debate',
  'shopping',
  'travel',
  'money_advice',
  'health_diagnosis',
  'outside_writing',
  'dating',
  'gaming_cheats',
  'cheating',
  'other',
  'others_records',
  'others_contact',
  'prompt_injection',
  'jailbreak',
  'prompt_extraction',
  'adult',
  'weapons',
  'substances',
  'violence',
  'harassment',
  'hacking',
  'fraud',
  'unsafe_other',
  'refusal_cyber',
  'refusal_bio',
] as const;

export const AI_VERDICTS = ['OFF_TOPIC', 'OTHERS_DATA', 'PROMPT_ATTACK', 'UNSAFE', 'MODEL_REFUSAL'] as const;

/** The helpdesk bot's tools, as the data-lookup log names them. */
export const AI_TOOLS = [
  'get_my_attendance',
  'get_my_fee_status',
  'get_my_subjects',
  'get_my_timetable',
  'get_my_teaching_assignments',
  'get_class_attendance',
  'get_class_marks',
  'get_class_fee_status',
  'query_school_metric',
  'get_timetable',
  'list_uncovered_periods',
  'find_free_teachers',
  'list_timetable_changes',
  'list_rooms',
  'propose_timetable_changes',
] as const;

export const AI_LOOKUP_OUTCOMES = ['OK', 'NOT_IN_SCOPE', 'CLARIFY', 'ERROR'] as const;

const AI_ROLES = ['STUDENT', 'TEACHER', 'PARENT', 'ADMIN'] as const;
const AI_FEATURES = ['BOT', 'ASSISTANT'] as const;

const has = (list: readonly string[], value: unknown): value is string =>
  typeof value === 'string' && list.includes(value);

/**
 * The server's snake_case values are camelCase in the translations: a key ending in `_other`
 * ("unsafe_other") would read as half of an i18next plural pair.
 */
const camel = (value: string) => value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The translation key for a category; one this app doesn't know shows as "Other". */
export function categoryLabelKey(category: unknown): string {
  return `aiMisuse.categories.${has(AI_CATEGORIES, category) ? camel(category) : 'other'}`;
}

/** The translation key for a verdict; an unknown one shows as plain "Refused". */
export function verdictLabelKey(verdict: unknown): string {
  return has(AI_VERDICTS, verdict) ? `aiMisuse.verdicts.${verdict}` : 'aiMisuse.verdicts.unknown';
}

/** The translation key for a feature, or null for one this app doesn't know. */
export function featureLabelKey(feature: unknown): string | null {
  return has(AI_FEATURES, feature) ? `ai.features.${feature}` : null;
}

/** The translation key for a role, or null for one this app doesn't know. */
export function roleLabelKey(role: unknown): string | null {
  return has(AI_ROLES, role) ? `aiMisuse.roles.${role}` : null;
}

/** The translation key for a lookup's outcome, or null for one this app doesn't know. */
export function outcomeLabelKey(outcome: unknown): string | null {
  return has(AI_LOOKUP_OUTCOMES, outcome) ? `aiMisuse.outcomes.${outcome}` : null;
}

/** The translation key for a bot tool, or null for one this app doesn't know (see toolFallbackLabel). */
export function toolLabelKey(tool: unknown): string | null {
  return has(AI_TOOLS, tool) ? `aiMisuse.tools.${camel(tool)}` : null;
}

/** "get_class_marks" -> "Get class marks", for a tool added after this build. */
export function toolFallbackLabel(tool: string): string {
  const words = tool.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : tool;
}

/**
 * The keys a lookup's scope can have: the class tools' own audit keys and the other tools' input
 * names (the server records those as they are). Each has words in `aiMisuse.scopeKeys`.
 */
export const AI_SCOPE_KEYS = [
  'class',
  'date',
  'from',
  'to',
  'day',
  'period',
  'teacher',
  'subject',
  'room',
  'term',
  'assessment',
  'academicYear',
  'status',
  'belowPercent',
  'listAll',
  'entity',
  'metric',
  'filters',
  'slots',
  'changes',
  'reason',
] as const;

/** The translation key for a scope key, or null for one this app doesn't know (shown as it is). */
export function scopeKeyLabelKey(key: unknown): string | null {
  return has(AI_SCOPE_KEYS, key) ? `aiMisuse.scopeKeys.${key}` : null;
}

function scopeValue(value: unknown, label: (key: string) => string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    const parts = value.map((item) => scopeValue(item, label)).filter((v): v is string => v !== null);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => {
        const text = scopeValue(inner, label);
        return text === null ? null : `${label(key)}=${text}`;
      })
      .filter((v): v is string => v !== null);
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return String(value);
}

/**
 * What a lookup asked for, on one line: "Class: 7 A · From: 2026-09-14 · To: 2026-10-13", each key
 * worded by `label` (the screen passes the translated words; the raw key without it). Ids (sectionId,
 * assessmentId) are left out - the class and title next to them say the same for a person. Nested
 * filters read "Filters: className=7, section=A".
 */
export function scopeSummary(
  scope: Record<string, unknown> | null | undefined,
  label: (key: string) => string = (key) => key
): string {
  if (!scope || typeof scope !== 'object') return '';
  return Object.entries(scope)
    .filter(([key]) => !/Id$/.test(key))
    .map(([key, value]) => {
      const text = scopeValue(value, label);
      return text === null ? null : `${label(key)}: ${text}`;
    })
    .filter((v): v is string => v !== null)
    .join(' · ');
}

/** What the log shows for one tab, range and person: their rows, a spinner, or why it couldn't. */
export type MisuseLogView = 'list' | 'loading' | 'error' | 'unavailable';

/** A first-page load that failed, for the query it was for. */
export interface MisuseLogFailure {
  key: string;
  /** The server has no such log (404: a server from before it, e.g. after a rollback). */
  unavailable: boolean;
}

/**
 * The rows on show are only ever the ones loaded for exactly `queryKey`: a failed load for it shows
 * the failure (never an empty "nothing refused" list, nor the previous filter's rows under the new
 * chip), and anything else shows the spinner until its first page arrives. Once its rows are there,
 * a failed refresh leaves them on show.
 */
export function misuseLogView(
  queryKey: string,
  loadedKey: string | null,
  failure: MisuseLogFailure | null
): MisuseLogView {
  if (loadedKey === queryKey) return 'list';
  if (failure?.key === queryKey) return failure.unavailable ? 'unavailable' : 'error';
  return 'loading';
}

/** A 404 from a list endpoint: the server doesn't have it. Duck-typed so this file needs no API client. */
export function isMissingEndpoint(error: unknown): boolean {
  return !!error && typeof error === 'object' && (error as { status?: unknown }).status === 404;
}
