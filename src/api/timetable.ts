import { File, Paths } from 'expo-file-system';

import { ApiError, api, BASE_URL, ensureFreshAccessToken, getAuthToken } from './client';
import { timetablePdfFileName } from '../utils/timetablePdfName';

/** Mirrors reportCardPdf.download: rejects on any non-2xx, so an error body is never saved as a .pdf. */
async function downloadPdf(schoolId: string, path: string, fileName: string): Promise<File> {
  await ensureFreshAccessToken();
  const headers: Record<string, string> = { 'X-School-Id': schoolId };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const destination = new File(Paths.cache, fileName);
  return File.downloadFileAsync(`${BASE_URL}${path}`, destination, { headers, idempotent: true });
}

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

/** One period of the school's single bell schedule. Times are "HH:mm". */
export interface Period {
  periodNumber: number;
  startTime: string;
  endTime: string;
  breakPeriod: boolean;
  label: string | null;
}

export interface PeriodSchedule {
  saturdayEnabled: boolean;
  /** School days in order: MONDAY..FRIDAY, plus SATURDAY when enabled. */
  days: DayOfWeek[];
  periods: Period[];
}

export interface PeriodScheduleRequest {
  saturdayEnabled: boolean;
  periods: Period[];
}

/**
 * A one-day change to a period: another teacher takes it (SUBSTITUTE), it doesn't happen
 * (CANCELLED), or a period is added in a free slot (EXTRA).
 */
export type OverrideKind = 'SUBSTITUTE' | 'CANCELLED' | 'EXTRA';

export interface TimetableSlot {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  /** Who actually teaches it: the substitute on a SUBSTITUTE or EXTRA, the original teacher on a CANCELLED. */
  teacherId: string;
  teacherName: string;
  sectionId: string;
  className: string;
  section: string;
  // The fields below are newer: older servers leave them out.
  /** The room the period is in, after any change for the date. */
  roomId?: string | null;
  roomName?: string | null;
  /** Set only in a date view. */
  date?: string | null;
  overrideId?: string | null;
  /** Null for a regular period. */
  overrideKind?: OverrideKind | null;
  /** The teacher the period was taken from (SUBSTITUTE and CANCELLED). */
  originalTeacherId?: string | null;
  originalTeacherName?: string | null;
}

export interface TimetableSlotRequest {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  subjectId: string;
  teacherId: string;
  /** Left out keeps the room saved on that day+period; null clears it. */
  roomId?: string | null;
}

/** Either one section's week (scope SECTION) or one teacher's week across sections (scope TEACHER). */
export interface Timetable {
  scope: 'SECTION' | 'TEACHER';
  sectionId: string | null;
  sectionLabel: string | null;
  teacherId: string | null;
  teacherName: string | null;
  academicYear: string | null;
  saturdayEnabled: boolean;
  days: DayOfWeek[];
  periods: Period[];
  slots: TimetableSlot[];
  /** Set for a date view, where `slots` are only that date's periods. Null for a week view. */
  date?: string | null;
  /** Date views only: false on a Sunday, a Saturday while Saturday is off, or a holiday. */
  schoolDay?: boolean | null;
  holidayName?: string | null;
}

export type ClashReason = 'TEACHER_BUSY' | 'ROOM_BUSY' | 'TEACHER_ABSENT';

/** A period the server refused: the teacher or room is busy elsewhere then, or the teacher is absent. */
export interface TimetableClash {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  /** The teacher being placed (for ROOM_BUSY: the cell's teacher). */
  teacherId: string;
  teacherName: string;
  /** Null for TEACHER_ABSENT. */
  conflictingSectionId: string | null;
  conflictingSectionLabel: string | null;
  // Newer fields: older servers leave them out.
  /** Null for a clash in the weekly timetable; set for a clash on one date. */
  date?: string | null;
  /** Older servers only had teacher clashes, so a missing reason means TEACHER_BUSY. */
  reason?: ClashReason | null;
  roomId?: string | null;
  roomName?: string | null;
  conflictingOverrideId?: string | null;
}

/** One period of a section's weekly timetable, saved on its own. */
export interface CellRequest {
  subjectId: string;
  teacherId: string;
  /** Left out keeps the cell's room; null clears it. */
  roomId?: string | null;
  /** Also assign the teacher to teach the subject in this class when they aren't yet. */
  assignIfMissing?: boolean;
}

export interface CellEditResponse {
  /** The section's week after the change (or as it would be, on a dry run). */
  timetable: Timetable;
  /** The saved period; null after clearing it. */
  slot: TimetableSlot | null;
  assignmentCreated: boolean;
  dryRun: boolean;
}

/** The data of a 409 TIMETABLE_NOT_ASSIGNED: the teacher doesn't teach that subject in the class yet. */
export interface NotAssignedInfo {
  sectionId: string;
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
}

export interface TimetableOverride {
  /** Null on a dry run of a new change. */
  id: string | null;
  date: string;
  dayOfWeek: DayOfWeek;
  sectionId: string;
  className: string;
  section: string;
  periodNumber: number;
  /** From the bell schedule; null if the period is gone. */
  startTime: string | null;
  endTime: string | null;
  kind: OverrideKind;
  originalTeacherId: string | null;
  originalTeacherName: string | null;
  originalSubjectId: string | null;
  originalSubjectName: string | null;
  substituteTeacherId: string | null;
  substituteTeacherName: string | null;
  /** The subject taught: the change's own, else the regular one. Null for CANCELLED. */
  subjectId: string | null;
  subjectName: string | null;
  /** The change's own room; null keeps the regular room (or none). */
  roomId: string | null;
  roomName: string | null;
  /** Only admins and the two teachers get it; null for students and parents. */
  reason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  dryRun?: boolean;
}

export interface OverrideRequest {
  date: string;
  sectionId: string;
  periodNumber: number;
  kind: OverrideKind;
  /** Required for SUBSTITUTE and EXTRA; must be left out for CANCELLED. */
  substituteTeacherId?: string | null;
  /** SUBSTITUTE: null keeps the regular subject. EXTRA: required. CANCELLED: must be null. */
  subjectId?: string | null;
  /** SUBSTITUTE: null keeps the regular room. CANCELLED: must be null. */
  roomId?: string | null;
  reason?: string | null;
}

/** Replaces all four fields (a missing one means null). Kind, date, section and period can't change. */
export interface OverrideUpdateRequest {
  substituteTeacherId?: string | null;
  subjectId?: string | null;
  roomId?: string | null;
  reason?: string | null;
}

/** A period of a teacher marked Absent or Half day that nobody is covering yet. */
export interface UncoveredPeriod {
  date: string;
  teacherId: string;
  teacherName: string;
  attendanceStatus: 'ABSENT' | 'HALF_DAY';
  sectionId: string;
  className: string;
  section: string;
  periodNumber: number;
  startTime: string | null;
  endTime: string | null;
  subjectId: string | null;
  subjectName: string | null;
  roomId: string | null;
  roomName: string | null;
  /** Set when this is a cover whose substitute is now absent: edit that change. */
  overrideId: string | null;
}

/** A teacher who is free in one period on one date. */
export interface FreeTeacher {
  teacherId: string;
  name: string;
  designation: string | null;
  /** Periods they already teach that day. */
  periodsThatDay: number;
  /** ABSENT teachers are never listed. */
  attendanceStatus: 'PRESENT' | 'LATE' | 'HALF_DAY' | null;
  /** Already teaches a subject in the class asked about. */
  teachesSection: boolean;
}

/** Writes the bot will also use can be checked without saving; the app always saves. */
export interface WriteOptions {
  dryRun?: boolean;
}

type QueryValue = string | number | boolean | null | undefined;

/** "?a=1&b=x" from the values that are set, or "" when none are. */
export function toQuery(params: Record<string, QueryValue>): string {
  const parts = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

const dryRunQuery = (opts?: WriteOptions) => toQuery({ dryRun: opts?.dryRun ? true : undefined });

export function getPeriods(schoolId: string) {
  return api.get<PeriodSchedule>('/api/v1/periods', schoolId);
}

export function savePeriods(schoolId: string, req: PeriodScheduleRequest) {
  return api.put<PeriodSchedule>('/api/v1/periods', req, schoolId);
}

export function getSectionTimetable(schoolId: string, sectionId: string) {
  return api.get<Timetable>(`/api/v1/class-sections/${sectionId}/timetable`, schoolId);
}

/** Replaces the section's whole week. Rejects with an ApiError carrying clashes on a 409 - see clashesFromError. */
export function saveSectionTimetable(schoolId: string, sectionId: string, slots: TimetableSlotRequest[]) {
  return api.put<Timetable>(`/api/v1/class-sections/${sectionId}/timetable`, { slots }, schoolId);
}

/**
 * Saves one period of a section's week (admin). Rejects with TIMETABLE_CLASH (see clashesFromError),
 * TIMETABLE_NOT_ASSIGNED (see notAssignedFromError) or TIMETABLE_INVALID.
 */
export function setTimetableCell(
  schoolId: string,
  sectionId: string,
  day: DayOfWeek,
  periodNumber: number,
  req: CellRequest,
  opts?: WriteOptions
) {
  return api.put<CellEditResponse>(
    `/api/v1/class-sections/${sectionId}/timetable/slots/${day}/${periodNumber}${dryRunQuery(opts)}`,
    req,
    schoolId
  );
}

/** Leaves one period of a section's week free (admin). Clearing a free period is fine. */
export function clearTimetableCell(
  schoolId: string,
  sectionId: string,
  day: DayOfWeek,
  periodNumber: number,
  opts?: WriteOptions
) {
  return api.delete<CellEditResponse>(
    `/api/v1/class-sections/${sectionId}/timetable/slots/${day}/${periodNumber}${dryRunQuery(opts)}`,
    schoolId
  );
}

/**
 * One date's periods, with that day's changes applied: a section's (admin, its teachers, its
 * students, a linked parent) or a teacher's (admin, or the teacher themselves).
 */
export function getDayTimetable(schoolId: string, date: string, target: { sectionId: string } | { teacherId: string }) {
  const query = toQuery({
    date,
    sectionId: 'sectionId' in target ? target.sectionId : undefined,
    teacherId: 'teacherId' in target ? target.teacherId : undefined,
  });
  return api.get<Timetable>(`/api/v1/timetable/day${query}`, schoolId);
}

/** Admin: any teacher's week, or with `date` that teacher's periods on that date. */
export function getTeacherTimetable(schoolId: string, employeeId: string, date?: string) {
  return api.get<Timetable>(`/api/v1/teachers/${employeeId}/timetable${toQuery({ date })}`, schoolId);
}

/**
 * Teacher: own periods. Student: own section. Parent: pass the child's id. With `date`, that
 * date's periods with its changes applied; without, the week.
 */
export function getMyTimetable(schoolId: string, childId?: string, date?: string) {
  return api.get<Timetable>(`/api/v1/timetable/me${toQuery({ childId, date })}`, schoolId);
}

export interface OverrideListParams {
  /** Defaults to today on the server. */
  from?: string;
  /** Defaults to `from` + 30 days; at most 62 days after `from`. */
  to?: string;
  sectionId?: string;
  teacherId?: string;
}

export function listOverrides(schoolId: string, params: OverrideListParams = {}) {
  return api.get<TimetableOverride[]>(`/api/v1/timetable/overrides${toQuery({ ...params })}`, schoolId);
}

/** Admin. Rejects with TIMETABLE_CLASH, TIMETABLE_OVERRIDE_EXISTS or TIMETABLE_INVALID. */
export function createOverride(schoolId: string, req: OverrideRequest, opts?: WriteOptions) {
  return api.post<TimetableOverride>(`/api/v1/timetable/overrides${dryRunQuery(opts)}`, req, schoolId);
}

export function updateOverride(schoolId: string, overrideId: string, req: OverrideUpdateRequest, opts?: WriteOptions) {
  return api.put<TimetableOverride>(`/api/v1/timetable/overrides/${overrideId}${dryRunQuery(opts)}`, req, schoolId);
}

/** Admin: undoes a change, handing the period back to the regular teacher. Refused with a clash if they're now busy. */
export function deleteOverride(schoolId: string, overrideId: string, opts?: WriteOptions) {
  return api.delete<TimetableOverride>(`/api/v1/timetable/overrides/${overrideId}${dryRunQuery(opts)}`, schoolId);
}

/** Admin: the periods of teachers marked Absent or Half day on `date` that still need a substitute. */
export function getUncoveredPeriods(schoolId: string, date: string) {
  return api.get<UncoveredPeriod[]>(`/api/v1/timetable/uncovered${toQuery({ date })}`, schoolId);
}

/** Admin: teachers free in that period on that date, fewest periods that day first. */
export function getFreeTeachers(schoolId: string, date: string, periodNumber: number, sectionId?: string) {
  return api.get<FreeTeacher[]>(`/api/v1/timetable/free-teachers${toQuery({ date, periodNumber, sectionId })}`, schoolId);
}

/** The clashing slots from a failed save, or null if the error wasn't a clash. */
export function clashesFromError(e: unknown): TimetableClash[] | null {
  if (e instanceof ApiError && e.errorCode === 'TIMETABLE_CLASH') {
    return Array.isArray(e.data) ? (e.data as TimetableClash[]) : [];
  }
  return null;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

/** The subject and teacher from a 409 TIMETABLE_NOT_ASSIGNED, or null for any other error. */
export function notAssignedFromError(e: unknown): NotAssignedInfo | null {
  if (!(e instanceof ApiError) || e.errorCode !== 'TIMETABLE_NOT_ASSIGNED') return null;
  const data = asRecord(e.data);
  return {
    sectionId: asString(data.sectionId),
    subjectId: asString(data.subjectId),
    subjectName: asString(data.subjectName),
    teacherId: asString(data.teacherId),
    teacherName: asString(data.teacherName),
  };
}

/** The change already saved for that class, date and period, from a 409 TIMETABLE_OVERRIDE_EXISTS. */
export function overrideExistsFromError(e: unknown): { overrideId: string | null } | null {
  if (!(e instanceof ApiError) || e.errorCode !== 'TIMETABLE_OVERRIDE_EXISTS') return null;
  return { overrideId: asString(asRecord(e.data).overrideId) || null };
}

/** Which rule a 400 TIMETABLE_INVALID broke (e.g. 'PAST_DATE', 'HOLIDAY'), or null for any other error. */
export function timetableRuleFromError(e: unknown): string | null {
  if (!(e instanceof ApiError) || e.errorCode !== 'TIMETABLE_INVALID') return null;
  return asString(asRecord(e.data).rule) || null;
}

/**
 * A section's weekly timetable as a one-page landscape PDF - the week view, printable. Same access
 * rules as GET /class-sections/{id}/timetable; rejects when the school has no bell schedule yet.
 */
export function downloadSectionTimetablePdf(
  schoolId: string,
  section: { id: string; className: string; section: string }
) {
  return downloadPdf(
    schoolId,
    `/api/v1/class-sections/${section.id}/timetable.pdf`,
    timetablePdfFileName(section.className, section.section)
  );
}
