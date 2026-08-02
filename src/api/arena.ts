import { api } from './client';
import type {
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

export function listQuizQuestions(schoolId: string, subjectId: string) {
  return api.get<QuizQuestionResponse[]>(
    `/api/v1/gamification/arena/questions?subjectId=${subjectId}`,
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
