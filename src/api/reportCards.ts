import { api, SLOW_TIMEOUT_MS } from './client';
import type { PublishedTerm, ReportCard, ReportCardPublication, ReportCardPublishCheck } from './types';

export function getReportCard(schoolId: string, studentId: string, term: string) {
  return api.get<ReportCard>(`/api/v1/students/${studentId}/report-card?term=${encodeURIComponent(term)}`, schoolId);
}

export function getPublishedTerms(schoolId: string, studentId: string) {
  return api.get<PublishedTerm[]>(`/api/v1/students/${studentId}/report-card/published-terms`, schoolId);
}

export function publishReportCards(schoolId: string, sectionId: string, term: string) {
  return api.post<ReportCardPublication>(`/api/v1/class-sections/${sectionId}/report-cards/publish`, { term }, schoolId, {
    timeoutMs: SLOW_TIMEOUT_MS,
  });
}

/** What publishing this term would do (counts and warnings), for the confirmation before publishing. */
export function getPublishCheck(schoolId: string, sectionId: string, term: string) {
  return api.get<ReportCardPublishCheck>(
    `/api/v1/class-sections/${sectionId}/report-cards/publish-check?term=${encodeURIComponent(term)}`,
    schoolId
  );
}

export function getSectionReportCards(schoolId: string, sectionId: string, term: string) {
  return api.get<ReportCard[]>(`/api/v1/class-sections/${sectionId}/report-cards?term=${encodeURIComponent(term)}`, schoolId);
}
