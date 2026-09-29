import { ApiError, api } from './client';

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

export interface TimetableSlot {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
  sectionId: string;
  className: string;
  section: string;
}

export interface TimetableSlotRequest {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  subjectId: string;
  teacherId: string;
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
}

/** A slot the server refused: the teacher is already teaching another section then. */
export interface TimetableClash {
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  teacherId: string;
  teacherName: string;
  conflictingSectionId: string;
  conflictingSectionLabel: string;
}

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

/** Teacher: own periods. Student: own section. Parent: pass the child's id. */
export function getMyTimetable(schoolId: string, childId?: string) {
  const query = childId ? `?childId=${encodeURIComponent(childId)}` : '';
  return api.get<Timetable>(`/api/v1/timetable/me${query}`, schoolId);
}

/** The clashing slots from a failed save, or null if the error wasn't a clash. */
export function clashesFromError(e: unknown): TimetableClash[] | null {
  if (e instanceof ApiError && e.errorCode === 'TIMETABLE_CLASH') {
    return Array.isArray(e.data) ? (e.data as TimetableClash[]) : [];
  }
  return null;
}
