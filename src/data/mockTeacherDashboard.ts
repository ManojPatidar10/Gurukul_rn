import {
  TeacherProfile,
  NextClass,
  TeacherFeatureAction,
  StudentAttendanceRecord,
  TeacherScheduleItem
} from '../types/teacher';

export const teacherProfile: TeacherProfile = {
  name: 'Mrs. Sharma',
  id: 'T-1024',
  classTeacherOf: '10-A',
  school: 'Gurukul International School'
};

export const nextClass: NextClass = {
  subject: 'Mathematics',
  className: '10-B',
  time: '11:30 AM',
  countdown: '15 mins'
};

export const teacherFeatures: TeacherFeatureAction[] = [
  { id: 'attendance', title: 'Mark Attendance', icon: 'clipboard-list', color: '#4A90E2' },
  { id: 'quiz', title: 'Quiz Assistant', icon: 'magic', color: '#50E3C2' },
  { id: 'schedule', title: 'My Schedule', icon: 'calendar-alt', color: '#9B59B6' },
  { id: 'library', title: 'Digital Library', icon: 'book-open', color: '#F39C12' },
];

export const mockStudents: StudentAttendanceRecord[] = [
  { id: '1', name: 'Aarav Mehta', rollNo: '101', status: 'none' },
  { id: '2', name: 'Isha Gupta', rollNo: '102', status: 'none' },
  { id: '3', name: 'Kabir Singh', rollNo: '103', status: 'none' },
  { id: '4', name: 'Myra Reddy', rollNo: '104', status: 'none' },
  { id: '5', name: 'Rohan Verma', rollNo: '105', status: 'none' },
];

export const teacherSchedule: TeacherScheduleItem[] = [
  { id: '1', subject: 'Mathematics', time: '08:30 AM', duration: '45m', room: '101' },
  { id: '2', subject: 'Physics', time: '09:30 AM', duration: '45m', room: 'Lab A' },
  { id: '3', subject: 'Break', time: '10:15 AM', duration: '30m', room: 'Staff Room' },
  { id: '4', subject: 'Mathematics', time: '11:00 AM', duration: '45m', room: '102' },
];

export const quizPrompts = [
  'Generate Quiz for Chapter 5',
  'Create Lesson Plan for Algebra',
  'Summarize Faculty Meeting',
  'Draft Homework for 10-A'
];
