import { Platform } from 'react-native';
import { School } from './data';

declare const process: {
  env: Record<string, string | undefined>;
};

const DEMO_SCHOOL_ID = '11111111-1111-1111-1111-111111111111';

const defaultBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8080',
  default: 'http://localhost:8080',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? defaultBaseUrl;

type ApiResponse<T> = {
  success: boolean;
  data: T | null;
  message: string | null;
};

export type SchoolRegistrationPayload = {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  principalName: string;
  directorName: string;
};

export type SchoolResponse = SchoolRegistrationPayload & {
  id: string;
  studentCount: number;
  classSectionCount: number;
  teacherCount: number;
  createdAt: string;
  updatedAt: string;
};

type ApiRequestOptions = RequestInit & {
  schoolId?: string;
};

export type TeacherStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export type TeacherPayload = {
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  status?: TeacherStatus;
};

export type TeacherAssignmentResponse = {
  id: string;
  classSectionId: string;
  className: string;
  section: string;
  academicYear: string;
  subjectName: string;
  assignmentRole: string;
};

export type TeacherResponse = TeacherPayload & {
  id: string;
  schoolId: string;
  status: TeacherStatus;
  assignmentCount: number;
  assignments: TeacherAssignmentResponse[];
  createdAt: string;
  updatedAt: string;
};

export type TeacherFeatureResponse = {
  feature: string;
  title: string;
  description: string;
  available: boolean;
};

export type TeacherDashboardResponse = {
  schoolId: string;
  totalTeachers: number;
  activeTeachers: number;
  classTeacherAssignments: number;
  subjectTeacherAssignments: number;
  assignedClassSections: number;
  features: TeacherFeatureResponse[];
};

export type ClassSectionResponse = {
  id: string;
  schoolId: string;
  className: string;
  section: string;
  academicYear: string;
  displayLabel: string;
};

export type StudentResponse = {
  id: string;
  schoolId: string;
  rollNumber: string;
  name: string;
  classSectionId: string;
  classSectionLabel: string;
  status: string;
};

export type TeacherAssignmentPayload = {
  classSectionId: string;
  subjectName: string;
  assignmentRole: 'SUBJECT_TEACHER' | 'CLASS_TEACHER';
};

export type TeacherResourcePayload = {
  classSectionId: string;
  subjectName: string;
  resourceType: 'BOOK' | 'NOTES' | 'WORKSHEET' | 'PRESENTATION' | 'VIDEO' | 'LINK' | 'OTHER';
  title: string;
  description: string;
  resourceUrl: string;
  availableOffline: boolean;
};

export type TeacherResourceResponse = TeacherResourcePayload & {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionLabel: string;
  createdAt: string;
  updatedAt: string;
};

export type TeacherSchedulePayload = {
  classSectionId: string;
  subjectName: string;
  assessmentType: 'QUIZ' | 'TEST' | 'EXAM' | 'ASSIGNMENT_CHECK';
  title: string;
  scheduledAt: string;
  syllabus: string;
  instructions: string;
  maxMarks: number;
  status?: 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
};

export type TeacherScheduleResponse = TeacherSchedulePayload & {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionLabel: string;
  status: 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
};

export type AiQuizPayload = {
  classSectionId: string;
  subjectName: string;
  assessmentType: 'QUIZ' | 'TEST' | 'EXAM' | 'ASSIGNMENT_CHECK';
  title: string;
  syllabus: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
  questionCount: number;
  maxMarks: number;
  questionTypes: ('MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'TRUE_FALSE')[];
  additionalInstructions?: string;
};

export type GeneratedQuizQuestionResponse = {
  number: number;
  questionType: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
};

export type AiQuizResponse = AiQuizPayload & {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionLabel: string;
  generatorMode: string;
  reviewNote: string;
  questions: GeneratedQuizQuestionResponse[];
};

export type AttendancePayload = {
  classSectionId: string;
  attendanceDate: string;
  sessionName: string;
  entries: {
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    remarks?: string;
  }[];
};

export type AttendanceSummaryResponse = {
  classSectionLabel: string;
  teacherName: string;
  attendanceDate: string;
  sessionName: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  records: {
    id: string;
    studentName: string;
    rollNumber: string;
    status: string;
    remarks: string;
  }[];
};

async function request<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  let response: Response;
  const { schoolId, ...fetchOptions } = options ?? {};

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(schoolId ? { 'X-School-Id': schoolId } : {}),
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });
  } catch {
    throw new Error(
      `Cannot reach backend at ${API_BASE_URL}. Start the backend, then try again.`,
    );
  }

  const body = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !body.success || !body.data) {
    throw new Error(body.message ?? `Request failed with status ${response.status}`);
  }

  return body.data;
}

export function toAppSchool(school: SchoolResponse): School {
  return {
    id: school.id,
    name: school.name,
    city: school.city,
    state: school.state,
    email: school.contactEmail,
    phone: school.contactPhone,
    address: school.address,
    status: 'Active',
    students: school.studentCount,
    teachers: school.teacherCount,
  };
}

export function getDemoSchool() {
  return getSchool(DEMO_SCHOOL_ID);
}

export function getSchool(id: string) {
  return request<SchoolResponse>(`/api/v1/schools/${id}`);
}

export function registerSchool(payload: SchoolRegistrationPayload) {
  return request<SchoolResponse>('/api/v1/schools', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function listTeachers(schoolId: string) {
  return request<TeacherResponse[]>('/api/v1/teachers', { schoolId });
}

export function getTeacher(schoolId: string, teacherId: string) {
  return request<TeacherResponse>(`/api/v1/teachers/${teacherId}`, { schoolId });
}

export function getTeacherDashboard(schoolId: string) {
  return request<TeacherDashboardResponse>('/api/v1/teachers/dashboard', { schoolId });
}

export function createTeacher(schoolId: string, payload: TeacherPayload) {
  return request<TeacherResponse>('/api/v1/teachers', {
    method: 'POST',
    schoolId,
    body: JSON.stringify(payload),
  });
}

export function listClassSections(schoolId: string) {
  return request<ClassSectionResponse[]>('/api/v1/class-sections', { schoolId });
}

export function listStudentsByClassSection(schoolId: string, classSectionId: string) {
  return request<StudentResponse[]>(`/api/v1/class-sections/${classSectionId}/students`, { schoolId });
}

export function assignTeacher(schoolId: string, teacherId: string, payload: TeacherAssignmentPayload) {
  return request<TeacherAssignmentResponse>(`/api/v1/teachers/${teacherId}/assignments`, {
    method: 'PATCH',
    schoolId,
    body: JSON.stringify(payload),
  });
}

export function listTeacherResources(schoolId: string, teacherId: string) {
  return request<TeacherResourceResponse[]>(`/api/v1/teachers/${teacherId}/resources`, { schoolId });
}

export function createTeacherResource(schoolId: string, teacherId: string, payload: TeacherResourcePayload) {
  return request<TeacherResourceResponse>(`/api/v1/teachers/${teacherId}/resources`, {
    method: 'POST',
    schoolId,
    body: JSON.stringify(payload),
  });
}

export function listTeacherSchedules(schoolId: string, teacherId: string) {
  return request<TeacherScheduleResponse[]>(`/api/v1/teachers/${teacherId}/assessment-schedules`, { schoolId });
}

export function createTeacherSchedule(schoolId: string, teacherId: string, payload: TeacherSchedulePayload) {
  return request<TeacherScheduleResponse>(`/api/v1/teachers/${teacherId}/assessment-schedules`, {
    method: 'POST',
    schoolId,
    body: JSON.stringify(payload),
  });
}

export function generateTeacherQuiz(schoolId: string, teacherId: string, payload: AiQuizPayload) {
  return request<AiQuizResponse>(`/api/v1/teachers/${teacherId}/ai/quiz-generator`, {
    method: 'POST',
    schoolId,
    body: JSON.stringify(payload),
  });
}

export function markTeacherAttendance(schoolId: string, teacherId: string, payload: AttendancePayload) {
  return request<AttendanceSummaryResponse>(`/api/v1/teachers/${teacherId}/attendance`, {
    method: 'POST',
    schoolId,
    body: JSON.stringify(payload),
  });
}
