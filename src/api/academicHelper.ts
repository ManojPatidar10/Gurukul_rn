import { api } from './client';

export interface AcademicHelperMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AcademicHelperAskRequest {
  mode: 'student' | 'teacher';
  messages: AcademicHelperMessage[];
}

interface AcademicHelperAskResponse {
  reply: string;
}

export function askAcademicHelper(request: AcademicHelperAskRequest) {
  return api.post<AcademicHelperAskResponse>('/api/v1/academic-helper/ask', request);
}
