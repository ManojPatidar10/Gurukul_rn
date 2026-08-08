import { api } from './client';
import type { Assessment, AssessmentRequest, AssessmentResultResponse, AssessmentType, BulkAssessmentResultRequest } from './types';

export function listSectionAssessments(schoolId: string, sectionId: string, type?: AssessmentType) {
  const query = type ? `?type=${type}` : '';
  return api.get<Assessment[]>(`/api/v1/class-sections/${sectionId}/assessments${query}`, schoolId);
}

export function createAssessment(schoolId: string, sectionId: string, req: AssessmentRequest) {
  return api.post<Assessment>(`/api/v1/class-sections/${sectionId}/assessments`, req, schoolId);
}

export function getAssessment(schoolId: string, id: string) {
  return api.get<Assessment>(`/api/v1/assessments/${id}`, schoolId);
}

export function updateAssessment(schoolId: string, id: string, req: AssessmentRequest) {
  return api.put<Assessment>(`/api/v1/assessments/${id}`, req, schoolId);
}

export function deleteAssessment(schoolId: string, id: string) {
  return api.delete<void>(`/api/v1/assessments/${id}`, schoolId);
}

export function submitAssessmentResults(schoolId: string, assessmentId: string, req: BulkAssessmentResultRequest) {
  return api.post<AssessmentResultResponse[]>(`/api/v1/assessments/${assessmentId}/results`, req, schoolId);
}
