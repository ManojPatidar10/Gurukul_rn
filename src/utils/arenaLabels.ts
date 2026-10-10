import type { TFunction } from 'i18next';

import { ApiError } from '../api/client';
import type { BattleRoomState, ChallengeSummaryResponse } from '../api/types';

/**
 * What the game screens say about a challenge or battle: Arena list chips, "Ends in" times, the XP
 * line under a result and a finished Battle's headline. Kept pure so every case is unit tested.
 */

export type ChallengeChipVariant = 'success' | 'warning' | 'error' | 'neutral' | 'info';

type ChallengeStatusFields = Pick<
  ChallengeSummaryResponse,
  'status' | 'draw' | 'youWon' | 'myAnsweredCount' | 'totalQuestions'
>;

/** The Arena list's status chip: the result once it's over, otherwise whether it's the student's move. */
export function challengeStatusLabel(c: ChallengeStatusFields, t: TFunction): string {
  switch (c.status) {
    case 'COMPLETED':
      if (c.draw) return t('games.labels.status.draw');
      return c.youWon ? t('games.labels.status.won') : t('games.labels.status.lost');
    case 'EXPIRED':
      return t('games.labels.status.expired');
    default:
      return c.myAnsweredCount < c.totalQuestions
        ? t('games.labels.status.yourTurn')
        : t('games.labels.status.waiting');
  }
}

export function challengeStatusVariant(c: ChallengeStatusFields): ChallengeChipVariant {
  switch (c.status) {
    case 'COMPLETED':
      if (c.draw) return 'neutral';
      return c.youWon ? 'success' : 'warning';
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'info';
  }
}

/** "Ends in 5h" or "Ends in 40 min" until `expiresAt`; null when it's missing, unreadable or past. */
export function endsInLabel(expiresAt: string | null | undefined, now: number, t: TFunction): string | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end) || end <= now) return null;
  const minutes = Math.ceil((end - now) / 60_000);
  return minutes < 60
    ? t('games.labels.endsInMinutes', { minutes })
    : t('games.labels.endsInHours', { hours: Math.floor(minutes / 60) });
}

/** endsInLabel for a challenge still being played; null once it's over (or on an older server). */
export function challengeEndsIn(
  c: Pick<ChallengeSummaryResponse, 'status' | 'expiresAt'>,
  now: number,
  t: TFunction
): string | null {
  return c.status === 'ACTIVE' ? endsInLabel(c.expiresAt, now, t) : null;
}

/** The XP line under a finished challenge the student won: what they got, or why they got nothing. */
export function challengeXpLine(
  c: Pick<ChallengeSummaryResponse, 'status' | 'draw' | 'youWon' | 'xpAwarded' | 'xpLimitReached' | 'opponentName'>,
  t: TFunction
): string | null {
  if (c.status !== 'COMPLETED' || c.draw || !c.youWon) return null;
  if ((c.xpAwarded ?? 0) > 0) return t('games.labels.xpAwarded', { xp: c.xpAwarded });
  if (c.xpLimitReached) return t('games.labels.xpLimitReached', { name: c.opponentName });
  return null;
}

/**
 * True when an answer was refused because the challenge is over - it ran out of time ("This
 * challenge has expired") or was already closed ("This challenge is no longer active"). The screen
 * reloads to show why instead of leaving the student on a question they can't answer. Takes the raw
 * error, not the message shown to the user: only the server's 400 refusal counts, so a lapsed login
 * ("Your session expired...") or a timeout is reported as an error, not treated as a closed challenge.
 */
export function isChallengeClosedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 400 && /expired|no longer active/i.test(error.message);
}

type BattleOutcomeFields = Pick<BattleRoomState, 'draw' | 'winnerStudentId' | 'winnerName'>;

/**
 * Whether a finished Battle has no winner: a level score, or nobody scored. Servers older than the
 * `draw` flag never leave a COMPLETED room without a winner, so a missing winner means a tie too.
 */
export function isBattleTie(room: BattleOutcomeFields): boolean {
  return room.draw === true || !room.winnerStudentId;
}

/** A finished Battle's headline. */
export function battleResultTitle(room: BattleOutcomeFields, t: TFunction): string {
  if (isBattleTie(room)) return t('games.labels.battleTie');
  return t('games.labels.battleWinner', { name: room.winnerName ?? t('games.labels.someone') });
}
