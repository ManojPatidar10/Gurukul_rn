import { api } from './client';
import type { School } from './types';

export interface LogoPresignResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export interface PickedLogo {
  uri: string;
  contentType: string;
  sizeBytes: number;
}

export function presignSchoolLogo(schoolId: string, contentType: string, fileSizeBytes: number) {
  return api.post<LogoPresignResponse>(`/api/v1/schools/${schoolId}/logo/presign`, { contentType, fileSizeBytes }, schoolId);
}

export function setSchoolLogo(schoolId: string, objectKey: string) {
  return api.put<School>(`/api/v1/schools/${schoolId}/logo`, { objectKey }, schoolId);
}

export function removeSchoolLogo(schoolId: string) {
  return api.delete<School>(`/api/v1/schools/${schoolId}/logo`, schoolId);
}

/** Presign -> PUT the bytes straight to S3 -> confirm. Resolves with the updated school. */
export async function uploadSchoolLogo(schoolId: string, logo: PickedLogo): Promise<School> {
  const file = await fetch(logo.uri);
  const blob = await file.blob();
  // The picker doesn't always report a size - the presign needs the exact byte count S3 will receive.
  const presigned = await presignSchoolLogo(schoolId, logo.contentType, blob.size || logo.sizeBytes);
  const put = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': logo.contentType },
    body: blob,
  });
  if (!put.ok) throw new Error('Logo upload failed');
  return setSchoolLogo(schoolId, presigned.objectKey);
}
