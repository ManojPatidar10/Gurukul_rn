import type { FreeTeacher, OverrideKind, OverrideUpdateRequest, TimetableOverride, UncoveredPeriod } from '../api/timetable';

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * Free teachers in the server's order: fewest periods that day first, then those who already
 * teach the class, then by name. Re-applied on the phone so the list stays put after local edits.
 */
export function sortFreeTeachers(teachers: FreeTeacher[]): FreeTeacher[] {
  return [...teachers].sort(
    (a, b) =>
      a.periodsThatDay - b.periodsThatDay ||
      Number(b.teachesSection) - Number(a.teachesSection) ||
      byName(a.name ?? '', b.name ?? '')
  );
}

/** One absent (or half-day) teacher and their periods that still need a substitute. */
export interface UncoveredGroup {
  teacherId: string;
  teacherName: string;
  /** The chip next to their name. */
  attendanceStatus: 'ABSENT' | 'HALF_DAY';
  /** In period order. */
  periods: UncoveredPeriod[];
}

/** The "Needs a substitute" list: one group per teacher, by name, each with its periods in order. */
export function groupUncoveredByTeacher(uncovered: UncoveredPeriod[]): UncoveredGroup[] {
  const groups = new Map<string, UncoveredGroup>();
  for (const entry of uncovered) {
    const group = groups.get(entry.teacherId);
    if (group) {
      group.periods.push(entry);
      // Rows of one teacher share their attendance; if they ever differ, Absent is the stronger signal.
      if (entry.attendanceStatus === 'ABSENT') group.attendanceStatus = 'ABSENT';
    } else {
      groups.set(entry.teacherId, {
        teacherId: entry.teacherId,
        teacherName: entry.teacherName,
        attendanceStatus: entry.attendanceStatus,
        periods: [entry],
      });
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, periods: [...g.periods].sort((a, b) => a.periodNumber - b.periodNumber || byName(a.className, b.className)) }))
    .sort((a, b) => byName(a.teacherName, b.teacherName) || a.teacherId.localeCompare(b.teacherId));
}

/**
 * What "Find substitute" does for a period that needs cover: make a new change, or - when it is a
 * cover whose substitute is now absent - edit that change.
 */
export function uncoveredAction(entry: Pick<UncoveredPeriod, 'overrideId'>): 'create' | 'edit' {
  return entry.overrideId ? 'edit' : 'create';
}

/** How a row of "Changes on this day" reads: who the period moves from, and to. */
export interface OverrideSummary {
  kind: OverrideKind;
  /** The teacher it was taken from; null for an extra class. */
  from: string | null;
  /** The teacher taking it; null for a cancelled period. */
  to: string | null;
  subject: string | null;
}

export function overrideSummary(o: TimetableOverride): OverrideSummary {
  const subject = o.subjectName ?? o.originalSubjectName ?? null;
  switch (o.kind) {
    case 'CANCELLED':
      return { kind: o.kind, from: o.originalTeacherName, to: null, subject };
    case 'EXTRA':
      return { kind: o.kind, from: null, to: o.substituteTeacherName, subject };
    default:
      return { kind: o.kind, from: o.originalTeacherName, to: o.substituteTeacherName, subject };
  }
}

/** How many periods need a substitute (for the dashboard card). */
export function coverCount(uncovered: UncoveredPeriod[]): number {
  return new Set(uncovered.map((u) => `${u.sectionId}|${u.periodNumber}`)).size;
}

/**
 * The PUT body for changing an existing substitution. A PUT replaces all four fields, so the
 * subject has to be sent again: the response only carries the subject taught (the change's own,
 * else the regular one), so when that is the regular subject it is sent as null - "keep the
 * regular subject" - rather than pinned.
 */
export function overrideUpdateFromExisting(
  existing: TimetableOverride,
  change: { substituteTeacherId: string; roomId: string | null; reason: string | null }
): OverrideUpdateRequest {
  const ownSubject = existing.subjectId && existing.subjectId !== existing.originalSubjectId ? existing.subjectId : null;
  return {
    substituteTeacherId: change.substituteTeacherId,
    subjectId: ownSubject,
    roomId: change.roomId,
    reason: change.reason?.trim() ? change.reason.trim() : null,
  };
}
