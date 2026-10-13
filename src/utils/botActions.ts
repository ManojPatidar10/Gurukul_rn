import type { TFunction } from 'i18next';

import type { BotAction, BotActionItem, BotCellState } from '../api/types';
import { formatIsoDate } from './timetable';

/**
 * Pure helpers for the helpdesk bot's action card (a timetable proposal an admin confirms). The
 * card's facts all come from the server; these only decide what it says in the app's language and
 * whether its buttons show.
 */

export type BotActionChip = 'waiting' | 'saved' | 'failed' | 'cancelled' | 'expired' | 'replaced' | 'unknown';
export type BotActionChipVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

const CHIP_BY_STATUS: Record<string, BotActionChip> = {
  PENDING: 'waiting',
  EXECUTED: 'saved',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  SUPERSEDED: 'replaced',
};

const CHIP_VARIANT: Record<BotActionChip, BotActionChipVariant> = {
  waiting: 'info',
  saved: 'success',
  failed: 'error',
  cancelled: 'neutral',
  expired: 'neutral',
  replaced: 'neutral',
  unknown: 'neutral',
};

/** Who is looking at the card: only the admin who asked gets the buttons. */
export interface BotActionViewer {
  ownerType: string;
  ownerId: string;
}

export interface BotActionCardState {
  /** The status to show: a PENDING card past its deadline (by the corrected phone clock) is EXPIRED. */
  status: string;
  chip: BotActionChip;
  /** Confirm and Cancel show: PENDING, the viewer asked for it, and there is time left. */
  canAct: boolean;
  /** Time left while PENDING (Infinity when the server sent no readable expiry); 0 otherwise. */
  msLeft: number;
}

/**
 * When the card expires by the phone's clock: the server's `expiresAt`, moved by how far the phone's
 * clock was from the server's when the card arrived (`receivedAtMs` vs `serverTime`).
 */
export function clientDeadlineMs(action: Pick<BotAction, 'expiresAt' | 'serverTime'>, receivedAtMs: number): number {
  const expires = Date.parse(action.expiresAt);
  const server = Date.parse(action.serverTime);
  const skew = Number.isNaN(server) ? 0 : receivedAtMs - server;
  return expires + skew;
}

export function botActionCardState(
  action: BotAction,
  viewer: BotActionViewer | null | undefined,
  nowMs: number,
  receivedAtMs: number
): BotActionCardState {
  let status = String(action.status);
  let msLeft = 0;
  if (status === 'PENDING') {
    const deadline = clientDeadlineMs(action, receivedAtMs);
    msLeft = Number.isNaN(deadline) ? Number.POSITIVE_INFINITY : Math.max(0, deadline - nowMs);
    if (msLeft <= 0) status = 'EXPIRED';
  }
  const isRequester =
    !!viewer && viewer.ownerType === action.requestedByOwnerType && viewer.ownerId === action.requestedByOwnerId;
  return {
    status,
    chip: CHIP_BY_STATUS[status] ?? 'unknown',
    canAct: status === 'PENDING' && isRequester && msLeft > 0,
    msLeft,
  };
}

export function botActionChipVariant(chip: BotActionChip): BotActionChipVariant {
  return CHIP_VARIANT[chip];
}

/** The chip's words; an unknown status (from a newer server) is shown as it came. */
export function botActionChipLabel(state: BotActionCardState, t: TFunction): string {
  if (state.chip === 'unknown') return state.status;
  return t(`helpdeskBot.card.status.${state.chip}`);
}

/** "3 timetable changes", in the app's language (the server's English title if the count is odd). */
export function botActionTitle(action: BotAction, t: TFunction): string {
  if (typeof action.changeCount !== 'number' || action.changeCount < 1) return action.title;
  return t('helpdeskBot.card.title', { count: action.changeCount });
}

/** "Expires in 12 min" for a waiting card; null when there is no countdown to show. */
export function botActionExpiresIn(state: BotActionCardState, t: TFunction): string | null {
  if (state.status !== 'PENDING' || !Number.isFinite(state.msLeft) || state.msLeft <= 0) return null;
  return t('helpdeskBot.card.expiresIn', { minutes: Math.max(1, Math.ceil(state.msLeft / 60_000)) });
}

/** "Couldn't save: <reason>" for a FAILED card with a reason. */
export function botActionFailureText(action: BotAction, t: TFunction): string | null {
  if (action.status !== 'FAILED' || !action.failureReason) return null;
  return t('helpdeskBot.card.failedReason', { reason: action.failureReason });
}

const DATED_KINDS = new Set(['SUBSTITUTE', 'CANCEL', 'EXTRA', 'UNDO']);
const DAYS = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

/** "Wed, 14 Oct, period 3 (09:20-10:00) (already over)" or "Every Monday, period 2 (08:40-09:20)". */
function whenText(item: BotActionItem, t: TFunction, language?: string): string | null {
  let when: string;
  if (DATED_KINDS.has(item.kind)) {
    if (!item.date) return null;
    when = t('helpdeskBot.item.whenDate', { date: formatIsoDate(item.date, language), n: item.periodNumber });
  } else {
    if (!DAYS.has(item.dayOfWeek)) return null;
    when = t('helpdeskBot.item.whenWeekly', { day: t(`helpdeskBot.days.${item.dayOfWeek}`), n: item.periodNumber });
  }
  if (item.startTime && item.endTime) {
    when += ` ${t('helpdeskBot.item.times', { start: item.startTime, end: item.endTime })}`;
  }
  if (item.periodEnded) when += ` ${t('helpdeskBot.item.ended')}`;
  return when;
}

/**
 * The teacher who takes the period, with a bracket like the server's summary: who they are when
 * someone else shares their name, and that they won't be notified when they have no app login.
 */
function teacherText(cell: BotCellState | null, t: TFunction): string | null {
  if (!cell?.teacherName) return null;
  const extras = [cell.teacherDetail, cell.teacherHasLogin === false ? t('helpdeskBot.card.noLogin') : null].filter(
    (part): part is string => !!part
  );
  return extras.length ? `${cell.teacherName} (${extras.join(', ')})` : cell.teacherName;
}

function subjectWithTeacher(cell: BotCellState, t: TFunction): string | null {
  if (!cell.subjectName || !cell.teacherName) return null;
  return t('helpdeskBot.item.subjectWithTeacher', { subject: cell.subjectName, teacher: cell.teacherName });
}

export interface FormattedBotActionItem {
  /** The change in one line. */
  text: string;
  /** "Room: Lab 2" when the change moves the period to another room; null otherwise. */
  room: string | null;
}

/**
 * One change of a card in the app's language, built from the item's structured fields so it says
 * the same as the server's English `summary` - which is what shows for a kind this app doesn't know
 * or an item missing a field the line needs.
 */
export function formatBotActionItem(item: BotActionItem, t: TFunction, language?: string): FormattedBotActionItem {
  const fallback: FormattedBotActionItem = { text: item.summary, room: null };
  const when = whenText(item, t, language);
  if (!when) return fallback;

  const { before, after } = item;
  const cls = item.classLabel;
  const subject = after?.subjectName ?? before?.subjectName ?? null;
  const teacher = teacherText(after, t);
  let text: string | null = null;

  switch (item.kind) {
    case 'SUBSTITUTE': {
      if (!teacher || !subject) break;
      if (item.replacesExisting) {
        const original = before?.teacherName;
        const regular = item.regularTeacherName;
        if (!original || !regular) break;
        text = t('helpdeskBot.item.replacing', { when, class: cls, teacher, subject, original, regular });
      } else {
        const original = item.regularTeacherName ?? before?.teacherName;
        if (!original) break;
        text = t('helpdeskBot.item.substitute', { when, class: cls, teacher, subject, original });
      }
      break;
    }
    case 'CANCEL':
      if (subject) text = t('helpdeskBot.item.cancel', { when, class: cls, subject });
      break;
    case 'EXTRA':
      if (teacher && subject) text = t('helpdeskBot.item.extra', { when, class: cls, teacher, subject });
      break;
    case 'UNDO':
      text =
        item.undoesKind === 'EXTRA'
          ? t('helpdeskBot.item.undoExtra', { when, class: cls })
          : t('helpdeskBot.item.undo', { when, class: cls });
      break;
    case 'SET': {
      const was = before ? subjectWithTeacher(before, t) : t('helpdeskBot.item.wasFree');
      if (teacher && after?.subjectName && was) {
        text = t('helpdeskBot.item.set', { when, class: cls, teacher, subject: after.subjectName, before: was });
      }
      break;
    }
    case 'CLEAR': {
      const was = before ? subjectWithTeacher(before, t) : null;
      if (was) text = t('helpdeskBot.item.clear', { when, class: cls, before: was });
      break;
    }
    default:
      break;
  }
  if (!text) return fallback;

  const newRoom = after?.roomName;
  const room = newRoom && newRoom !== (before?.roomName ?? null) ? t('helpdeskBot.card.room', { room: newRoom }) : null;
  return { text, room };
}

/**
 * The notes under a card's changes: the reason the teachers involved will see, then one line per
 * teacher a SET also assigns to a class, saying the access that gives them.
 */
export function botActionNotes(action: BotAction, t: TFunction): string[] {
  const notes: string[] = [];
  if (action.reason) notes.push(t('helpdeskBot.card.reason', { reason: action.reason }));
  for (const item of action.items ?? []) {
    if (!item.assignsTeacher || !item.after?.teacherName || !item.after.subjectName) continue;
    notes.push(
      t('helpdeskBot.card.assigns', { teacher: item.after.teacherName, subject: item.after.subjectName, class: item.classLabel })
    );
  }
  return notes;
}

/** How many changes of the card also give a teacher access to a class. */
export function assignmentCount(action: BotAction): number {
  return (action.items ?? []).filter((item) => item.assignsTeacher).length;
}

/**
 * The confirm alert's body: what saving does, plus the class access it grants and the reason the
 * teachers will see - the two things on the card worth a second look before pushing to classes.
 */
export function confirmAlertBody(action: BotAction, t: TFunction): string {
  const parts = [t('helpdeskBot.card.confirmBody')];
  const assigns = assignmentCount(action);
  if (assigns > 0) parts.push(t('helpdeskBot.card.confirmAssigns', { count: assigns }));
  if (action.reason) parts.push(t('helpdeskBot.card.confirmReason', { reason: action.reason }));
  return parts.join('\n\n');
}

const NOT_PENDING_STATUSES = new Set(['EXECUTED', 'CANCELLED', 'EXPIRED', 'SUPERSEDED', 'FAILED']);

/**
 * Why a card can't be confirmed or cancelled any more, from a 409 BOT_ACTION_NOT_PENDING's
 * `data.status`, in the app's language. Null for any other status - the caller then shows the
 * error's own message.
 */
export function notPendingMessage(status: unknown, t: TFunction): string | null {
  if (typeof status !== 'string' || !NOT_PENDING_STATUSES.has(status)) return null;
  return t(`helpdeskBot.card.notPending.${status}`);
}

/** True for something shaped like a card from the server (e.g. a 409's `data`). */
export function isBotAction(value: unknown): value is BotAction {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<BotAction>;
  return (
    typeof v.id === 'string' &&
    typeof v.messageId === 'string' &&
    typeof v.status === 'string' &&
    typeof v.version === 'number' &&
    Array.isArray(v.items)
  );
}
