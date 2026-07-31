import { api } from './client';
import type {
  CallLogResponse,
  CallSessionResponse,
  MyInviteResponse,
  RsvpRequest,
  ScheduleCallRequest,
  ScheduledCallResponse,
  StartImmediateCallRequest,
} from './types';

export function scheduleCall(schoolId: string, req: ScheduleCallRequest) {
  return api.post<ScheduledCallResponse>('/api/v1/calls/scheduled', req, schoolId);
}

export function listHostedCalls(schoolId: string) {
  return api.get<ScheduledCallResponse[]>('/api/v1/calls/scheduled/hosted', schoolId);
}

export function listMyInvites(schoolId: string) {
  return api.get<MyInviteResponse[]>('/api/v1/calls/scheduled/invited', schoolId);
}

export function getScheduledCall(schoolId: string, id: string) {
  return api.get<ScheduledCallResponse>(`/api/v1/calls/scheduled/${id}`, schoolId);
}

export function respondToInvite(schoolId: string, id: string, req: RsvpRequest) {
  return api.post<ScheduledCallResponse>(`/api/v1/calls/scheduled/${id}/rsvp`, req, schoolId);
}

export function cancelScheduledCall(schoolId: string, id: string) {
  return api.post<ScheduledCallResponse>(`/api/v1/calls/scheduled/${id}/cancel`, {}, schoolId);
}

export function startScheduledCall(schoolId: string, id: string) {
  return api.post<ScheduledCallResponse>(`/api/v1/calls/scheduled/${id}/start`, {}, schoolId);
}

export function endScheduledCall(schoolId: string, id: string) {
  return api.post<ScheduledCallResponse>(`/api/v1/calls/scheduled/${id}/end`, {}, schoolId);
}

export function startImmediateCall(schoolId: string, req: StartImmediateCallRequest) {
  return api.post<CallSessionResponse>('/api/v1/calls/immediate', req, schoolId);
}

export function acceptImmediateCall(schoolId: string, callLogId: string) {
  return api.post<CallSessionResponse>(`/api/v1/calls/${callLogId}/accept`, {}, schoolId);
}

export function declineImmediateCall(schoolId: string, callLogId: string) {
  return api.post<CallSessionResponse>(`/api/v1/calls/${callLogId}/decline`, {}, schoolId);
}

export function cancelImmediateCall(schoolId: string, callLogId: string) {
  return api.post<CallSessionResponse>(`/api/v1/calls/${callLogId}/cancel`, {}, schoolId);
}

export function endImmediateCall(schoolId: string, callLogId: string) {
  return api.post<CallSessionResponse>(`/api/v1/calls/${callLogId}/end`, {}, schoolId);
}

export function listMyCallHistory(schoolId: string) {
  return api.get<CallLogResponse[]>('/api/v1/calls/history', schoolId);
}

export function listSchoolCallHistory(schoolId: string) {
  return api.get<CallLogResponse[]>('/api/v1/calls/history/school', schoolId);
}
