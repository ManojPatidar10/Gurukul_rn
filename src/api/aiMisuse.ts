import { api } from './client';
import type { AiFeature, AiVerdict, OwnerType } from './types';

/** One refused AI message in the school, for the principal's AI misuse log. */
export interface AiMisuseEvent {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  /** null when the person no longer exists. */
  name: string | null;
  role: string;
  /** Students only. */
  classLabel: string | null;
  feature: AiFeature;
  verdict: AiVerdict;
  category: string;
  excerpt: string;
  /** Whether it counts toward a pause (asking for another student's records doesn't). */
  counted: boolean;
  createdAt: string;
}

export interface AiPause {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  name: string | null;
  role: string;
  classLabel: string | null;
  pausedAt: string;
  pausedUntil: string;
  refusalCount: number;
  active: boolean;
  liftedAt: string | null;
  liftedByName: string | null;
}

export type AiDataAccessOutcome = 'OK' | 'NOT_IN_SCOPE' | 'CLARIFY' | 'ERROR';

/** One data lookup the helpdesk bot made for someone: who asked for what, never the data itself. */
export interface AiDataAccessEntry {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  name: string | null;
  role: string;
  feature: AiFeature;
  tool: string;
  /** What was asked for; the keys depend on the tool ({} when the server couldn't read it back). */
  scope: Record<string, unknown>;
  rowCount: number;
  outcome: AiDataAccessOutcome;
  createdAt: string;
}

/** One person to filter by. The server wants both halves or neither. */
export interface AiOwnerFilter {
  ownerType?: OwnerType;
  ownerId?: string;
}

export interface AiMisuseQuery extends AiOwnerFilter {
  /** India dates, YYYY-MM-DD. The server clamps `from` to its retention. */
  from: string;
  to: string;
  feature?: AiFeature;
  verdict?: AiVerdict;
  page?: number;
  size?: number;
}

export interface AiDataAccessQuery extends AiOwnerFilter {
  from: string;
  to: string;
  tool?: string;
  page?: number;
  size?: number;
}

const PAGE_SIZE = 50;

/** Adds the owner filter only when both its halves are there (one alone is a 400 on the server). */
function setOwner(query: URLSearchParams, { ownerType, ownerId }: AiOwnerFilter) {
  if (!ownerType || !ownerId) return;
  query.set('ownerType', ownerType);
  query.set('ownerId', ownerId);
}

/** Refused messages, newest first, paginated (ADMIN). */
export function listAiMisuse(schoolId: string, params: AiMisuseQuery) {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  setOwner(query, params);
  if (params.feature) query.set('feature', params.feature);
  if (params.verdict) query.set('verdict', params.verdict);
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? PAGE_SIZE));
  return api.getPaginated<AiMisuseEvent>(`/api/v1/ai/misuse?${query.toString()}`, schoolId);
}

/**
 * Pauses, newest first (ADMIN), at most 200. Who is paused now by default; `active: false` lists
 * ended and lifted ones, optionally between `from` and `to`.
 */
export function listAiPauses(schoolId: string, params: { active?: boolean; from?: string; to?: string } = {}) {
  const active = params.active ?? true;
  const query = new URLSearchParams({ active: String(active) });
  if (!active && params.from) query.set('from', params.from);
  if (!active && params.to) query.set('to', params.to);
  return api.get<AiPause[]>(`/api/v1/ai/pauses?${query.toString()}`, schoolId);
}

/**
 * Lets the user use AI help again straight away (ADMIN). No body. A pause that already ended or was
 * already lifted is a 409 AI_PAUSE_NOT_ACTIVE, whose `data` is the pause as it is now.
 */
export function liftAiPause(schoolId: string, pauseId: string) {
  return api.post<AiPause>(`/api/v1/ai/pauses/${encodeURIComponent(pauseId)}/lift`, undefined, schoolId);
}

/** The helpdesk bot's data lookups, newest first, paginated (ADMIN). */
export function listAiDataAccess(schoolId: string, params: AiDataAccessQuery) {
  const query = new URLSearchParams({ from: params.from, to: params.to });
  setOwner(query, params);
  if (params.tool) query.set('tool', params.tool);
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? PAGE_SIZE));
  return api.getPaginated<AiDataAccessEntry>(`/api/v1/ai/data-access?${query.toString()}`, schoolId);
}
