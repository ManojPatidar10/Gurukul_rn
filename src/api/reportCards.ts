import { api, SLOW_TIMEOUT_MS } from './client';
import type {
  PublishedTerm,
  ReportCard,
  ReportCardPublication,
  ReportCardPublishCheck,
  ReportCardUnpublish,
} from './types';

/**
 * One student's report card. `sectionId` picks the class it's for (an earlier class after promotion
 * or transfer: PublishedTerm.classSectionId). Left out, the server prefers the current class.
 */
export function getReportCard(schoolId: string, studentId: string, term: string, sectionId?: string) {
  const section = sectionId ? `&sectionId=${encodeURIComponent(sectionId)}` : '';
  return api.get<ReportCard>(
    `/api/v1/students/${studentId}/report-card?term=${encodeURIComponent(term)}${section}`,
    schoolId
  );
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

/**
 * Withdraws a published term's report cards (admin only). The reason is saved in the audit log;
 * families aren't notified, and marks entry for the term unlocks.
 */
export function unpublishReportCards(schoolId: string, sectionId: string, term: string, reason: string) {
  return api.post<ReportCardUnpublish>(
    `/api/v1/class-sections/${sectionId}/report-cards/unpublish`,
    { term, reason },
    schoolId
  );
}
