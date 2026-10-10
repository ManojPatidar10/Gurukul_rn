import type { Assessment, ClassSection, OwnerType, SubjectAssignment, UserRole } from '../api/types';

export interface PermissionSession {
  role: UserRole;
  ownerId: string;
}

export interface CreatorSession extends PermissionSession {
  ownerType: OwnerType;
}

export interface SubjectChoice {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
}

export interface TeacherChoice {
  teacherId: string;
  teacherName: string;
  isClassTeacher: boolean;
}

type AssessmentOwnership = Pick<Assessment, 'subjectId' | 'createdByTeacherId'>;

export interface AssessmentPermissions {
  /** "+ New assessment". */
  canCreateAssessment: boolean;
  /** Edit, Delete and Enter results on this assessment. */
  canManageAssessment: (assessment: AssessmentOwnership) => boolean;
  /** Opening this assessment's marks list, read-only when canManageAssessment is false. */
  canViewResults: (assessment: AssessmentOwnership) => boolean;
  /** "+ Assign subject" on the section's Subjects screen. */
  canAssignSubjectTeachers: boolean;
  /** Subjects the caller may put a new assessment under, sorted by name. */
  subjectChoices: SubjectChoice[];
  /** Who an admin may record as an assessment's teacher. Empty for everyone else. */
  teacherChoices: TeacherChoice[];
}

/**
 * Mirrors the server's assessment rules (specs/teacher-permissions-and-marks), so the app only
 * offers what the server will allow:
 * - ADMIN may do everything.
 * - The section's class teacher may do everything in that section.
 * - A subject teacher may add assessments for, and manage, the subjects they teach in the section,
 *   and may read the marks of every assessment there.
 * - An assessment's creator may manage it.
 * - Anyone else (STUDENT, PARENT, DRIVER, an unrelated teacher) gets nothing.
 * `assignments` is the section's subject teachers (listSectionSubjects). Pass [] when they couldn't
 * be loaded: the class teacher and creator rules still work. The server is the real check.
 */
export function assessmentPermissions(
  session: PermissionSession,
  classSection: Pick<ClassSection, 'classTeacherId' | 'classTeacherName'>,
  assignments: SubjectAssignment[]
): AssessmentPermissions {
  const isAdmin = session.role === 'ADMIN';
  const isTeacher = session.role === 'TEACHER';
  const isClassTeacher = isTeacher && !!classSection.classTeacherId && classSection.classTeacherId === session.ownerId;
  const mine = isTeacher ? assignments.filter((a) => a.teacherId === session.ownerId) : [];
  const teachesSubject = (subjectId: string | null) => !!subjectId && mine.some((a) => a.subjectId === subjectId);
  const teachesInSection = isClassTeacher || mine.length > 0;
  const fullAccess = isAdmin || isClassTeacher;

  const canManageAssessment = (a: AssessmentOwnership) =>
    fullAccess ||
    teachesSubject(a.subjectId) ||
    (isTeacher && !!a.createdByTeacherId && a.createdByTeacherId === session.ownerId);

  return {
    canCreateAssessment: fullAccess || mine.length > 0,
    canManageAssessment,
    canViewResults: (a) => canManageAssessment(a) || teachesInSection,
    canAssignSubjectTeachers: fullAccess,
    subjectChoices: uniqueSubjects(fullAccess ? assignments : mine),
    teacherChoices: isAdmin ? sectionTeachers(classSection, assignments) : [],
  };
}

function uniqueSubjects(assignments: SubjectAssignment[]): SubjectChoice[] {
  const byId = new Map<string, SubjectChoice>();
  assignments.forEach((a) => {
    if (!byId.has(a.subjectId)) {
      byId.set(a.subjectId, { subjectId: a.subjectId, subjectName: a.subjectName, subjectCode: a.subjectCode });
    }
  });
  return Array.from(byId.values()).sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

/** The class teacher first, then the section's subject teachers by name, each once. */
function sectionTeachers(
  classSection: Pick<ClassSection, 'classTeacherId' | 'classTeacherName'>,
  assignments: SubjectAssignment[]
): TeacherChoice[] {
  const subjectTeachers = new Map<string, TeacherChoice>();
  assignments.forEach((a) => {
    if (a.teacherId !== classSection.classTeacherId && !subjectTeachers.has(a.teacherId)) {
      subjectTeachers.set(a.teacherId, { teacherId: a.teacherId, teacherName: a.teacherName, isClassTeacher: false });
    }
  });
  const sorted = Array.from(subjectTeachers.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));
  if (!classSection.classTeacherId) return sorted;
  const classTeacher: TeacherChoice = {
    teacherId: classSection.classTeacherId,
    teacherName: classSection.classTeacherName ?? 'Class teacher',
    isClassTeacher: true,
  };
  return [classTeacher, ...sorted];
}

/** The subject's teacher in this section when there is exactly one, else null. */
export function soleSubjectTeacher(assignments: SubjectAssignment[], subjectId: string | null): string | null {
  if (!subjectId) return null;
  const teachers = new Set(assignments.filter((a) => a.subjectId === subjectId).map((a) => a.teacherId));
  return teachers.size === 1 ? Array.from(teachers)[0] : null;
}

/**
 * True when the caller's rights in this section hang on its subject assignments - a teacher who
 * isn't the class teacher. Admins and the class teacher have every right without them.
 */
export function rightsDependOnAssignments(
  session: PermissionSession,
  classSection: Pick<ClassSection, 'classTeacherId'>
): boolean {
  return session.role === 'TEACHER' && classSection.classTeacherId !== session.ownerId;
}

export type ActionAccess = 'allowed' | 'checking' | 'denied';

/**
 * Whether a screen shows an action, a "checking" placeholder, or nothing. While a subject
 * teacher's assignments are still loading, a right they may turn out to have shows as being
 * checked instead of silently missing.
 */
export function actionAccess(allowed: boolean, dependsOnAssignments: boolean, assignmentsLoading: boolean): ActionAccess {
  if (allowed) return 'allowed';
  return dependsOnAssignments && assignmentsLoading ? 'checking' : 'denied';
}

/**
 * The `teacherId` the assessment form sends, or undefined to leave it out. The current server
 * ignores it from a TEACHER, and records an admin who leaves it out as the creator. A server from
 * before specs/teacher-permissions-and-marks sets the creator to whatever is sent and clears it when
 * nothing is, so the form sends what gives the same creator on both:
 * - TEACHER: themselves on create, the current creator on edit.
 * - ADMIN: the picked teacher. With none picked, themselves on create (when they're an employee),
 *   the current creator on edit.
 */
export function creatorTeacherId(
  session: CreatorSession,
  pickedTeacherId: string | null,
  assessment: Pick<Assessment, 'createdByTeacherId'> | null
): string | undefined {
  if (session.role !== 'ADMIN' && session.role !== 'TEACHER') return undefined;
  if (session.role === 'ADMIN' && pickedTeacherId) return pickedTeacherId;
  if (assessment) return assessment.createdByTeacherId ?? undefined;
  return session.ownerType === 'EMPLOYEE' ? session.ownerId : undefined;
}

/**
 * The hint under an admin's Teacher chips on the create form, or null for none. Nothing while the
 * section's teachers are loading or failed to load (the notice above the chips covers that), since
 * "no teachers" isn't known yet. An admin who isn't an employee is recorded as nobody, so they
 * aren't promised otherwise.
 */
export function adminTeacherHint(opts: {
  assignmentsLoading: boolean;
  assignmentsFailed: boolean;
  hasChoices: boolean;
  adminIsEmployee: boolean;
}): string | null {
  if (opts.assignmentsLoading || opts.assignmentsFailed) return null;
  if (opts.hasChoices) {
    return opts.adminIsEmployee ? 'Optional. Leave it empty to record yourself as the teacher.' : 'Optional.';
  }
  return opts.adminIsEmployee
    ? 'No teachers are assigned to this class yet, so you will be recorded as the teacher.'
    : 'No teachers are assigned to this class yet.';
}
