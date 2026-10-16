import { api } from './client';
import type {
  CreatePracticeSessionRequest,
  PracticeSessionResponse,
  SubmitPracticeAnswerRequest,
  SubmitPracticeAnswerResponse,
} from './types';

export function createPracticeSession(schoolId: string, req: CreatePracticeSessionRequest) {
  return api.post<PracticeSessionResponse>('/api/v1/gamification/practice/sessions', req, schoolId);
}

export function getPracticeSession(schoolId: string, id: string, language?: string) {
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  return api.get<PracticeSessionResponse>(`/api/v1/gamification/practice/sessions/${id}${query}`, schoolId);
}

/**
 * Write this question's per-option explanations and get the refreshed session back. The four
 * belong to the question, so this costs a model call only the first time anyone asks for it;
 * afterwards every review reads them straight from the bank.
 */
export function explainPracticeQuestion(schoolId: string, id: string, questionId: string, language?: string) {
  const query = language ? `?language=${encodeURIComponent(language)}` : '';
  return api.post<PracticeSessionResponse>(
    `/api/v1/gamification/practice/sessions/${id}/questions/${questionId}/explain${query}`,
    {},
    schoolId
  );
}

export function submitPracticeAnswer(schoolId: string, id: string, req: SubmitPracticeAnswerRequest) {
  return api.post<SubmitPracticeAnswerResponse>(
    `/api/v1/gamification/practice/sessions/${id}/answers`,
    req,
    schoolId
  );
}
