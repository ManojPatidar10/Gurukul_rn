import { api } from './client';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  reply: string;
  /** Which model answered. The server picks it from config - the app never chooses. */
  model: string;
}

/**
 * Academic Helper. The whole visible conversation is re-sent each turn; nothing is stored
 * server-side, so reinstalling the app starts a fresh chat.
 *
 * Note what this deliberately does NOT send: the model, and the system prompt. Both are server-side
 * configuration. The server picks the prompt from the caller's role in the JWT, so a student can't
 * ask to be treated as a teacher and be handed answer keys, and nobody can bill the school for the
 * most expensive model on the platform.
 */
export function askAi(schoolId: string, messages: AiChatMessage[]) {
  return api.post<AiChatResponse>('/api/v1/ai/chat', { messages }, schoolId);
}
