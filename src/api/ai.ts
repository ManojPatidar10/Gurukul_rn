import { api, ApiError, SLOW_TIMEOUT_MS } from './client';
import type { AiFeature, AiNotice, AiVerdict } from './types';

export type { AiFeature, AiNotice, AiNoticeKind, AiVerdict } from './types';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatResponse {
  /**
   * The answer, to be shown and re-sent in later requests exactly as received: no trimming and no
   * markdown or other rewriting. The server uses an earlier exchange only when it recognises it as
   * one it answered for this user in the last 24 hours (it keeps an HMAC of the question and this
   * text, never the text), so a changed copy is left out and the follow-up loses that context.
   */
  reply: string;
  /**
   * Which model answered. The server picks it from config - the app never chooses. null when the
   * reply is a fixed text from the server's school-work guard rather than a model answer.
   */
  model: string | null;
  /**
   * True when `reply` is a fixed text with no model answer in it (a refusal, "couldn't check your
   * message"). The app leaves such an exchange out of the history it sends next time. Absent on
   * older servers.
   */
  refused?: boolean;
  /**
   * True on every fixed server text: each refusal and each supportive (wellbeing) reply, which comes
   * back `refused: false` so it's shown as a normal bubble. False on a model answer. The app leaves
   * such a reply, and the user message right before it, out of the history it sends next time.
   * Absent on older servers (then only `refused` decides).
   */
  excludeFromHistory?: boolean;
  /** Set with `refused` (and on a supportive reply to a paused user); `pausedUntil` set = now paused. */
  notice?: AiNotice | null;
}

/** The caller's own AI state. Never calls a model and never uses quota. Older servers answer 404. */
export interface AiStatus {
  paused: boolean;
  pausedUntil: string | null;
  assistantEnabled: boolean;
  botEnabled: boolean;
  refusalsInWindow: number;
  pauseThreshold: number;
  pauseMinutes: number;
}

/** One of the caller's own refused messages, as recorded for their school (last 30 days). */
export interface AiMyMisuseEvent {
  feature: AiFeature;
  verdict: AiVerdict;
  category: string;
  excerpt: string;
  counted: boolean;
  createdAt: string;
}

/**
 * Academic Helper. The whole visible conversation (less the exchanges `historyForRequest` leaves
 * out) is re-sent each turn. What the server keeps: for an answered exchange no text, only an HMAC
 * of the question and the reply, for 24 hours; for a refused message a short excerpt of it (at most
 * 200 characters, none for a distress message) in the misuse log, which the user sees through
 * `getMyAiMisuse`. It uses an earlier exchange only when it recognises it as one it answered for
 * this user; any other earlier message is left out of what the model sees, without an error. So each
 * message's `content` must be re-sent exactly as it was typed and sent, or as the reply was
 * received. Leaving the screen starts a fresh chat.
 *
 * Note what this deliberately does NOT send: the model, and the system prompt. Both are server-side
 * configuration. The server picks the prompt from the caller's role in the JWT, so a student can't
 * ask to be treated as a teacher and be handed answer keys, and nobody can bill the school for the
 * most expensive model on the platform.
 */
export function askAi(schoolId: string, messages: AiChatMessage[]) {
  return api.post<AiChatResponse>('/api/v1/ai/chat', { messages }, schoolId, { timeoutMs: SLOW_TIMEOUT_MS });
}

/** Whether the caller's AI help is paused or switched off. Rejects with a 404 on older servers. */
export function getAiStatus(schoolId: string) {
  return api.get<AiStatus>('/api/v1/ai/status', schoolId);
}

/**
 * What was recorded about the caller ("What was recorded about me"). Owner and school come from the
 * login on the server, so this can only ever return the caller's own rows. An older server without
 * the endpoint answers 404, which is shown as nothing recorded.
 */
export async function getMyAiMisuse(schoolId: string): Promise<AiMyMisuseEvent[]> {
  try {
    return (await api.get<AiMyMisuseEvent[] | null>('/api/v1/ai/misuse/mine', schoolId)) ?? [];
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return [];
    throw e;
  }
}
