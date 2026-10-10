import { ApiError } from '../api/client';
import { getErrorMessage } from '../api/errorMessage';
import type {
  AiQuizGenerationRequest,
  AiQuizGenerationResponse,
  GeneratedQuizQuestion,
  TeacherSubjectAssignment,
} from '../api/types';
import i18n from '../i18n';
import { isBankEligible } from './quizBank';

/**
 * Decisions behind the AI quiz generator screen: what a stored draft must look like to be trusted,
 * when it is shown again, which questions can still go to the question bank, and what to say when
 * a generation fails.
 */

/** The last generated draft, kept on the phone (src/api/quizDraftStore.ts) until it is discarded. */
export interface StoredQuizDraft {
  v: 1;
  /** ISO time the draft was generated. */
  savedAt: string;
  teacherId: string;
  classSectionId: string;
  request: AiQuizGenerationRequest;
  response: AiQuizGenerationResponse;
  /** Question numbers already saved to the question bank from this draft. */
  savedToBank: number[];
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isQuestion(value: unknown): value is GeneratedQuizQuestion {
  return (
    isObject(value) &&
    typeof value.number === 'number' &&
    typeof value.questionType === 'string' &&
    typeof value.question === 'string' &&
    Array.isArray(value.options)
  );
}

/** The stored draft, or null for anything that isn't one written by this version of the app. */
export function parseStoredQuizDraft(raw: string | null | undefined): StoredQuizDraft | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isObject(value) || value.v !== 1) return null;
  if (typeof value.savedAt !== 'string' || typeof value.teacherId !== 'string' || typeof value.classSectionId !== 'string') {
    return null;
  }
  if (!isObject(value.request) || !isObject(value.response)) return null;
  const questions = value.response.questions;
  if (!Array.isArray(questions) || !questions.every(isQuestion)) return null;
  const saved = value.savedToBank;
  if (!Array.isArray(saved) || !saved.every((n) => typeof n === 'number')) return null;
  return value as unknown as StoredQuizDraft;
}

/** `existing` plus `added`, each number once. */
export function mergeSavedNumbers(existing: number[], added: number[]): number[] {
  return [...new Set([...existing, ...added])];
}

/**
 * The stored draft with `numbers` recorded as saved to the bank, or null when there is nothing to
 * write. `savedAt` identifies the draft the questions came from: a generation can finish (even
 * after Back) and store a new draft under the same key while the old one is still on screen or
 * being reviewed, and the old draft's question numbers must not be marked on the new one.
 */
export function markSavedOnDraft(draft: StoredQuizDraft | null, savedAt: string, numbers: number[]): StoredQuizDraft | null {
  if (!draft || draft.savedAt !== savedAt) return null;
  return { ...draft, savedToBank: mergeSavedNumbers(draft.savedToBank, numbers) };
}

/**
 * Whether "Discard draft" removes what is stored. Yes when it is the draft on screen
 * (`onScreenSavedAt`), or when the draft on screen couldn't be stored (null) - then anything stored
 * is the older draft the teacher already replaced. No when a newer generation stored one the
 * teacher hasn't seen. Nothing readable stored: removing is harmless.
 */
export function shouldDiscardStoredDraft(
  stored: Pick<StoredQuizDraft, 'savedAt'> | null,
  onScreenSavedAt: string | null
): boolean {
  return stored === null || onScreenSavedAt === null || stored.savedAt === onScreenSavedAt;
}

/**
 * Whether a stored draft belongs on the screen as it is open now. A teacher generating for
 * themselves always gets it back; a principal opened on one section (`openSectionId`) only sees a
 * draft made for that section - one for another section stays stored, unshown.
 */
export function shouldRestoreDraft(draft: Pick<StoredQuizDraft, 'classSectionId'>, openSectionId: string | null): boolean {
  return openSectionId === null || draft.classSectionId === openSectionId;
}

/** The picker key for a teacher's class + subject assignment. */
export function assignmentKeyOf(a: Pick<TeacherSubjectAssignment, 'sectionId' | 'subjectId'>): string {
  return `${a.sectionId}|${a.subjectId}`;
}

/**
 * The class + subject the picker shows: the teacher's own choice, else the restored draft's
 * (`restoredKey`) when it's still one of their assignments, else nothing.
 */
export function effectiveAssignmentKey(chosenKey: string, restoredKey: string, assignments: TeacherSubjectAssignment[]): string {
  if (chosenKey) return chosenKey;
  return restoredKey && assignments.some((a) => assignmentKeyOf(a) === restoredKey) ? restoredKey : '';
}

/** Numbers of the questions that can still go to the question bank (MCQ, not yet saved from this draft). */
export function bankSelectableNumbers(questions: GeneratedQuizQuestion[], savedToBank: number[]): number[] {
  return questions.filter((q) => isBankEligible(q) && !savedToBank.includes(q.number)).map((q) => q.number);
}

/** The questions to send to the bank review: ticked, eligible, and not already saved. */
export function questionsForBank(
  questions: GeneratedQuizQuestion[],
  selected: number[],
  savedToBank: number[]
): GeneratedQuizQuestion[] {
  return questions.filter((q) => selected.includes(q.number) && isBankEligible(q) && !savedToBank.includes(q.number));
}

function retryAfterSeconds(data: unknown): number | null {
  if (!isObject(data)) return null;
  const seconds = data.retryAfterSeconds;
  return typeof seconds === 'number' && Number.isFinite(seconds) ? seconds : null;
}

/**
 * What to tell the teacher when a generation fails. A used-up hourly quota (429) says how long to
 * wait; the generator's 503 AI_UNAVAILABLE messages are written to be shown ("try fewer questions",
 * "took too long to write"), so they are passed through instead of the generic "server unavailable".
 */
export function quizGenErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      const seconds = retryAfterSeconds(error.data);
      if (seconds !== null) {
        return i18n.t('teacherTools.generator.errors.rateLimited', { minutes: Math.max(1, Math.ceil(seconds / 60)) });
      }
      if (error.message && !/^Request failed with status \d+$/.test(error.message)) return error.message;
    }
    if (error.status === 503 && error.errorCode === 'AI_UNAVAILABLE' && error.message?.trim()) return error.message;
  }
  return getErrorMessage(error);
}
