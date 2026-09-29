import { File, Paths } from 'expo-file-system';

import { sectionReportCardsFileName, studentReportCardFileName } from '../utils/reportCardPdfName';
import { BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';

export const PDF_MIME_TYPE = 'application/pdf';

async function download(schoolId: string, path: string, fileName: string): Promise<File> {
  await ensureFreshAccessToken();
  const headers: Record<string, string> = { 'X-School-Id': schoolId };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const destination = new File(Paths.cache, fileName);
  // Rejects on any non-2xx response, so an error body is never saved as a .pdf.
  return File.downloadFileAsync(`${BASE_URL}${path}`, destination, { headers, idempotent: true });
}

/** One student's report card PDF (same access rules as the in-app view; DRAFT watermark if unpublished). */
export function downloadStudentReportCardPdf(schoolId: string, studentId: string, studentName: string, term: string) {
  return download(
    schoolId,
    `/api/v1/students/${studentId}/report-card.pdf?term=${encodeURIComponent(term)}`,
    studentReportCardFileName(studentName, term)
  );
}

/** The whole section's report cards in one PDF, one page per student (admin / class teacher only). */
export function downloadSectionReportCardsPdf(
  schoolId: string,
  section: { id: string; className: string; section: string },
  term: string
) {
  return download(
    schoolId,
    `/api/v1/class-sections/${section.id}/report-cards.pdf?term=${encodeURIComponent(term)}`,
    sectionReportCardsFileName(section.className, section.section, term)
  );
}
