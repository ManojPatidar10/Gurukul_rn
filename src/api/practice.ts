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

export function getPracticeSession(schoolId: string, id: string) {
  return api.get<PracticeSessionResponse>(`/api/v1/gamification/practice/sessions/${id}`, schoolId);
}

export function submitPracticeAnswer(schoolId: string, id: string, req: SubmitPracticeAnswerRequest) {
  return api.post<SubmitPracticeAnswerResponse>(
    `/api/v1/gamification/practice/sessions/${id}/answers`,
    req,
    schoolId
  );
}
