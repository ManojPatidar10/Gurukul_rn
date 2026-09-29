/** ASCII-only, filesystem-safe filename part ("Term 1" -> "term-1"); falls back for e.g. a Hindi-only name. */
export function fileSlug(value: string | null | undefined, fallback = 'student'): string {
  const slug = (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function studentReportCardFileName(studentName: string, term: string) {
  return `report-card-${fileSlug(studentName)}-${fileSlug(term, 'term')}.pdf`;
}

export function sectionReportCardsFileName(className: string, section: string, term: string) {
  return `report-cards-${fileSlug(className, 'class')}-${fileSlug(section, 'section')}-${fileSlug(term, 'term')}.pdf`;
}

/** Content types the backend accepts for a school logo (the two formats the PDF renderer can embed). */
export const LOGO_CONTENT_TYPES = ['image/png', 'image/jpeg'] as const;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/** Null if the picked image is acceptable, otherwise an i18n key describing why not. */
export function validateLogo(contentType: string | null | undefined, sizeBytes: number | null | undefined): string | null {
  if (!contentType || !(LOGO_CONTENT_TYPES as readonly string[]).includes(contentType)) return 'schoolLogo.errors.type';
  if (sizeBytes != null && sizeBytes > MAX_LOGO_BYTES) return 'schoolLogo.errors.size';
  return null;
}
