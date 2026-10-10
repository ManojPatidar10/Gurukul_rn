import { api } from './client';
import type { AcademicTerm, AcademicTermRequest, UnlistedTerm } from './types';

const BASE = '/api/v1/academic-terms';

/**
 * The school's term list. An older server has no such endpoint and answers 404, which means "no
 * terms set up" - see hooks/useAcademicTerms.
 */
export function listAcademicTerms(schoolId: string) {
  return api.get<AcademicTerm[]>(BASE, schoolId);
}

export function createAcademicTerm(schoolId: string, req: AcademicTermRequest) {
  return api.post<AcademicTerm>(BASE, req, schoolId);
}

/** A full replace: a null date or academic year clears it. */
export function updateAcademicTerm(schoolId: string, id: string, req: AcademicTermRequest) {
  return api.put<AcademicTerm>(`${BASE}/${id}`, req, schoolId);
}

/** 409 TERM_IN_USE while assessments or publications use it. */
export function deleteAcademicTerm(schoolId: string, id: string) {
  return api.delete<null>(`${BASE}/${id}`, schoolId);
}

/** Terms the school's assessments already use that aren't on the list (admin only). */
export function listUnlistedTerms(schoolId: string) {
  return api.get<UnlistedTerm[]>(`${BASE}/unlisted`, schoolId);
}

/** Adds every unlisted term as an undated term, and returns the full list (admin only). */
export function importUnlistedTerms(schoolId: string) {
  return api.post<AcademicTerm[]>(`${BASE}/import-unlisted`, undefined, schoolId);
}
