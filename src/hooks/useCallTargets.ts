import { useEffect, useState } from 'react';

import { listEmployees } from '../api/employees';
import { getStudent } from '../api/students';
import type { OwnerType } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useSchoolId } from '../context/SchoolContext';

export interface CallTarget {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
}

/**
 * Who the current session is allowed to call/invite, mirroring the backend's
 * CallAuthorizationService rule: a STUDENT-owner session (a parent's login - there is no separate
 * Parent entity) can only reach their child's class teacher; an ADMIN employee can reach any
 * other employee; a non-admin employee can only reach an admin/principal. The backend is the
 * real enforcement point - this just narrows the picker to valid choices.
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
          setTargets(
            student.classTeacherId
              ? [{ ownerType: 'EMPLOYEE' as const, ownerId: student.classTeacherId, name: student.classTeacherName ?? 'Class teacher' }]
              : []
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

  return { targets, loading, error };
}
