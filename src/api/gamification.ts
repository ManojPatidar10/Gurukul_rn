import { api } from './client';
import type { GameProfileResponse, LeaderboardResponse } from './types';

export function getMyGameProfile(schoolId: string) {
  return api.get<GameProfileResponse>('/api/v1/gamification/me', schoolId);
}

export function getMyLeaderboard(schoolId: string) {
  return api.get<LeaderboardResponse>('/api/v1/gamification/leaderboard', schoolId);
}
