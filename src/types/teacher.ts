export type TeacherFeatureId = 'attendance' | 'quiz' | 'schedule' | 'library';

export interface TeacherProfile {
  name: string;
  id: string;
  classTeacherOf: string;
  school: string;
}

export interface NextClass {
  subject: string;
  className: string;
  time: string;
  countdown: string;
}

export interface TeacherFeatureAction {
  id: TeacherFeatureId;
  title: string;
  icon: string;
  color: string;
}

export interface StudentAttendanceRecord {
  id: string;
  name: string;
  rollNo: string;
  status: 'present' | 'absent' | 'late' | 'none';
}

export interface TeacherScheduleItem {
  id: string;
  subject: string;
  time: string;
  duration: string;
  room: string;
}

export interface TeacherStackParamList {
  TeacherDashboard: undefined;
  StudentAttendance: { className: string; section: string };
  QuizAssistant: undefined;
  TeacherSchedule: undefined;
  DigitalLibrary: undefined;
}
