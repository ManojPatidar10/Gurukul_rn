import type { DayOfWeek, Period, TimetableSlot, TimetableSlotRequest } from '../api/timetable';

const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function slotKey(day: DayOfWeek, periodNumber: number): string {
  return `${day}|${periodNumber}`;
}

/** The subject+teacher chosen for one cell of the editor grid. */
export interface CellAssignment {
  subjectId: string;
  teacherId: string;
}

export function slotsToCells(slots: TimetableSlot[]): Record<string, CellAssignment> {
  const cells: Record<string, CellAssignment> = {};
  for (const s of slots) {
    cells[slotKey(s.dayOfWeek, s.periodNumber)] = { subjectId: s.subjectId, teacherId: s.teacherId };
  }
  return cells;
}

/**
 * The editor's cells as a save payload. Cells on days or periods that are no longer schedulable
 * (Saturday switched off, a period that's now a break) are dropped rather than sent to be rejected.
 */
export function cellsToSlotRequests(
  cells: Record<string, CellAssignment>,
  days: DayOfWeek[],
  periods: Period[]
): TimetableSlotRequest[] {
  const teachable = new Set(periods.filter((p) => !p.breakPeriod).map((p) => p.periodNumber));
  const result: TimetableSlotRequest[] = [];
  for (const day of days) {
    for (const periodNumber of teachable) {
      const cell = cells[slotKey(day, periodNumber)];
      if (cell) result.push({ dayOfWeek: day, periodNumber, subjectId: cell.subjectId, teacherId: cell.teacherId });
    }
  }
  return result;
}

export function slotsForDay(slots: TimetableSlot[], day: DayOfWeek): Map<number, TimetableSlot> {
  const byPeriod = new Map<number, TimetableSlot>();
  for (const s of slots) {
    if (s.dayOfWeek === day) byPeriod.set(s.periodNumber, s);
  }
  return byPeriod;
}

/** Today's tab if today is a school day, otherwise the first school day. */
export function defaultDay(days: DayOfWeek[], now: Date = new Date()): DayOfWeek {
  const today = JS_DAY_TO_DAY_OF_WEEK[now.getDay()];
  return days.includes(today) ? today : (days[0] ?? 'MONDAY');
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Accepts "8:30" or "08:30"; returns the canonical "HH:mm", or null if it isn't a time. */
export function normalizeTime(input: string): string | null {
  const trimmed = input.trim();
  const padded = /^\d:\d\d$/.test(trimmed) ? `0${trimmed}` : trimmed;
  return TIME_PATTERN.test(padded) ? padded : null;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function addMinutes(time: string, minutes: number): string {
  const total = Math.min(toMinutes(time) + minutes, 23 * 60 + 59);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** An editable row of the bell-schedule screen - numbered by position. */
export interface PeriodRow {
  startTime: string;
  endTime: string;
  breakPeriod: boolean;
  label: string;
}

export type PeriodRowError =
  | { code: 'empty' }
  | { code: 'tooMany'; max: number }
  | { code: 'badTime'; periodNumber: number }
  | { code: 'endBeforeStart'; periodNumber: number }
  | { code: 'overlap'; periodNumber: number; previous: number };

export const MAX_PERIODS = 15;

/**
 * Mirrors the server's checks so the admin sees the problem before saving: at least one period,
 * valid times, each period ends after it starts, and each starts no earlier than the previous ends.
 * Returns null when valid.
 */
export function validatePeriodRows(rows: PeriodRow[]): PeriodRowError | null {
  if (rows.length === 0) return { code: 'empty' };
  if (rows.length > MAX_PERIODS) return { code: 'tooMany', max: MAX_PERIODS };
  let previousEnd: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    const periodNumber = i + 1;
    const start = normalizeTime(rows[i].startTime);
    const end = normalizeTime(rows[i].endTime);
    if (!start || !end) return { code: 'badTime', periodNumber };
    if (toMinutes(end) <= toMinutes(start)) return { code: 'endBeforeStart', periodNumber };
    if (previousEnd !== null && toMinutes(start) < previousEnd) {
      return { code: 'overlap', periodNumber, previous: periodNumber - 1 };
    }
    previousEnd = toMinutes(end);
  }
  return null;
}

export function periodRowsToRequest(rows: PeriodRow[]): Period[] {
  return rows.map((r, i) => ({
    periodNumber: i + 1,
    startTime: normalizeTime(r.startTime) ?? r.startTime,
    endTime: normalizeTime(r.endTime) ?? r.endTime,
    breakPeriod: r.breakPeriod,
    label: r.label.trim() ? r.label.trim() : null,
  }));
}

/** A sensible next row: starts when the last one ends, 40 minutes long. */
export function nextPeriodRow(rows: PeriodRow[]): PeriodRow {
  const last = rows[rows.length - 1];
  const start = last ? (normalizeTime(last.endTime) ?? '08:00') : '08:00';
  return { startTime: start, endTime: addMinutes(start, 40), breakPeriod: false, label: '' };
}
