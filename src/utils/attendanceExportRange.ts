/** Server-side cap on the attendance export's inclusive date range. */
export const MAX_EXPORT_RANGE_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

function parseIsoDateUtc(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Returns an i18n error key for an invalid YYYY-MM-DD range, or null when it's valid. */
export function validateExportRange(from: string, to: string): string | null {
  const fromMs = parseIsoDateUtc(from);
  const toMs = parseIsoDateUtc(to);
  if (toMs < fromMs) return 'attendanceExport.errors.order';
  if ((toMs - fromMs) / DAY_MS >= MAX_EXPORT_RANGE_DAYS) return 'attendanceExport.errors.tooLong';
  return null;
}
