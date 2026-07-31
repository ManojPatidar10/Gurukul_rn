import { api } from './client';
import type { AwardSpotRecognitionRequest, CreateHouseRequest, HouseResponse, HouseWarsResponse } from './types';

export function listHouses(schoolId: string) {
  return api.get<HouseResponse[]>('/api/v1/houses', schoolId);
}

export function createHouse(schoolId: string, req: CreateHouseRequest) {
  return api.post<HouseResponse>('/api/v1/houses', req, schoolId);
}

export function getHouseWars(schoolId: string) {
  return api.get<HouseWarsResponse>('/api/v1/houses/wars', schoolId);
}

export function awardSpotRecognition(schoolId: string, req: AwardSpotRecognitionRequest) {
  return api.post<void>('/api/v1/houses/spot-recognition', req, schoolId);
}
