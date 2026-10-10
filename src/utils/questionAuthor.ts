import type { TFunction } from 'i18next';

import type {
  CreateQuizQuestionRequest,
  QuizQuestionResponse,
  TeacherSubjectAssignment,
  UpdateQuizQuestionRequest,
} from '../api/types';
import { toBankInput, type BankDraft } from './quizBank';

/**
 * Pure helpers for the question-bank screens (QuestionAuthorScreen, MyQuestionsScreen). The form is
 * a BankDraft so it is checked by validateBankDraft (utils/quizBank) - the same rules as the AI
 * review step and the server.
 */

export interface TeachableSubject {
  id: string;
  name: string;
}

const byText = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** The subjects a teacher teaches in at least one section, each once, sorted by name. */
export function teachableSubjects(assignments: TeacherSubjectAssignment[]): TeachableSubject[] {
  const byId = new Map<string, TeachableSubject>();
  for (const a of assignments) {
    if (!byId.has(a.subjectId)) byId.set(a.subjectId, { id: a.subjectId, name: a.subjectName });
  }
  return [...byId.values()].sort((a, b) => byText(a.name, b.name));
}

/**
 * The grades where a teacher teaches this subject, each once and sorted ("Grade 9" before
 * "Grade 10"). Trimmed, because the server compares the trimmed grade when it checks who may add.
 */
export function teachableClassNames(assignments: TeacherSubjectAssignment[], subjectId: string | null): string[] {
  if (!subjectId) return [];
  const names = new Set<string>();
  for (const a of assignments) {
    const name = a.className?.trim();
    if (a.subjectId === subjectId && name) names.add(name);
  }
  return [...names].sort(byText);
}

/** A blank form for a new multiple-choice question. Nothing is pre-selected as the answer. */
export function emptyQuestionDraft(): BankDraft {
  return {
    number: 1,
    questionType: 'MCQ',
    questionText: '',
    options: ['', '', '', ''],
    correctOption: null,
    answerText: '',
    explanation: '',
  };
}

/** The edit form for a saved question. Older servers don't send the type, and those are all MCQ. */
export function draftFromQuestion(q: QuizQuestionResponse): BankDraft {
  return {
    number: 1,
    questionType: q.questionType ?? 'MCQ',
    questionText: q.questionText,
    options: [q.optionA ?? '', q.optionB ?? '', q.optionC ?? '', q.optionD ?? ''],
    correctOption: q.correctOption,
    answerText: q.answerText ?? '',
    explanation: q.explanation ?? '',
  };
}

/** Why Save is still disabled, shown under the button; null once it can be pressed. */
export function questionSaveHint(d: BankDraft, subjectAndClassChosen: boolean, t: TFunction): string | null {
  if (!subjectAndClassChosen) return t('questionBank.author.saveHint.pickPlacement');
  if (d.questionType === 'MCQ' && !d.correctOption) return t('questionBank.author.saveHint.tapCorrect');
  return null;
}

/** A single new MCQ (the only type typed in by hand). Call only once validateBankDraft passes. */
export function toCreateQuestionRequest(subjectId: string, className: string, d: BankDraft): CreateQuizQuestionRequest {
  const input = toBankInput({ ...d, questionType: 'MCQ' });
  if (!input.correctOption) throw new Error('Choose the correct option first.');
  return {
    subjectId,
    className: className.trim(),
    questionText: input.questionText,
    optionA: input.optionA ?? '',
    optionB: input.optionB ?? '',
    optionC: input.optionC ?? '',
    optionD: input.optionD ?? '',
    correctOption: input.correctOption,
    ...(input.explanation ? { explanation: input.explanation } : {}),
  };
}

/**
 * The edit request: a full replacement of the fields that fit the question's type. A blank
 * explanation is sent as null, which clears it.
 */
export function toUpdateQuestionRequest(d: BankDraft): UpdateQuizQuestionRequest {
  const input = toBankInput(d);
  const answer =
    d.questionType === 'MCQ'
      ? {
          optionA: input.optionA,
          optionB: input.optionB,
          optionC: input.optionC,
          optionD: input.optionD,
          correctOption: input.correctOption,
        }
      : { answerText: input.answerText };
  return { questionText: input.questionText, ...answer, explanation: input.explanation ?? null };
}

/** The warning on a question card when students have flagged its answer; null when nobody has. */
export function reportWarning(openReportCount: number | null | undefined, t: TFunction): string | null {
  if (!openReportCount || openReportCount <= 0) return null;
  return t('questionBank.myQuestions.reportWarning', { count: openReportCount });
}
