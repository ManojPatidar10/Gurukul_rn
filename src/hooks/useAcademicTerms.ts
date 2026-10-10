import { useCallback, useEffect, useState } from 'react';

import { listAcademicTerms } from '../api/academicTerms';
import { getErrorMessage } from '../api/errorMessage';
import type { AcademicTerm } from '../api/types';
import { isTermListMissing, sortTerms } from '../utils/academicTerms';

/**
 * The school's term list, in the server's order. `configured` is true once the school has at least
 * one term: assessments must then pick from the list. An older server has no term list and answers
 * 404, which means "not configured" with no error. Any other failure sets `error` (offer `reload`),
 * and screens then fall back to how they worked before the list existed. Pass `enabled: false` to
 * skip the request.
 */
export function useAcademicTerms(schoolId: string, enabled = true) {
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const fetchTerms = useCallback(() => {
    if (!enabled) return;
    listAcademicTerms(schoolId)
      .then((rows) => {
        setTerms(sortTerms(rows));
        setError(null);
      })
      .catch((e) => {
        setTerms([]);
        setError(isTermListMissing(e) ? null : getErrorMessage(e));
      })
      .finally(() => setLoading(false));
  }, [schoolId, enabled]);

  useEffect(fetchTerms, [fetchTerms]);

  const reload = useCallback(() => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    fetchTerms();
  }, [enabled, fetchTerms]);

  return { terms, configured: terms.length > 0, loading, error, reload };
}
