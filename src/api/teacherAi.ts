import { api, SLOW_TIMEOUT_MS } from './client';
import type { AiQuizGenerationRequest, AiQuizGenerationResponse } from './types';

export function generateQuiz(schoolId: string, teacherId: string, req: AiQuizGenerationRequest) {
  return api.post<AiQuizGenerationResponse>(`/api/v1/teachers/${teacherId}/ai/quiz-generator`, req, schoolId, {
    timeoutMs: SLOW_TIMEOUT_MS,
  });
}
