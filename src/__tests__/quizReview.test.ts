import type { QuizOption, QuizReviewItem } from '../api/types';
import { answerKeyChanged, reviewOptionMark } from '../utils/quizReview';

type Marks = Pick<QuizReviewItem, 'correctOption' | 'selectedOption' | 'correct'>;

const ALL: QuizOption[] = ['A', 'B', 'C', 'D'];

/** Every option's mark, as "A:tone:tag" for the ones that get one. */
function marked(item: Marks): string[] {
  return ALL.map((o) => ({ o, mark: reviewOptionMark(item, o) }))
    .filter(({ mark }) => mark.tone !== null)
    .map(({ o, mark }) => `${o}:${mark.tone}:${mark.tag}`);
}

describe('reviewOptionMark / answerKeyChanged', () => {
  it('marks a right answer once, as the student answer', () => {
    const item = { correctOption: 'B', selectedOption: 'B', correct: true } as const;
    expect(marked(item)).toEqual(['B:right:Your answer ✓']);
    expect(answerKeyChanged(item)).toBe(false);
  });

  it('marks a wrong answer red and the key green', () => {
    const item = { correctOption: 'C', selectedOption: 'A', correct: false } as const;
    expect(marked(item)).toEqual(['A:wrong:Your answer', 'C:right:Correct answer']);
    expect(answerKeyChanged(item)).toBe(false);
  });

  it('shows only the key for an unanswered question', () => {
    const item = { correctOption: 'D', selectedOption: null, correct: false } as const;
    expect(marked(item)).toEqual(['D:right:Correct answer']);
    expect(answerKeyChanged(item)).toBe(false);
  });

  it('keeps a right mark when the key was later moved to another option', () => {
    // Answered B, marked right; the teacher then changed the key to C.
    const item = { correctOption: 'C', selectedOption: 'B', correct: true } as const;
    expect(marked(item)).toEqual(['B:right:Your answer ✓', 'C:right:Correct answer now']);
    expect(answerKeyChanged(item)).toBe(true);
  });

  it('keeps a wrong mark when the key was later moved to the chosen option', () => {
    // Answered B, marked wrong; a report got the key fixed to B. The option still agrees with the "Wrong" chip.
    const item = { correctOption: 'B', selectedOption: 'B', correct: false } as const;
    expect(marked(item)).toEqual(['B:wrong:Your answer (correct now)']);
    expect(answerKeyChanged(item)).toBe(true);
  });

  it('keeps a wrong mark when the key moved between two other options', () => {
    const item = { correctOption: 'D', selectedOption: 'A', correct: false } as const;
    expect(marked(item)).toEqual(['A:wrong:Your answer', 'D:right:Correct answer']);
    expect(answerKeyChanged(item)).toBe(false);
  });
});
