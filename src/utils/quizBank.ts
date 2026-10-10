import type { BankQuestionInput, GeneratedQuizQuestion, QuizOption, QuizQuestionType } from '../api/types';

/**
 * Turning AI-generated quiz questions into question-bank drafts the teacher reviews before saving.
 * The rules mirror the backend (QuizAnswerChecker / QuestionBankService's shared validation) so the
 * review and question-author screens can flag a problem before the request is sent; the server
 * still re-checks everything.
 */

export const BANK_LIMITS = { question: 500, option: 255, answer: 255, explanation: 1000 } as const;
export const OPTION_LETTERS: QuizOption[] = ['A', 'B', 'C', 'D'];

export interface BankDraft {
  /** The generated question's number, for display and as a stable key. */
  number: number;
  questionType: QuizQuestionType;
  questionText: string;
  options: [string, string, string, string];
  correctOption: QuizOption | null;
  answerText: string;
  /** Why the answer is right; shown to students only after they answer. Blank = none. */
  explanation: string;
}

/** Why a draft can't be saved; each value is an i18n key suffix under teacherTools.bank.errors. */
export type BankDraftError =
  | 'questionText'
  | 'questionTooLong'
  | 'optionsMissing'
  | 'optionsDuplicate'
  | 'optionTooLong'
  | 'correctOption'
  | 'numericAnswer'
  | 'shortWordAnswer'
  | 'answerTooLong'
  | 'explanationTooLong';

export function normalizeWords(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function wordCount(value: string | null | undefined): number {
  const normalized = normalizeWords(value);
  return normalized === '' ? 0 : normalized.split(' ').length;
}

/** A plain decimal number, as the server's BigDecimal parse accepts it ("42", "-3.5", ".25", "1e3"). */
export function isNumericAnswer(value: string | null | undefined): boolean {
  return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test((value ?? '').trim());
}

export function isShortWordAnswer(value: string | null | undefined): boolean {
  const words = wordCount(value);
  return words >= 1 && words <= 2;
}

/**
 * Which bank type a generated question can become, or null if it belongs on the paper only. Only a
 * four-option multiple-choice question qualifies: the Arena, Practice and Battle games serve MCQ
 * only, so number and short-word questions would sit in the bank unplayed, and true/false has two
 * options where the bank needs four different ones. Every type still goes into the shared PDF.
 */
export function suggestBankType(q: GeneratedQuizQuestion): QuizQuestionType | null {
  return q.questionType === 'MCQ' && q.options.length === 4 ? 'MCQ' : null;
}

export function isBankEligible(q: GeneratedQuizQuestion): boolean {
  return suggestBankType(q) !== null;
}

function correctOptionFor(q: GeneratedQuizQuestion): QuizOption | null {
  const answer = normalizeWords(q.answer);
  const index = q.options.findIndex((o) => normalizeWords(o) === answer);
  if (index >= 0 && index < 4) return OPTION_LETTERS[index];
  const letter = /^\(?([A-Da-d])\)?[.)]?$/.exec(q.answer.trim());
  return letter ? (letter[1].toUpperCase() as QuizOption) : null;
}

export function toBankDraft(q: GeneratedQuizQuestion): BankDraft | null {
  const questionType = suggestBankType(q);
  if (!questionType) return null;
  const opts = q.options;
  return {
    number: q.number,
    questionType,
    questionText: q.question.trim(),
    options: [opts[0] ?? '', opts[1] ?? '', opts[2] ?? '', opts[3] ?? ''],
    correctOption: questionType === 'MCQ' ? correctOptionFor(q) : null,
    answerText: questionType === 'MCQ' ? '' : q.answer.trim(),
    explanation: (q.explanation ?? '').trim().slice(0, BANK_LIMITS.explanation),
  };
}

export function validateBankDraft(d: BankDraft): BankDraftError | null {
  const text = d.questionText.trim();
  if (!text) return 'questionText';
  if (text.length > BANK_LIMITS.question) return 'questionTooLong';
  if (d.explanation.trim().length > BANK_LIMITS.explanation) return 'explanationTooLong';
  switch (d.questionType) {
    case 'MCQ': {
      const options = d.options.map((o) => o.trim());
      if (options.some((o) => o === '')) return 'optionsMissing';
      if (options.some((o) => o.length > BANK_LIMITS.option)) return 'optionTooLong';
      if (new Set(options.map(normalizeWords)).size < 4) return 'optionsDuplicate';
      if (!d.correctOption) return 'correctOption';
      return null;
    }
    case 'NUMERIC':
      if (!isNumericAnswer(d.answerText)) return 'numericAnswer';
      return null;
    case 'SHORT_WORD':
      if (!isShortWordAnswer(d.answerText)) return 'shortWordAnswer';
      if (d.answerText.trim().length > BANK_LIMITS.answer) return 'answerTooLong';
      return null;
    default:
      return null;
  }
}

export function toBankInput(d: BankDraft): BankQuestionInput {
  const questionText = d.questionText.trim();
  // Sent only when there is one - a blank explanation is stored as none anyway.
  const explanation = d.explanation.trim();
  const extra = explanation ? { explanation } : {};
  if (d.questionType === 'MCQ') {
    const [optionA, optionB, optionC, optionD] = d.options.map((o) => o.trim());
    return {
      questionType: 'MCQ',
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctOption: d.correctOption ?? undefined,
      ...extra,
    };
  }
  return { questionType: d.questionType, questionText, answerText: d.answerText.trim().replace(/\s+/g, ' '), ...extra };
}
