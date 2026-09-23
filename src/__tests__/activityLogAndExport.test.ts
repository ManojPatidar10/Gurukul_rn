import { formatAuditValue, humanize } from '../utils/activityLogFormat';
import { MAX_EXPORT_RANGE_DAYS, validateExportRange } from '../utils/attendanceExportRange';

describe('humanize', () => {
  it('splits PascalCase entity names', () => {
    expect(humanize('AttendanceRecord')).toBe('Attendance Record');
  });

  it('splits and capitalizes camelCase field names', () => {
    expect(humanize('parentContact')).toBe('Parent Contact');
  });

  it('leaves single words alone apart from capitalizing', () => {
    expect(humanize('status')).toBe('Status');
  });
});

describe('formatAuditValue', () => {
  it('shows an em dash for empty values', () => {
    expect(formatAuditValue(null)).toBe('—');
    expect(formatAuditValue(undefined)).toBe('—');
    expect(formatAuditValue('')).toBe('—');
  });

  it('shows booleans as Yes/No', () => {
    expect(formatAuditValue(true)).toBe('Yes');
    expect(formatAuditValue(false)).toBe('No');
  });

  it('stringifies everything else, including redacted markers', () => {
    expect(formatAuditValue(42)).toBe('42');
    expect(formatAuditValue('[redacted]')).toBe('[redacted]');
  });
});

describe('validateExportRange', () => {
  it('accepts a single day', () => {
    expect(validateExportRange('2026-09-23', '2026-09-23')).toBeNull();
  });

  it('rejects a reversed range', () => {
    expect(validateExportRange('2026-09-10', '2026-09-01')).toBe('attendanceExport.errors.order');
  });

  it('accepts the longest allowed range and rejects one day more', () => {
    expect(MAX_EXPORT_RANGE_DAYS).toBe(366);
    // 2025-01-01 -> 2026-01-01 is 365 days apart: allowed. 2025-01-01 -> 2026-01-02 is 366: rejected.
    expect(validateExportRange('2025-01-01', '2026-01-01')).toBeNull();
    expect(validateExportRange('2025-01-01', '2026-01-02')).toBe('attendanceExport.errors.tooLong');
  });
});
