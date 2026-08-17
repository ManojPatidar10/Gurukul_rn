import { api } from './client';
import type {
  RegisterParentGoogleRequest,
  RegisterParentRequest,
  RegisterStudentGoogleRequest,
  RegisterStudentInviteGoogleRequest,
  RegisterStudentInviteRequest,
  RegisterStudentRequest,
  RegisterTeacherGoogleRequest,
  RegisterTeacherRequest,
  RegistrationDecisionRequest,
  RegistrationEntityType,
  RegistrationInboxEntry,
  RegistrationSubmittedResponse,
  StudentInviteResponse,
  TeacherInviteResponse,
} from './types';

export function registerStudent(schoolId: string, req: RegisterStudentRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/student', req, schoolId);
}

export function registerStudentWithGoogle(schoolId: string, req: RegisterStudentGoogleRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/student/google', req, schoolId);
}

export function createStudentInvite(schoolId: string, studentId: string) {
  return api.post<StudentInviteResponse>(`/api/v1/students/${studentId}/invite`, {}, schoolId);
}

export function registerStudentWithInvite(schoolId: string, req: RegisterStudentInviteRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/student/invite', req, schoolId);
}

export function registerStudentWithInviteGoogle(schoolId: string, req: RegisterStudentInviteGoogleRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/student/invite/google', req, schoolId);
}

export function createTeacherInvite(schoolId: string, employeeId: string) {
  return api.post<TeacherInviteResponse>(`/api/v1/employees/${employeeId}/invite`, {}, schoolId);
}

export function registerTeacher(schoolId: string, req: RegisterTeacherRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/teacher', req, schoolId);
}

export function registerTeacherWithGoogle(schoolId: string, req: RegisterTeacherGoogleRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/teacher/google', req, schoolId);
}

export function registerParent(schoolId: string, req: RegisterParentRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/parent', req, schoolId);
}

export function registerParentWithGoogle(schoolId: string, req: RegisterParentGoogleRequest) {
  return api.post<RegistrationSubmittedResponse>('/api/v1/register/parent/google', req, schoolId);
}

export function listRegistrations(schoolId: string, entityType: RegistrationEntityType) {
  return api.get<RegistrationInboxEntry[]>(`/api/v1/registrations?entityType=${entityType}`, schoolId);
}

export function approveRegistration(
  schoolId: string,
  entityType: RegistrationEntityType,
  entityId: string,
  req?: RegistrationDecisionRequest
) {
  return api.post<void>(`/api/v1/registrations/${entityType}/${entityId}/approve`, req ?? {}, schoolId);
}

export function rejectRegistration(
  schoolId: string,
  entityType: RegistrationEntityType,
  entityId: string,
  req?: RegistrationDecisionRequest
) {
  return api.post<void>(`/api/v1/registrations/${entityType}/${entityId}/reject`, req ?? {}, schoolId);
}
