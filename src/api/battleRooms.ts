import { api } from './client';
import type { BattleRoomState, CreateBattleRoomRequest } from './types';

export function createBattleRoom(schoolId: string, req: CreateBattleRoomRequest) {
  return api.post<BattleRoomState>('/api/v1/gamification/battle-rooms', req, schoolId);
}

export function matchBattleRoom(schoolId: string, req: CreateBattleRoomRequest) {
  return api.post<BattleRoomState>('/api/v1/gamification/battle-rooms/match', req, schoolId);
}

export function joinBattleRoom(schoolId: string, roomId: string) {
  return api.post<BattleRoomState>(`/api/v1/gamification/battle-rooms/${roomId}/join`, {}, schoolId);
}

export function getBattleRoom(schoolId: string, roomId: string) {
  return api.get<BattleRoomState>(`/api/v1/gamification/battle-rooms/${roomId}`, schoolId);
}
