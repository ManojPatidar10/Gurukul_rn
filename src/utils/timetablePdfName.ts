/**
 * A filesystem-safe name for a downloaded timetable PDF, mirroring reportCardPdfName: ASCII only,
 * because the share sheet hands this string to apps that mangle anything else.
 */
export function timetablePdfFileName(className: string, section: string): string {
  const slug = `${className}-${section}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return `timetable-${slug || 'section'}.pdf`;
}
