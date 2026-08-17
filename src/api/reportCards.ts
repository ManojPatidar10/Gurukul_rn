import { api } from './client';
import type { PublishedTerm, ReportCard, ReportCardPublication } from './types';

export function getReportCard(schoolId: string, studentId: string, term: string) {
  return api.get<ReportCard>(`/api/v1/students/${studentId}/report-card?term=${encodeURIComponent(term)}`, schoolId);
}

export function getPublishedTerms(schoolId: string, studentId: string) {
  return api.get<PublishedTerm[]>(`/api/v1/students/${studentId}/report-card/published-terms`, schoolId);
}

export function publishReportCards(schoolId: string, sectionId: string, term: string) {
  return api.post<ReportCardPublication>(`/api/v1/class-sections/${sectionId}/report-cards/publish`, { term }, schoolId);
}

export function getSectionReportCards(schoolId: string, sectionId: string, term: string) {
  return api.get<ReportCard[]>(`/api/v1/class-sections/${sectionId}/report-cards?term=${encodeURIComponent(term)}`, schoolId);
}
