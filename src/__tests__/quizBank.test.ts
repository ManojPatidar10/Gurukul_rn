import type { GeneratedQuizQuestion } from '../api/types';
import {
  isNumericAnswer,
  isShortWordAnswer,
  suggestBankType,
  toBankDraft,
  toBankInput,
  validateBankDraft,
  type BankDraft,
} from '../utils/quizBank';

function q(partial: Partial<GeneratedQuizQuestion>): GeneratedQuizQuestion {
  return {
    number: 1,
    questionType: 'MCQ',
    question: 'What is 2 + 2?',
    options: [],
    answer: '',
    explanation: '',
    marks: 1,
    ...partial,
  };
}

describe('quizBank answer rules (mirror the server)', () => {
  it('accepts plain numbers only', () => {
    expect(isNumericAnswer('42')).toBe(true);
    expect(isNumericAnswer(' -3.5 ')).toBe(true);
    expect(isNumericAnswer('.25')).toBe(true);
    expect(isNumericAnswer('1e3')).toBe(true);
    expect(isNumericAnswer('3/4')).toBe(false);
    expect(isNumericAnswer('5 kg')).toBe(false);
    expect(isNumericAnswer('')).toBe(false);
  });

  it('accepts one or two words', () => {
    expect(isShortWordAnswer('Photosynthesis')).toBe(true);
    expect(isShortWordAnswer('  New   Delhi ')).toBe(true);
    expect(isShortWordAnswer('the water cycle')).toBe(false);
    expect(isShortWordAnswer('   ')).toBe(false);
  });
});

describe('suggestBankType', () => {
  it('keeps MCQs with four options', () => {
    expect(suggestBankType(q({ options: ['3', '4', '5', '6'], answer: '4' }))).toBe('MCQ');
    expect(suggestBankType(q({ options: ['3', '4'], answer: '4' }))).toBeNull();
  });

  it('keeps number, short-word and short-answer questions on the paper (games serve MCQ only)', () => {
    expect(suggestBankType(q({ questionType: 'NUMERIC', answer: '8' }))).toBeNull();
    expect(suggestBankType(q({ questionType: 'SHORT_WORD', answer: 'Oxygen' }))).toBeNull();
    expect(suggestBankType(q({ questionType: 'SHORT_ANSWER', answer: '12.5' }))).toBeNull();
    expect(suggestBankType(q({ questionType: 'SHORT_ANSWER', answer: 'Mitochondria' }))).toBeNull();
  });

  it('never offers long answers or true/false', () => {
    expect(suggestBankType(q({ questionType: 'LONG_ANSWER', answer: 'Essay' }))).toBeNull();
    expect(suggestBankType(q({ questionType: 'TRUE_FALSE', options: ['True', 'False'], answer: 'True' }))).toBeNull();
  });
});

function typedDraft(questionType: 'NUMERIC' | 'SHORT_WORD', answerText: string): BankDraft {
  return { number: 1, questionType, questionText: 'What is 2 + 2?', options: ['', '', '', ''], correctOption: null, answerText };
}

describe('toBankDraft / validateBankDraft / toBankInput', () => {
  it('maps the MCQ answer text to its option letter', () => {
    const draft = toBankDraft(q({ options: ['3', '4', '5', '6'], answer: '4' })) as BankDraft;
    expect(draft.correctOption).toBe('B');
    expect(validateBankDraft(draft)).toBeNull();
    expect(toBankInput(draft)).toEqual({
      questionType: 'MCQ',
      questionText: 'What is 2 + 2?',
      optionA: '3',
      optionB: '4',
      optionC: '5',
      optionD: '6',
      correctOption: 'B',
    });
  });

  it('accepts a letter answer too', () => {
    const draft = toBankDraft(q({ options: ['3', '4', '5', '6'], answer: 'C' })) as BankDraft;
    expect(draft.correctOption).toBe('C');
  });

  it('flags edits that break the rules', () => {
    const draft = toBankDraft(q({ options: ['3', '4', '5', '6'], answer: '4' })) as BankDraft;
    expect(validateBankDraft({ ...draft, questionText: '  ' })).toBe('questionText');
    expect(validateBankDraft({ ...draft, options: ['3', '4', '', '6'] })).toBe('optionsMissing');
    expect(validateBankDraft({ ...draft, options: ['3', '4', '4 ', '6'] })).toBe('optionsDuplicate');
    expect(validateBankDraft({ ...draft, correctOption: null })).toBe('correctOption');

    const numeric = typedDraft('NUMERIC', '8');
    expect(validateBankDraft(numeric)).toBeNull();
    expect(validateBankDraft({ ...numeric, answerText: 'eight' })).toBe('numericAnswer');

    const word = typedDraft('SHORT_WORD', 'Oxygen');
    expect(validateBankDraft({ ...word, answerText: 'a lot of oxygen' })).toBe('shortWordAnswer');
  });

  it('sends only the answer for typed-answer questions, with spaces collapsed', () => {
    const word = typedDraft('SHORT_WORD', ' New   Delhi ');
    expect(toBankInput(word)).toEqual({ questionType: 'SHORT_WORD', questionText: 'What is 2 + 2?', answerText: 'New Delhi' });
  });

  it('returns null for questions that cannot go in the bank', () => {
    expect(toBankDraft(q({ questionType: 'LONG_ANSWER', answer: 'Essay' }))).toBeNull();
  });
});
