import { useEffect, useState } from 'react';

import { listStudentsInClassSection } from '../api/classSections';
import { listEmployees } from '../api/employees';
import { listSectionSubjects } from '../api/sectionSubjects';
import { getStudent, searchStudents } from '../api/students';
import type { OwnerType } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useSchoolId } from '../context/SchoolContext';

export interface CallTarget {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

/**
 * Who the current session is allowed to call/invite, mirroring the backend's
 * CallAuthorizationService rule: a STUDENT-owner session (a parent's login - there is no separate
 * Parent entity) can reach their class teacher, every subject teacher assigned to their section,
 * and classmates in the same class-section; an ADMIN employee can reach any other employee or any
 * student in the school; a non-admin employee can only reach an admin/principal, or a student in
 * their own class-section. The backend is the real enforcement point - this just narrows the
 * picker to valid choices.
 */
export function useCallTargets() {
  const schoolId = useSchoolId();
  const { session } = useAuth();
  const [targets, setTargets] = useState<CallTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (session.ownerType === 'STUDENT') {
      getStudent(schoolId, session.ownerId)
        .then((student) => {
          const teacherTargets = new Map<string, CallTarget>();
          if (student.classTeacherId) {
            teacherTargets.set(student.classTeacherId, {
              ownerType: 'EMPLOYEE' as const,
              ownerId: student.classTeacherId,
              name: student.classTeacherName ?? 'Class teacher',
            });
          }

          const withSubjectTeachers = student.classSectionId
            ? listSectionSubjects(schoolId, student.classSectionId)
                .then((assignments) => {
                  assignments.forEach((a) => {
                    if (!teacherTargets.has(a.teacherId)) {
                      teacherTargets.set(a.teacherId, { ownerType: 'EMPLOYEE' as const, ownerId: a.teacherId, name: a.teacherName });
                    }
                  });
                })
                .catch(() => {})
            : Promise.resolve();

          return withSubjectTeachers.then(() =>
            listStudentsInClassSection(schoolId, student.classSectionId)
              .then((classmates) => {
                const classmateTargets = classmates
                  .filter((s) => s.id !== student.id)
                  .map((s) => ({ ownerType: 'STUDENT' as const, ownerId: s.id, name: s.name }));
                setTargets([...teacherTargets.values(), ...classmateTargets]);
              })
              .catch(() => setTargets([...teacherTargets.values()]))
          );
        })
        .catch((e) => setError((e as Error).message))
        .finally(() => setLoading(false));
      return;
    }

    listEmployees(schoolId)
      .then((employees) => {
        const candidates =
          session.role === 'ADMIN'
            ? employees.filter((e) => e.id !== session.ownerId)
            : employees.filter((e) => e.role === 'ADMIN');
        setTargets(candidates.map((e) => ({ ownerType: 'EMPLOYEE' as const, ownerId: e.id, name: e.name })));
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [schoolId, session.ownerType, session.ownerId, session.role]);

  // Every role's `targets` above is already the caller's full reachable set (never large enough
  // to need a remote search) - a simple local name filter is enough, layered on top of the
  // remote employee->student search below for the one case where the full set genuinely isn't
  // preloaded (an admin/teacher searching the whole school's students).
  const [localQuery, setLocalQuery] = useState('');
  const filteredTargets = localQuery.trim()
    ? targets.filter((t) => t.name.toLowerCase().includes(localQuery.trim().toLowerCase()))
    : targets;

  const canSearchStudents = session.ownerType === 'EMPLOYEE';
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState<CallTarget[]>([]);
  const [searchingStudents, setSearchingStudents] = useState(false);

  useEffect(() => {
    if (!canSearchStudents || studentQuery.trim().length < MIN_QUERY_LENGTH) {
      setStudentResults([]);
      return;
    }
    let cancelled = false;
    setSearchingStudents(true);
    const handle = setTimeout(() => {
      searchStudents(schoolId, studentQuery.trim())
        .then((students) => {
          if (cancelled) return;
          // Admin/principal can reach any student in the school. A non-admin employee can only
          // call a student who's in their own class-section (CallAuthorizationService.
          // isClassTeacherOf) - narrow to that here too, same "backend is the real enforcement
          // point, this just narrows the picker" spirit as the static employee-target list above.
          const reachableStudents =
            session.role === 'ADMIN' ? students : students.filter((s) => s.classTeacherId === session.ownerId);
          setStudentResults(
            reachableStudents.map((s) => ({
              ownerType: 'STUDENT' as const,
              ownerId: s.id,
              name: s.parentName ? `${s.name} (${s.parentName})` : s.name,
            }))
          );
        })
        .catch(() => !cancelled && setStudentResults([]))
        .finally(() => !cancelled && setSearchingStudents(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [canSearchStudents, studentQuery, schoolId, session.ownerId, session.role]);

  return {
    targets,
    filteredTargets,
    localQuery,
    setLocalQuery,
    loading,
    error,
    canSearchStudents,
    studentQuery,
    setStudentQuery,
    studentResults,
    searchingStudents,
  };
}
