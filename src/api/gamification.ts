import { api } from './client';
import type { GameProfileResponse } from './types';

export function getMyGameProfile(schoolId: string) {
  return api.get<GameProfileResponse>('/api/v1/gamification/me', schoolId);
}
