import { useCallback, useEffect, useState } from 'react';

import { getErrorMessage } from '../api/errorMessage';
import { listSectionSubjects } from '../api/sectionSubjects';
import type { SubjectAssignment } from '../api/types';

/**
 * A section's subject teachers, which the assessment screens need to work out what the logged-in
 * teacher may do there (utils/assessmentPermissions). Pass a null `sectionId` to skip the request -
 * STUDENT and PARENT sessions never need it. On failure `assignments` stays empty and `error` is
 * set: screens then fall back to the class-teacher rule and offer `reload`.
 */
export function useSectionAssignments(schoolId: string, sectionId: string | null) {
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [loading, setLoading] = useState(sectionId !== null);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(() => {
    if (sectionId === null) return;
    listSectionSubjects(schoolId, sectionId)
      .then(setAssignments)
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [schoolId, sectionId]);

  useEffect(fetchAssignments, [fetchAssignments]);

  const reload = useCallback(() => {
    if (sectionId === null) return;
    setLoading(true);
    setError(null);
    fetchAssignments();
  }, [sectionId, fetchAssignments]);

  return { assignments, loading, error, reload };
}
