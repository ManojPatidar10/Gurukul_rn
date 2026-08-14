import { api } from './client';
import type { PagedResponse, Student, StudentRequest, StudentClassSectionUpdateRequest } from './types';

export function listStudents(schoolId: string, page = 0, size = 50) {
  return api.get<PagedResponse<Student>>(`/api/v1/students?page=${page}&size=${size}`, schoolId);
}

// For consumers that need the full roster (pickers, name lookups, filtering) rather than one page.
export async function listAllStudents(schoolId: string): Promise<Student[]> {
  const all: Student[] = [];
  let page = 0;
  for (;;) {
    const res = await listStudents(schoolId, page, 200);
    all.push(...res.content);
    if (!res.hasNext) break;
    page += 1;
  }
  return all;
}

export function getStudent(schoolId: string, id: string) {
  return api.get<Student>(`/api/v1/students/${id}`, schoolId);
}

export function createStudent(schoolId: string, req: StudentRequest) {
  return api.post<Student>('/api/v1/students', req, schoolId);
}

export function updateStudent(schoolId: string, id: string, req: StudentRequest) {
  return api.put<Student>(`/api/v1/students/${id}`, req, schoolId);
}

export function deleteStudent(schoolId: string, id: string) {
  return api.delete<void>(`/api/v1/students/${id}`, schoolId);
}

export function transferStudentClassSection(
  schoolId: string,
  id: string,
  req: StudentClassSectionUpdateRequest
) {
  return api.patch<Student>(`/api/v1/students/${id}/class-section`, req, schoolId);
}

export function listStudentsByClassSection(
  schoolId: string,
  params: { className: string; section: string; academicYear: string }
) {
  const query = new URLSearchParams(params).toString();
  return api.get<Student[]>(`/api/v1/students/by-class-section?${query}`, schoolId);
}

export function searchStudents(schoolId: string, q: string) {
  return api.get<Student[]>(`/api/v1/students/search?${new URLSearchParams({ q }).toString()}`, schoolId);
}

export function searchParents(schoolId: string, q: string) {
  return api.get<Student[]>(
    `/api/v1/students/search-parents?${new URLSearchParams({ q }).toString()}`,
    schoolId
  );
}
