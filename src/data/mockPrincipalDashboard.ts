import type {
  AdmissionApplication,
  AdmissionStage,
  AlertItem,
  AttendanceSummary,
  ChatMessage,
  ClassAttendance,
  ClassCollection,
  DashboardStat,
  FeatureAction,
  InventoryItem,
  Notice,
  PaymentSummary,
  ScheduleEntry,
  SubjectPerformance,
} from '../types/principal';

export const principalProfile = {
  name: 'Principal Sharma',
  school: 'Digital School',
  branch: 'JSR · JSM · JSR',
};

export const dashboardStats: DashboardStat[] = [
  { id: '1', label: 'Attendance', value: '94%', trend: '+2% vs last week', trendType: 'up' },
  { id: '2', label: 'Fee Collection', value: '₹12.4L', trend: '78% collected', trendType: 'neutral' },
  { id: '3', label: 'Active Students', value: '842', trend: '+18 this month', trendType: 'up' },
  { id: '4', label: 'Faculty Present', value: '48/52', trend: '4 on leave', trendType: 'neutral' },
];

export const featureActions: FeatureAction[] = [
  { id: 'attendance', title: 'Attendance', icon: 'calendar-check', description: 'Live tracking for students and faculty' },
  { id: 'payments', title: 'Payments', icon: 'wallet', description: 'Fee collection and salary processing' },
  { id: 'progressCards', title: 'Progress Cards', icon: 'chart-bar', description: 'Class-wise and subject-wise reports' },
  { id: 'noticeBoard', title: 'Notice Board', icon: 'bullhorn', description: 'Broadcast to parents and teachers' },
  { id: 'admissions', title: 'Admissions', icon: 'user-plus', description: 'End-to-end enrollment workflow' },
  { id: 'students', title: 'Students', icon: 'user-graduate', description: 'Manage student records and class-sections' },
  { id: 'aiChatbot', title: 'AI Chatbot', icon: 'robot', description: 'Natural-language data lookup' },
  { id: 'schedule', title: 'Schedule', icon: 'calendar-alt', description: 'Centralized timetable coordination' },
  { id: 'inventory', title: 'Inventory', icon: 'boxes', description: 'Track supplies and assets' },
];

export const weeklyAttendanceTrend = [88, 91, 93, 94, 92, 90, 94];

export const recentAlerts: AlertItem[] = [
  { id: '1', message: '12 fee reminders sent today', type: 'info' },
  { id: '2', message: '3 admission forms pending review', type: 'warning' },
  { id: '3', message: 'Science lab inventory below threshold', type: 'warning' },
];

export const studentAttendance: AttendanceSummary = {
  present: 792,
  absent: 38,
  late: 12,
  total: 842,
  updatedAt: '2 min ago',
};

export const facultyAttendance: AttendanceSummary = {
  present: 48,
  absent: 3,
  late: 1,
  total: 52,
  updatedAt: '2 min ago',
};

export const classAttendance: ClassAttendance[] = [
  { className: 'Class 10-A', present: 38, total: 42 },
  { className: 'Class 9-B', present: 35, total: 40 },
  { className: 'Class 8-A', present: 41, total: 44 },
  { className: 'Class 7-C', present: 36, total: 38 },
];

export const paymentSummary: PaymentSummary = {
  collected: 1240000,
  pending: 280000,
  overdue: 95000,
  currency: '₹',
};

export const classCollections: ClassCollection[] = [
  { className: 'Class 10', collected: 320000, target: 400000 },
  { className: 'Class 9', collected: 280000, target: 350000 },
  { className: 'Class 8', collected: 250000, target: 320000 },
  { className: 'Class 7', collected: 210000, target: 280000 },
];

export const subjectPerformance: SubjectPerformance[] = [
  { subject: 'Mathematics', average: 76, topClass: '10-A' },
  { subject: 'Science', average: 81, topClass: '9-B' },
  { subject: 'English', average: 74, topClass: '8-A' },
  { subject: 'Social Studies', average: 79, topClass: '10-A' },
];

export const notices: Notice[] = [
  {
    id: '1',
    title: 'Annual Day Rehearsal',
    body: 'All participating students must report by 8:00 AM on Friday.',
    channel: 'parents',
    createdAt: 'Today, 9:30 AM',
  },
  {
    id: '2',
    title: 'Staff Meeting — Curriculum Review',
    body: 'Department heads to meet in Conference Room B at 3:00 PM.',
    channel: 'teachers',
    createdAt: 'Today, 8:00 AM',
  },
  {
    id: '3',
    title: 'Fee Due Date Reminder',
    body: 'Term 2 fees are due by the 15th. Late fee applies after deadline.',
    channel: 'parents',
    createdAt: 'Yesterday',
  },
];

export const admissionStages: AdmissionStage[] = [
  { stage: 'Inquiry', count: 24 },
  { stage: 'Applied', count: 18 },
  { stage: 'Interview', count: 9 },
  { stage: 'Enrolled', count: 6 },
];

export const admissionApplications: AdmissionApplication[] = [
  { id: '1', name: 'Aarav Mehta', grade: 'Class 6', stage: 'Interview', appliedAt: 'Jul 4, 2026' },
  { id: '2', name: 'Priya Singh', grade: 'Class 8', stage: 'Applied', appliedAt: 'Jul 3, 2026' },
  { id: '3', name: 'Rohan Das', grade: 'Class 5', stage: 'Inquiry', appliedAt: 'Jul 2, 2026' },
];

export const suggestedChatQueries = [
  'Show today\'s absent students',
  'Fee collection status for Class 10',
  'Faculty on leave this week',
];

export const initialChatMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'bot',
    text: 'Hello! Ask me about attendance, payments, admissions, or schedules.',
  },
];

export const chatResponses: Record<string, string> = {
  absent: '38 students are absent today. Class 10-A has the highest absence (4 students).',
  fee: 'Class 10 fee collection is at 80% (₹3.2L of ₹4L target). 12 reminders were sent today.',
  faculty: '4 faculty members are on leave today: 2 teachers and 2 support staff.',
  default: 'I found relevant data. Attendance is 94%, fee collection is at 78%, and 3 admissions are pending review.',
};

export const scheduleEntries: ScheduleEntry[] = [
  { period: '1', time: '8:00–8:45', className: '10-A', teacher: 'Mrs. Gupta', room: '201' },
  { period: '2', time: '8:45–9:30', className: '9-B', teacher: 'Mr. Verma', room: '105' },
  { period: '3', time: '9:45–10:30', className: '8-A', teacher: 'Ms. Reddy', room: '302' },
  { period: '4', time: '10:30–11:15', className: '7-C', teacher: 'Mr. Khan', room: '108' },
];

export const inventoryItems: InventoryItem[] = [
  { id: '1', name: 'A4 Paper Reams', category: 'Stationery', quantity: 12, threshold: 20 },
  { id: '2', name: 'Science Lab Beakers', category: 'Lab', quantity: 45, threshold: 30 },
  { id: '3', name: 'Whiteboard Markers', category: 'Stationery', quantity: 8, threshold: 15 },
  { id: '4', name: 'Sports Footballs', category: 'Sports', quantity: 22, threshold: 10 },
];

export function formatCurrency(amount: number, currency: string): string {
  if (amount >= 100000) {
    return `${currency}${(amount / 100000).toFixed(1)}L`;
  }
  return `${currency}${amount.toLocaleString('en-IN')}`;
}
