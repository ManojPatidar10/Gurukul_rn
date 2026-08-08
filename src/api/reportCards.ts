import { api } from './client';
import type { ReportCard, ReportCardPublication } from './types';

export function getReportCard(schoolId: string, studentId: string, term: string) {
  return api.get<ReportCard>(`/api/v1/students/${studentId}/report-card?term=${encodeURIComponent(term)}`, schoolId);
}

export function publishReportCards(schoolId: string, sectionId: string, term: string) {
  return api.post<ReportCardPublication>(`/api/v1/class-sections/${sectionId}/report-cards/publish`, { term }, schoolId);
}
