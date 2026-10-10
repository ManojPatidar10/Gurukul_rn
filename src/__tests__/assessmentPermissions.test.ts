import type { SubjectAssignment, UserRole } from '../api/types';
import { assessmentPermissions, soleSubjectTeacher } from '../utils/assessmentPermissions';

const CLASS_TEACHER = 'emp-class';
const MATHS_TEACHER = 'emp-maths';
const SCIENCE_TEACHER = 'emp-science';
const OUTSIDER = 'emp-outsider';

const section = { classTeacherId: CLASS_TEACHER, classTeacherName: 'Kavita Rao' };

function assignment(subjectId: string, subjectName: string, teacherId: string, teacherName: string): SubjectAssignment {
  return { subjectId, subjectName, subjectCode: subjectName.slice(0, 3).toUpperCase(), teacherId, teacherName };
}

const MATHS = assignment('maths', 'Maths', MATHS_TEACHER, 'Arun Mehta');
const SCIENCE = assignment('science', 'Science', SCIENCE_TEACHER, 'Neha Joshi');
const ENGLISH = assignment('english', 'English', CLASS_TEACHER, 'Kavita Rao');
const ASSIGNMENTS = [SCIENCE, MATHS, ENGLISH];

const mathsTest = { subjectId: 'maths', createdByTeacherId: MATHS_TEACHER };
const scienceTest = { subjectId: 'science', createdByTeacherId: SCIENCE_TEACHER };
const legacyTest = { subjectId: null, createdByTeacherId: null };

function as(role: UserRole, ownerId: string) {
  return assessmentPermissions({ role, ownerId }, section, ASSIGNMENTS);
}

describe('assessmentPermissions', () => {
  it('lets an admin do everything', () => {
    const p = as('ADMIN', 'emp-admin');
    expect(p.canCreateAssessment).toBe(true);
    expect(p.canAssignSubjectTeachers).toBe(true);
    for (const a of [mathsTest, scienceTest, legacyTest]) {
      expect(p.canManageAssessment(a)).toBe(true);
      expect(p.canViewResults(a)).toBe(true);
    }
  });

  it('lets the class teacher do everything in their section', () => {
    const p = as('TEACHER', CLASS_TEACHER);
    expect(p.canCreateAssessment).toBe(true);
    expect(p.canAssignSubjectTeachers).toBe(true);
    for (const a of [mathsTest, scienceTest, legacyTest]) {
      expect(p.canManageAssessment(a)).toBe(true);
      expect(p.canViewResults(a)).toBe(true);
    }
  });

  it('lets a subject teacher manage their own subject and only read the others', () => {
    const p = as('TEACHER', MATHS_TEACHER);
    expect(p.canCreateAssessment).toBe(true);
    expect(p.canAssignSubjectTeachers).toBe(false);
    expect(p.canManageAssessment(mathsTest)).toBe(true);
    // A Maths assessment someone else created is still theirs to manage.
    expect(p.canManageAssessment({ subjectId: 'maths', createdByTeacherId: CLASS_TEACHER })).toBe(true);
    expect(p.canManageAssessment(scienceTest)).toBe(false);
    expect(p.canViewResults(scienceTest)).toBe(true);
    expect(p.canManageAssessment(legacyTest)).toBe(false);
    expect(p.canViewResults(legacyTest)).toBe(true);
  });

  it('lets the creator manage their assessment even after it moved to a subject they do not teach', () => {
    const p = as('TEACHER', MATHS_TEACHER);
    expect(p.canManageAssessment({ subjectId: 'science', createdByTeacherId: MATHS_TEACHER })).toBe(true);
  });

  it('lets a creator who no longer teaches in the section manage and read only their own assessment', () => {
    const p = as('TEACHER', OUTSIDER);
    const own = { subjectId: 'maths', createdByTeacherId: OUTSIDER };
    expect(p.canManageAssessment(own)).toBe(true);
    expect(p.canViewResults(own)).toBe(true);
    expect(p.canViewResults(mathsTest)).toBe(false);
  });

  it('gives an unrelated teacher nothing', () => {
    const p = as('TEACHER', OUTSIDER);
    expect(p.canCreateAssessment).toBe(false);
    expect(p.canAssignSubjectTeachers).toBe(false);
    expect(p.canManageAssessment(mathsTest)).toBe(false);
    expect(p.canViewResults(mathsTest)).toBe(false);
    expect(p.subjectChoices).toEqual([]);
    expect(p.teacherChoices).toEqual([]);
  });

  it.each<UserRole>(['STUDENT', 'PARENT', 'DRIVER'])('gives a %s nothing, even with a matching id', (role) => {
    // A non-teacher whose ownerId happens to equal a teacher's must still get nothing.
    const p = as(role, CLASS_TEACHER);
    expect(p.canCreateAssessment).toBe(false);
    expect(p.canAssignSubjectTeachers).toBe(false);
    expect(p.canManageAssessment({ subjectId: 'english', createdByTeacherId: CLASS_TEACHER })).toBe(false);
    expect(p.canViewResults(mathsTest)).toBe(false);
    expect(p.subjectChoices).toEqual([]);
    expect(p.teacherChoices).toEqual([]);
  });

  it('falls back to the class-teacher and creator rules when the assignments did not load', () => {
    const classTeacher = assessmentPermissions({ role: 'TEACHER', ownerId: CLASS_TEACHER }, section, []);
    expect(classTeacher.canCreateAssessment).toBe(true);
    expect(classTeacher.canManageAssessment(mathsTest)).toBe(true);
    const creator = assessmentPermissions({ role: 'TEACHER', ownerId: MATHS_TEACHER }, section, []);
    expect(creator.canCreateAssessment).toBe(false);
    expect(creator.canManageAssessment(mathsTest)).toBe(true);
    expect(creator.canManageAssessment(scienceTest)).toBe(false);
  });

  it('does not treat a section with no class teacher as everyone being its class teacher', () => {
    const p = assessmentPermissions({ role: 'TEACHER', ownerId: OUTSIDER }, { classTeacherId: null, classTeacherName: null }, []);
    expect(p.canCreateAssessment).toBe(false);
    expect(p.canAssignSubjectTeachers).toBe(false);
  });
});

describe('subjectChoices', () => {
  it('offers admins and the class teacher every subject, once each, by name', () => {
    const withDuplicate = [...ASSIGNMENTS, assignment('maths', 'Maths', SCIENCE_TEACHER, 'Neha Joshi')];
    const expected = ['English', 'Maths', 'Science'];
    expect(assessmentPermissions({ role: 'ADMIN', ownerId: 'x' }, section, withDuplicate).subjectChoices.map((s) => s.subjectName)).toEqual(expected);
    expect(
      assessmentPermissions({ role: 'TEACHER', ownerId: CLASS_TEACHER }, section, withDuplicate).subjectChoices.map((s) => s.subjectName)
    ).toEqual(expected);
  });

  it('offers a subject teacher only the subjects they teach here', () => {
    const p = assessmentPermissions({ role: 'TEACHER', ownerId: SCIENCE_TEACHER }, section, [
      ...ASSIGNMENTS,
      assignment('maths', 'Maths', SCIENCE_TEACHER, 'Neha Joshi'),
    ]);
    expect(p.subjectChoices).toEqual([
      { subjectId: 'maths', subjectName: 'Maths', subjectCode: 'MAT' },
      { subjectId: 'science', subjectName: 'Science', subjectCode: 'SCI' },
    ]);
  });
});

describe('teacherChoices', () => {
  it('lists the class teacher first, then each subject teacher once, by name - for admins only', () => {
    const withDuplicate = [...ASSIGNMENTS, assignment('evs', 'EVS', SCIENCE_TEACHER, 'Neha Joshi')];
    expect(assessmentPermissions({ role: 'ADMIN', ownerId: 'x' }, section, withDuplicate).teacherChoices).toEqual([
      { teacherId: CLASS_TEACHER, teacherName: 'Kavita Rao', isClassTeacher: true },
      { teacherId: MATHS_TEACHER, teacherName: 'Arun Mehta', isClassTeacher: false },
      { teacherId: SCIENCE_TEACHER, teacherName: 'Neha Joshi', isClassTeacher: false },
    ]);
    expect(assessmentPermissions({ role: 'TEACHER', ownerId: CLASS_TEACHER }, section, withDuplicate).teacherChoices).toEqual([]);
  });

  it('works for a section with no class teacher', () => {
    expect(
      assessmentPermissions({ role: 'ADMIN', ownerId: 'x' }, { classTeacherId: null, classTeacherName: null }, [MATHS]).teacherChoices
    ).toEqual([{ teacherId: MATHS_TEACHER, teacherName: 'Arun Mehta', isClassTeacher: false }]);
  });
});

describe('soleSubjectTeacher', () => {
  it('returns the teacher when the subject has exactly one in the section', () => {
    expect(soleSubjectTeacher(ASSIGNMENTS, 'maths')).toBe(MATHS_TEACHER);
  });

  it('returns null with no subject, no teacher, or more than one', () => {
    expect(soleSubjectTeacher(ASSIGNMENTS, null)).toBeNull();
    expect(soleSubjectTeacher(ASSIGNMENTS, 'hindi')).toBeNull();
    expect(soleSubjectTeacher([...ASSIGNMENTS, assignment('maths', 'Maths', SCIENCE_TEACHER, 'Neha Joshi')], 'maths')).toBeNull();
  });
});
