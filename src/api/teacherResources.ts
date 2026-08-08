import { ApiError, BASE_URL, api } from './client';
import type { ApiResponse, TeacherResourceRequest, TeacherResourceResponse, TeacherResourceUploadFields } from './types';

export function listTeacherResourcesByClassSection(schoolId: string, classSectionId: string) {
  return api.get<TeacherResourceResponse[]>(`/api/v1/teachers/class-sections/${classSectionId}/resources`, schoolId);
}

export function createTeacherResource(schoolId: string, teacherId: string, req: TeacherResourceRequest) {
  return api.post<TeacherResourceResponse>(`/api/v1/teachers/${teacherId}/resources`, req, schoolId);
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/**
 * Multipart upload - can't go through api.post, since client.ts's request() always
 * JSON-stringifies the body and force-sets Content-Type: application/json. Multipart needs the
 * runtime to set its own boundary, so this does a raw fetch mirroring client.ts's conventions.
 */
export async function uploadTeacherResource(
  schoolId: string,
  teacherId: string,
  fields: TeacherResourceUploadFields,
  file: PickedFile
): Promise<TeacherResourceResponse> {
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || 'application/octet-stream',
  } as unknown as Blob);
  formData.append('classSectionId', fields.classSectionId);
  formData.append('subjectName', fields.subjectName);
  formData.append('resourceType', fields.resourceType);
  formData.append('title', fields.title);
  formData.append('description', fields.description);
  formData.append('availableOffline', String(fields.availableOffline));

  const response = await fetch(`${BASE_URL}/api/v1/teachers/${teacherId}/resources/upload`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'X-School-Id': schoolId },
    body: formData,
  });

  const json: ApiResponse<TeacherResourceResponse> = await response.json();
  if (!response.ok || !json.success) {
    throw new ApiError(json.message ?? `Request failed with status ${response.status}`);
  }
  return json.data as TeacherResourceResponse;
}
