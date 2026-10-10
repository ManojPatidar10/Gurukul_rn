import { api } from './client';
import type {
  BulkCreateQuizQuestionsRequest,
  ChallengeDetailResponse,
  ChallengeSummaryResponse,
  CreateChallengeRequest,
  CreateQuizQuestionRequest,
  QuizQuestionReportResponse,
  QuizQuestionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  UpdateQuizQuestionRequest,
} from './types';

const QUESTIONS = '/api/v1/gamification/arena/questions';

export function createQuizQuestion(schoolId: string, req: CreateQuizQuestionRequest) {
  return api.post<QuizQuestionResponse>(QUESTIONS, req, schoolId);
}

/** Saves reviewed questions (MCQ / NUMERIC / SHORT_WORD) for one subject + grade, all or nothing. */
export function bulkCreateQuizQuestions(schoolId: string, req: BulkCreateQuizQuestionsRequest) {
  return api.post<QuizQuestionResponse[]>(`${QUESTIONS}/bulk`, req, schoolId);
}

/** Newest first. Retired questions are left out unless `includeRetired` is set. */
export function listQuizQuestions(
  schoolId: string,
  subjectId: string,
  className: string,
  createdByEmployeeId?: string,
  includeRetired?: boolean
) {
  const params = {
    subjectId,
    className,
    ...(createdByEmployeeId ? { createdByEmployeeId } : {}),
    ...(includeRetired ? { includeRetired: 'true' } : {}),
  };
  return api.get<QuizQuestionResponse[]>(`${QUESTIONS}?${new URLSearchParams(params).toString()}`, schoolId);
}

/** Any question in the school, retired or not (staff only). */
export function getQuizQuestion(schoolId: string, id: string) {
  return api.get<QuizQuestionResponse>(`${QUESTIONS}/${id}`, schoolId);
}

/** Author or admin only. Applies to future games, and closes the question's open reports. */
export function updateQuizQuestion(schoolId: string, id: string, req: UpdateQuizQuestionRequest) {
  return api.put<QuizQuestionResponse>(`${QUESTIONS}/${id}`, req, schoolId);
}

/** Author or admin only. A soft delete: new games never draw it, past answers stay valid. */
export function retireQuizQuestion(schoolId: string, id: string) {
  return api.delete<QuizQuestionResponse>(`${QUESTIONS}/${id}`, schoolId);
}

export function restoreQuizQuestion(schoolId: string, id: string) {
  return api.post<QuizQuestionResponse>(`${QUESTIONS}/${id}/restore`, {}, schoolId);
}

/** Students only: flags the question's answer as wrong for its author to check. */
export function reportQuizQuestion(schoolId: string, id: string, comment?: string) {
  const trimmed = comment?.trim();
  return api.post<QuizQuestionReportResponse>(
    `${QUESTIONS}/${id}/reports`,
    trimmed ? { comment: trimmed } : {},
    schoolId
  );
}

/** Author or admin only: "Mark as checked" - closes the open reports without changing the question. */
export function dismissQuizQuestionReports(schoolId: string, id: string) {
  return api.post<QuizQuestionResponse>(`${QUESTIONS}/${id}/reports/dismiss`, {}, schoolId);
}

export function createChallenge(schoolId: string, req: CreateChallengeRequest) {
  return api.post<ChallengeSummaryResponse>('/api/v1/gamification/arena/challenges', req, schoolId);
}

export function listMyChallenges(schoolId: string) {
  return api.get<ChallengeSummaryResponse[]>('/api/v1/gamification/arena/challenges', schoolId);
}

export function getChallenge(schoolId: string, id: string) {
  return api.get<ChallengeDetailResponse>(`/api/v1/gamification/arena/challenges/${id}`, schoolId);
}

export function submitAnswer(schoolId: string, id: string, req: SubmitAnswerRequest) {
  return api.post<SubmitAnswerResponse>(`/api/v1/gamification/arena/challenges/${id}/answers`, req, schoolId);
}
