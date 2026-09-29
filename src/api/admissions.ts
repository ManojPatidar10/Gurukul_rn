import { api } from './client';
import type {
  Admission,
  AdmissionRequest,
  AdmissionStage,
  ConvertAdmissionRequest,
  ConvertAdmissionResponse,
  PresignAdmissionDocumentRequest,
  PresignAdmissionDocumentResponse,
  RegisterAdmissionDocumentRequest,
} from './types';

const BASE = '/api/v1/admissions';

export function listAdmissions(schoolId: string, stage?: AdmissionStage) {
  const query = stage ? `?stage=${stage}` : '';
  return api.get<Admission[]>(`${BASE}${query}`, schoolId);
}

export function getAdmission(schoolId: string, id: string) {
  return api.get<Admission>(`${BASE}/${id}`, schoolId);
}

export function createAdmission(schoolId: string, req: AdmissionRequest) {
  return api.post<Admission>(BASE, req, schoolId);
}

export function updateAdmission(schoolId: string, id: string, req: AdmissionRequest) {
  return api.put<Admission>(`${BASE}/${id}`, req, schoolId);
}

export function deleteAdmission(schoolId: string, id: string) {
  return api.delete<void>(`${BASE}/${id}`, schoolId);
}

export function changeAdmissionStage(schoolId: string, id: string, stage: AdmissionStage) {
  return api.patch<Admission>(`${BASE}/${id}/stage`, { stage }, schoolId);
}

export function presignAdmissionDocument(schoolId: string, id: string, req: PresignAdmissionDocumentRequest) {
  return api.post<PresignAdmissionDocumentResponse>(`${BASE}/${id}/documents/presign`, req, schoolId);
}

export function registerAdmissionDocument(schoolId: string, id: string, req: RegisterAdmissionDocumentRequest) {
  return api.post<Admission>(`${BASE}/${id}/documents`, req, schoolId);
}

export function deleteAdmissionDocument(schoolId: string, id: string, documentId: string) {
  return api.delete<Admission>(`${BASE}/${id}/documents/${documentId}`, schoolId);
}

/** Idempotent: an already-enrolled application comes back with alreadyEnrolled=true. 409 = possible duplicate. */
export function convertAdmission(schoolId: string, id: string, req: ConvertAdmissionRequest) {
  return api.post<ConvertAdmissionResponse>(`${BASE}/${id}/convert`, req, schoolId);
}
