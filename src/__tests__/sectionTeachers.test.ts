import type { SubjectAssignment } from '../api/types';
import { sectionTeachers } from '../utils/sectionTeachers';

function row(teacherId: string, teacherName: string, subjectName: string): SubjectAssignment {
  return { subjectId: `sub-${subjectName}`, subjectName, subjectCode: subjectName.slice(0, 3).toUpperCase(), teacherId, teacherName };
}

describe('sectionTeachers', () => {
  it('lists each teacher once, merging their subjects in first-seen order', () => {
    expect(
      sectionTeachers([row('t1', 'Meena', 'Maths'), row('t2', 'Arjun', 'Hindi'), row('t1', 'Meena', 'Science')])
    ).toEqual([
      { teacherId: 't2', teacherName: 'Arjun', subjectNames: ['Hindi'] },
      { teacherId: 't1', teacherName: 'Meena', subjectNames: ['Maths', 'Science'] },
    ]);
  });

  it('does not repeat a subject listed twice for the same teacher', () => {
    expect(sectionTeachers([row('t1', 'Meena', 'Maths'), row('t1', 'Meena', 'Maths')])).toEqual([
      { teacherId: 't1', teacherName: 'Meena', subjectNames: ['Maths'] },
    ]);
  });

  it('skips subjects with no teacher assigned', () => {
    const unassigned = { ...row('', '', 'Art'), teacherId: null } as unknown as SubjectAssignment;
    expect(sectionTeachers([unassigned, row('', '', 'Music'), row('t1', 'Meena', 'Maths')])).toEqual([
      { teacherId: 't1', teacherName: 'Meena', subjectNames: ['Maths'] },
    ]);
  });

  it('sorts teachers by name', () => {
    const names = sectionTeachers([row('a', 'Zoya', 'Maths'), row('b', 'Anil', 'English'), row('c', 'Kiran', 'EVS')]).map(
      (t) => t.teacherName
    );
    expect(names).toEqual(['Anil', 'Kiran', 'Zoya']);
  });

  it('returns an empty list for a section with no subjects', () => {
    expect(sectionTeachers([])).toEqual([]);
  });
});
