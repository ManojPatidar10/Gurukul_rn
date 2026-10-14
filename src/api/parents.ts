import { api } from './client';
import type { LinkChildRequest, Student } from './types';

export function getMyChildren(schoolId: string) {
  return api.get<Student[]>('/api/v1/parents/me/children', schoolId);
}

/**
 * Links another child to the signed-in parent by registration number. The child's record must
 * carry this parent's phone as its parent contact. Resolves to the linked child (the same
 * non-admin view as getMyChildren), or null from a backend from before the link returned it.
 * Refusals carry an errorCode (LINK_CHILD_*) that getErrorMessage words in the app's language.
 */
export function linkChild(schoolId: string, req: LinkChildRequest) {
  return api.post<Student | null>('/api/v1/parents/me/children', req, schoolId);
}
