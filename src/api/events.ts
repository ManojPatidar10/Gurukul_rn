import { api } from './client';
import type {
  CreateEventPollOptionsRequest,
  CreateEventRequest,
  EventPollResponse,
  EventPollVoteRequest,
  EventRegistrationEntry,
  EventRegistrationRequest,
  EventRsvpEntry,
  EventRsvpRequest,
  SchoolEvent,
} from './types';

export function createEvent(schoolId: string, req: CreateEventRequest) {
  return api.post<SchoolEvent>('/api/v1/events', req, schoolId);
}

export function listEvents(schoolId: string, className?: string) {
  const query = className ? `?${new URLSearchParams({ className }).toString()}` : '';
  return api.get<SchoolEvent[]>(`/api/v1/events${query}`, schoolId);
}

export function getEvent(schoolId: string, id: string) {
  return api.get<SchoolEvent>(`/api/v1/events/${id}`, schoolId);
}

export function cancelEvent(schoolId: string, id: string) {
  return api.delete<void>(`/api/v1/events/${id}`, schoolId);
}

export function submitEventRsvp(schoolId: string, id: string, req: EventRsvpRequest) {
  return api.post<void>(`/api/v1/events/${id}/rsvp`, req, schoolId);
}

export function listEventRsvps(schoolId: string, id: string) {
  return api.get<EventRsvpEntry[]>(`/api/v1/events/${id}/rsvps`, schoolId);
}

export function submitEventRegistration(schoolId: string, id: string, req: EventRegistrationRequest) {
  return api.post<void>(`/api/v1/events/${id}/registrations`, req, schoolId);
}

export function listEventRegistrations(schoolId: string, id: string) {
  return api.get<EventRegistrationEntry[]>(`/api/v1/events/${id}/registrations`, schoolId);
}

export function addEventPollOptions(schoolId: string, id: string, req: CreateEventPollOptionsRequest) {
  return api.post<void>(`/api/v1/events/${id}/poll/options`, req, schoolId);
}

export function getEventPoll(schoolId: string, id: string) {
  return api.get<EventPollResponse>(`/api/v1/events/${id}/poll`, schoolId);
}

export function voteEventPoll(schoolId: string, id: string, req: EventPollVoteRequest) {
  return api.post<void>(`/api/v1/events/${id}/poll/vote`, req, schoolId);
}
