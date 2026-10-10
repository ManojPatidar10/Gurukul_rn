import { api } from './client';
import type { Greeting, GreetingRequest, GreetingSettings, GreetingSuggestion, UpcomingBirthday } from './types';

const BASE = '/api/v1/greetings';

export function listGreetings(schoolId: string, view: 'upcoming' | 'past') {
  return api.get<Greeting[]>(`${BASE}?view=${view}`, schoolId);
}

export function getGreetingSuggestions(schoolId: string) {
  return api.get<GreetingSuggestion[]>(`${BASE}/suggestions`, schoolId);
}

export function createGreeting(schoolId: string, req: GreetingRequest) {
  return api.post<Greeting>(BASE, req, schoolId);
}

export function cancelGreeting(schoolId: string, id: string) {
  return api.delete<Greeting>(`${BASE}/${id}`, schoolId);
}

export function sendGreetingNow(schoolId: string, id: string) {
  return api.post<Greeting>(`${BASE}/${id}/send-now`, undefined, schoolId);
}

/** Sends it to the admin alone, to preview. */
export function sendGreetingTest(schoolId: string, id: string) {
  return api.post<null>(`${BASE}/${id}/test`, undefined, schoolId);
}

export function getUpcomingBirthdays(schoolId: string, days = 7) {
  return api.get<UpcomingBirthday[]>(`${BASE}/birthdays?days=${days}`, schoolId);
}

export function getGreetingSettings(schoolId: string) {
  return api.get<GreetingSettings>(`${BASE}/settings`, schoolId);
}

export function updateGreetingSettings(schoolId: string, settings: GreetingSettings) {
  return api.put<GreetingSettings>(`${BASE}/settings`, settings, schoolId);
}
