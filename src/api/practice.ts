import { api } from './client';
import type {
  CreatePracticeSessionRequest,
  PracticeAnalysis,
  PracticeSessionResponse,
  PracticeStudyPlan,
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

/**
 * What the finished session says about the student: per-chapter scores, the chapters going well,
 * the ones to go back to, and every question they got wrong with the right answer.
 */
export function getPracticeAnalysis(schoolId: string, sessionId: string) {
  return api.get<PracticeAnalysis>(
    `/api/v1/gamification/practice/sessions/${sessionId}/analysis`,
    schoolId
  );
}

/**
 * What to do next. `className` scopes the syllabus the roadmap is ordered against; without it the
 * plan falls back to the weak chapters alone, which is still useful but has no groundwork in it.
 */
export function getPracticeStudyPlan(schoolId: string, sessionId: string, className?: string) {
  const query = className ? `?className=${encodeURIComponent(className)}` : '';
  return api.get<PracticeStudyPlan>(
    `/api/v1/gamification/practice/sessions/${sessionId}/study-plan${query}`,
    schoolId
  );
}
