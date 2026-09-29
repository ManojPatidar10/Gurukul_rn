import { api } from './client';
import type {
  BulkCreateQuizQuestionsRequest,
  ChallengeDetailResponse,
  ChallengeSummaryResponse,
  CreateChallengeRequest,
  CreateQuizQuestionRequest,
  QuizQuestionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from './types';

export function createQuizQuestion(schoolId: string, req: CreateQuizQuestionRequest) {
  return api.post<QuizQuestionResponse>('/api/v1/gamification/arena/questions', req, schoolId);
}

/** Saves reviewed questions (MCQ / NUMERIC / SHORT_WORD) for one subject + grade, all or nothing. */
export function bulkCreateQuizQuestions(schoolId: string, req: BulkCreateQuizQuestionsRequest) {
  return api.post<QuizQuestionResponse[]>('/api/v1/gamification/arena/questions/bulk', req, schoolId);
}

export function listQuizQuestions(
  schoolId: string,
  subjectId: string,
  className: string,
  createdByEmployeeId?: string
) {
  const params = { subjectId, className, ...(createdByEmployeeId ? { createdByEmployeeId } : {}) };
  return api.get<QuizQuestionResponse[]>(
    `/api/v1/gamification/arena/questions?${new URLSearchParams(params).toString()}`,
    schoolId
  );
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
