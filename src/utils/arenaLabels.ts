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
export function challengeStatusLabel(c: ChallengeStatusFields): string {
  switch (c.status) {
    case 'COMPLETED':
      if (c.draw) return 'Draw';
      return c.youWon ? 'You won' : 'You lost';
    case 'EXPIRED':
      return 'Expired';
    default:
      return c.myAnsweredCount < c.totalQuestions ? 'Your turn' : 'Waiting';
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
export function endsInLabel(expiresAt: string | null | undefined, now: number): string | null {
  if (!expiresAt) return null;
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end) || end <= now) return null;
  const minutes = Math.ceil((end - now) / 60_000);
  return minutes < 60 ? `Ends in ${minutes} min` : `Ends in ${Math.floor(minutes / 60)}h`;
}

/** endsInLabel for a challenge still being played; null once it's over (or on an older server). */
export function challengeEndsIn(c: Pick<ChallengeSummaryResponse, 'status' | 'expiresAt'>, now: number): string | null {
  return c.status === 'ACTIVE' ? endsInLabel(c.expiresAt, now) : null;
}

/** The XP line under a finished challenge the student won: what they got, or why they got nothing. */
export function challengeXpLine(
  c: Pick<ChallengeSummaryResponse, 'status' | 'draw' | 'youWon' | 'xpAwarded' | 'xpLimitReached' | 'opponentName'>
): string | null {
  if (c.status !== 'COMPLETED' || c.draw || !c.youWon) return null;
  if ((c.xpAwarded ?? 0) > 0) return `+${c.xpAwarded} XP`;
  if (c.xpLimitReached) {
    return `No XP this time: you've reached today's limit for challenges with ${c.opponentName}`;
  }
  return null;
}

/**
 * True when an answer was refused because the challenge is over - it ran out of time ("This
 * challenge has expired") or was already closed ("This challenge is no longer active"). The screen
 * reloads to show why instead of leaving the student on a question they can't answer.
 */
export function isChallengeClosedError(message: string | null | undefined): boolean {
  return /expired|no longer active/i.test(message ?? '');
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
export function battleResultTitle(room: BattleOutcomeFields): string {
  if (isBattleTie(room)) return "It's a tie: no winner and no XP this time";
  return `${room.winnerName ?? 'Someone'} wins!`;
}
