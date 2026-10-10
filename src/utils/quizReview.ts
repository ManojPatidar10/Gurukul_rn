import type { TFunction } from 'i18next';

import type { QuizOption, QuizReviewItem } from '../api/types';

/**
 * How the end-of-game review (components/QuizReviewList) marks each option. It has two sources that
 * can disagree: `correct` is the mark recorded when the student answered, while `correctOption` is
 * the question's current answer key, which a teacher may have fixed since (say, after a report).
 * Past answers are never re-marked, so the student's own option is coloured and tagged from
 * `correct` - it always agrees with the card's Right/Wrong chip - and the current key is shown
 * separately, with a note when the two no longer match.
 */

export type ReviewOptionTone = 'right' | 'wrong';

export interface ReviewOptionMark {
  /** Green for right, red for wrong, null for an option that is neither chosen nor the key. */
  tone: ReviewOptionTone | null;
  tag: string | null;
}

type ReviewMarkFields = Pick<QuizReviewItem, 'correctOption' | 'selectedOption' | 'correct'>;

/** True when the answer key was changed after the student answered, so their mark no longer matches it. */
export function answerKeyChanged(item: ReviewMarkFields): boolean {
  if (!item.selectedOption) return false;
  return (item.selectedOption === item.correctOption) !== item.correct;
}

export function reviewOptionMark(item: ReviewMarkFields, option: QuizOption, t: TFunction): ReviewOptionMark {
  const isKey = item.correctOption === option;
  if (item.selectedOption === option) {
    if (item.correct) return { tone: 'right', tag: t('games.review.tags.yourAnswerRight') };
    // Marked wrong when it was given, though the key has since been changed to this option.
    return {
      tone: 'wrong',
      tag: isKey ? t('games.review.tags.yourAnswerCorrectNow') : t('games.review.tags.yourAnswer'),
    };
  }
  if (isKey) {
    return {
      tone: 'right',
      tag: answerKeyChanged(item) ? t('games.review.tags.correctAnswerNow') : t('games.review.tags.correctAnswer'),
    };
  }
  return { tone: null, tag: null };
}
