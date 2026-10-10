import { api } from './client';
import type { AiQuizGenerationRequest, AiQuizGenerationResponse } from './types';

/**
 * A quiz can take far longer than other AI calls. The server lets the first attempt run up to 75 s
 * (half its 150 s quiz-generation timeout) and still retries once for up to 150 s, so its worst case
 * is about 225 s. Five minutes covers that with room for the network.
 */
export const AI_QUIZ_TIMEOUT_MS = 5 * 60 * 1000;

export function generateQuiz(schoolId: string, teacherId: string, req: AiQuizGenerationRequest) {
  return api.post<AiQuizGenerationResponse>(`/api/v1/teachers/${teacherId}/ai/quiz-generator`, req, schoolId, {
    timeoutMs: AI_QUIZ_TIMEOUT_MS,
  });
}
