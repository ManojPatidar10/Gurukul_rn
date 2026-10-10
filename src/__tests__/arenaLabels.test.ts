import { ApiError, NetworkError, SessionExpiredError } from '../api/client';
import type { ChallengeSummaryResponse } from '../api/types';
import hi from '../i18n/locales/hi.json';
import {
  battleResultTitle,
  challengeEndsIn,
  challengeStatusLabel,
  challengeStatusVariant,
  challengeXpLine,
  endsInLabel,
  isBattleTie,
  isChallengeClosedError,
} from '../utils/arenaLabels';
import { fill, tEn, tHi } from './i18nFixture';

jest.mock('../api/authStorage', () => ({ setStoredSession: jest.fn(() => Promise.resolve()) }));

function challenge(partial: Partial<ChallengeSummaryResponse>): ChallengeSummaryResponse {
  return {
    id: 'c1',
    subjectName: 'Maths',
    opponentName: 'Riya',
    status: 'ACTIVE',
    totalQuestions: 5,
    myAnsweredCount: 0,
    opponentAnsweredCount: 0,
    youWon: null,
    draw: false,
    ...partial,
  };
}

const NOW = Date.parse('2026-10-10T10:00:00Z');

describe('challengeStatusLabel / challengeStatusVariant', () => {
  it('shows the result of a finished challenge', () => {
    const won = challenge({ status: 'COMPLETED', youWon: true });
    const lost = challenge({ status: 'COMPLETED', youWon: false });
    const draw = challenge({ status: 'COMPLETED', draw: true, youWon: null });
    expect(challengeStatusLabel(won, tEn)).toBe('You won');
    expect(challengeStatusLabel(lost, tEn)).toBe('You lost');
    expect(challengeStatusLabel(draw, tEn)).toBe('Draw');
    expect(challengeStatusVariant(won)).toBe('success');
    expect(challengeStatusVariant(lost)).toBe('warning');
    expect(challengeStatusVariant(draw)).toBe('neutral');
  });

  it('shows an expired challenge as Expired', () => {
    const expired = challenge({ status: 'EXPIRED', myAnsweredCount: 2 });
    expect(challengeStatusLabel(expired, tEn)).toBe('Expired');
    expect(challengeStatusVariant(expired)).toBe('neutral');
  });

  it("says whose move it is while active, never the raw status", () => {
    expect(challengeStatusLabel(challenge({ myAnsweredCount: 0 }), tEn)).toBe('Your turn');
    expect(challengeStatusLabel(challenge({ myAnsweredCount: 4 }), tEn)).toBe('Your turn');
    expect(challengeStatusLabel(challenge({ myAnsweredCount: 5 }), tEn)).toBe('Waiting');
    expect(challengeStatusVariant(challenge({}))).toBe('info');
  });
});

describe('endsInLabel / challengeEndsIn', () => {
  it('shows whole hours, or minutes in the last hour', () => {
    expect(endsInLabel('2026-10-10T15:30:00Z', NOW, tEn)).toBe('Ends in 5h');
    expect(endsInLabel('2026-10-12T10:00:00Z', NOW, tEn)).toBe('Ends in 48h');
    expect(endsInLabel('2026-10-10T10:40:00Z', NOW, tEn)).toBe('Ends in 40 min');
    expect(endsInLabel('2026-10-10T10:00:20Z', NOW, tEn)).toBe('Ends in 1 min');
    expect(endsInLabel('2026-10-10T10:59:30Z', NOW, tEn)).toBe('Ends in 1h');
  });

  it('shows nothing when expiresAt is missing, unreadable or past', () => {
    expect(endsInLabel(undefined, NOW, tEn)).toBeNull();
    expect(endsInLabel(null, NOW, tEn)).toBeNull();
    expect(endsInLabel('not a date', NOW, tEn)).toBeNull();
    expect(endsInLabel('2026-10-10T10:00:00Z', NOW, tEn)).toBeNull();
    expect(endsInLabel('2026-10-10T09:00:00Z', NOW, tEn)).toBeNull();
  });

  it('only counts down a challenge that is still being played', () => {
    const expiresAt = '2026-10-10T15:00:00Z';
    expect(challengeEndsIn(challenge({ expiresAt }), NOW, tEn)).toBe('Ends in 5h');
    expect(challengeEndsIn(challenge({ status: 'COMPLETED', youWon: true, expiresAt }), NOW, tEn)).toBeNull();
    expect(challengeEndsIn(challenge({ status: 'EXPIRED', expiresAt }), NOW, tEn)).toBeNull();
    // An older server doesn't send expiresAt.
    expect(challengeEndsIn(challenge({}), NOW, tEn)).toBeNull();
  });

  it('counts down in Hindi too, in minutes and in hours', () => {
    expect(endsInLabel('2026-10-10T10:40:00Z', NOW, tHi)).toBe(fill(hi.games.labels.endsInMinutes, { minutes: 40 }));
    expect(endsInLabel('2026-10-10T15:30:00Z', NOW, tHi)).toBe(fill(hi.games.labels.endsInHours, { hours: 5 }));
    expect(challengeStatusLabel(challenge({}), tHi)).toBe(hi.games.labels.status.yourTurn);
  });
});

describe('challengeXpLine', () => {
  it('shows the XP a winner got', () => {
    expect(challengeXpLine(challenge({ status: 'COMPLETED', youWon: true, xpAwarded: 25 }), tEn)).toBe('+25 XP');
  });

  it("explains a win that gave no XP because of the pair's daily limit", () => {
    expect(
      challengeXpLine(challenge({ status: 'COMPLETED', youWon: true, xpAwarded: 0, xpLimitReached: true }), tEn)
    ).toBe("No XP this time: you've reached today's limit for challenges with Riya");
  });

  it('says nothing for a loss, a draw, an unfinished challenge or an older server', () => {
    expect(challengeXpLine(challenge({ status: 'COMPLETED', youWon: false, xpAwarded: 25 }), tEn)).toBeNull();
    expect(challengeXpLine(challenge({ status: 'COMPLETED', draw: true, xpLimitReached: true }), tEn)).toBeNull();
    expect(challengeXpLine(challenge({ status: 'EXPIRED' }), tEn)).toBeNull();
    expect(challengeXpLine(challenge({ status: 'ACTIVE' }), tEn)).toBeNull();
    expect(challengeXpLine(challenge({ status: 'COMPLETED', youWon: true }), tEn)).toBeNull();
  });

  it("keeps the opponent's name in the Hindi limit line", () => {
    const limited = challenge({ status: 'COMPLETED', youWon: true, xpAwarded: 0, xpLimitReached: true });
    const line = challengeXpLine(limited, tHi);
    expect(line).toBe(fill(hi.games.labels.xpLimitReached, { name: 'Riya' }));
    expect(line).toContain('Riya');
  });
});

describe('isChallengeClosedError', () => {
  it("spots the server's refusals that mean the challenge is over", () => {
    expect(isChallengeClosedError(new ApiError('This challenge has expired', 400))).toBe(true);
    expect(isChallengeClosedError(new ApiError('This challenge is no longer active', 400))).toBe(true);
  });

  it('treats every other failure as an error, even one whose wording mentions expiry', () => {
    expect(isChallengeClosedError(new ApiError('You already answered this question', 400))).toBe(false);
    // Its message is "Your session expired, please log in again." - a lapsed login, not a closed challenge.
    expect(isChallengeClosedError(new SessionExpiredError())).toBe(false);
    expect(isChallengeClosedError(new ApiError('This challenge has expired', 500))).toBe(false);
    expect(isChallengeClosedError(new NetworkError('timeout'))).toBe(false);
    expect(isChallengeClosedError(new Error('This challenge has expired'))).toBe(false);
    expect(isChallengeClosedError(null)).toBe(false);
  });
});

describe('battle result', () => {
  it('names a single winner', () => {
    const room = { draw: false, winnerStudentId: 's1', winnerName: 'Aarav' };
    expect(isBattleTie(room)).toBe(false);
    expect(battleResultTitle(room, tEn)).toBe('Aarav wins!');
  });

  it('calls a draw, or a finished room with no winner, a tie', () => {
    const tie = "It's a tie: no winner and no XP this time";
    expect(battleResultTitle({ draw: true, winnerStudentId: null, winnerName: null }, tEn)).toBe(tie);
    expect(battleResultTitle({ winnerStudentId: null, winnerName: null }, tEn)).toBe(tie);
    expect(isBattleTie({ draw: undefined, winnerStudentId: null, winnerName: null })).toBe(true);
  });

  it('falls back to "Someone" for a winner with no name', () => {
    expect(battleResultTitle({ draw: false, winnerStudentId: 's1', winnerName: null }, tEn)).toBe('Someone wins!');
    expect(battleResultTitle({ draw: false, winnerStudentId: 's1', winnerName: 'Aarav' }, tHi)).toBe(
      fill(hi.games.labels.battleWinner, { name: 'Aarav' })
    );
  });
});
