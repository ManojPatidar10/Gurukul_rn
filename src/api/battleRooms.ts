import { api } from './client';
import type { BattleRoomState, BattleRoomSummary, CreateBattleRoomRequest } from './types';

export function createBattleRoom(schoolId: string, req: CreateBattleRoomRequest) {
  return api.post<BattleRoomState>('/api/v1/gamification/battle-rooms', req, schoolId);
}

export function matchBattleRoom(schoolId: string, req: CreateBattleRoomRequest) {
  return api.post<BattleRoomState>('/api/v1/gamification/battle-rooms/match', req, schoolId);
}

export function joinBattleRoom(schoolId: string, roomId: string) {
  return api.post<BattleRoomState>(`/api/v1/gamification/battle-rooms/${roomId}/join`, {}, schoolId);
}

export function joinBattleRoomByCode(schoolId: string, code: string) {
  return api.post<BattleRoomState>('/api/v1/gamification/battle-rooms/join-by-code', { code }, schoolId);
}

export function getBattleRoom(schoolId: string, roomId: string) {
  return api.get<BattleRoomState>(`/api/v1/gamification/battle-rooms/${roomId}`, schoolId);
}

export function startBattleRoom(schoolId: string, roomId: string) {
  return api.post<BattleRoomState>(`/api/v1/gamification/battle-rooms/${roomId}/start`, {}, schoolId);
}

export function listBattleRooms(schoolId: string, subjectId?: string) {
  const query = subjectId ? `?subjectId=${subjectId}` : '';
  return api.get<BattleRoomSummary[]>(`/api/v1/gamification/battle-rooms${query}`, schoolId);
}
