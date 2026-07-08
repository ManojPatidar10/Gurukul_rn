export type FeatureId =
  | 'attendance'
  | 'payments'
  | 'progressCards'
  | 'noticeBoard'
  | 'admissions'
  | 'aiChatbot'
  | 'schedule'
  | 'inventory';

export interface DashboardStat {
  id: string;
  label: string;
  value: string;
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral';
}

export interface FeatureAction {
  id: FeatureId;
  title: string;
  icon: string;
  description: string;
}

export interface AlertItem {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'success';
}

export interface AttendanceSummary {
  present: number;
  absent: number;
  late: number;
  total: number;
  updatedAt: string;
}

export interface ClassAttendance {
  className: string;
  present: number;
  total: number;
}

export interface PaymentSummary {
  collected: number;
  pending: number;
  overdue: number;
  currency: string;
}

export interface ClassCollection {
  className: string;
  collected: number;
  target: number;
}

export interface SubjectPerformance {
  subject: string;
  average: number;
  topClass: string;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  channel: 'parents' | 'teachers';
  createdAt: string;
}

export interface AdmissionStage {
  stage: string;
  count: number;
}

export interface AdmissionApplication {
  id: string;
  name: string;
  grade: string;
  stage: string;
  appliedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

export interface ScheduleEntry {
  period: string;
  time: string;
  className: string;
  teacher: string;
  room: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  threshold: number;
}

export type PrincipalStackParamList = {
  PrincipalDashboard: undefined;
  Attendance: undefined;
  Payments: undefined;
  ProgressCards: undefined;
  NoticeBoard: undefined;
  Admissions: undefined;
  AIChatbot: undefined;
  Schedule: undefined;
  Inventory: undefined;
};
