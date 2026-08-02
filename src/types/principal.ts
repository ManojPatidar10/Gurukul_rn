import type {
  Assessment,
  ClassSection,
  Employee,
  FeeAssessment,
  FeeStructure,
  InfraExpenseRequest,
  PayrollLine,
  Student,
  Vendor,
} from '../api/types';

export type FeatureId =
  | 'students'
  | 'employees'
  | 'vendors'
  | 'fees'
  | 'payroll'
  | 'infraExpenses'
  | 'classes'
  | 'calls'
  | 'gamification'
  | 'houses';

export interface FeatureAction {
  id: FeatureId;
  title: string;
  icon: string;
  description: string;
}

export type PrincipalStackParamList = {
  PrincipalDashboard: undefined;
  Profile: undefined;
  StudentsList: undefined;
  StudentDetail: { student: Student };
  StudentForm: { student?: Student };
  EmployeesList: undefined;
  EmployeeDetail: { employee: Employee };
  EmployeeForm: { employee?: Employee };
  SalaryHistory: { employee: Employee };
  VendorsList: undefined;
  VendorDetail: { vendor: Vendor };
  VendorForm: { vendor?: Vendor };
  FeesHub: undefined;
  FeeCategoriesList: undefined;
  FeeStructuresList: undefined;
  FeeStructureForm: undefined;
  FeeStructureDetail: { feeStructure: FeeStructure };
  FeeAssessmentsList: undefined;
  FeeAssessmentDetail: { assessment: FeeAssessment };
  FeePaymentForm: { assessment: FeeAssessment };
  PayrollHub: undefined;
  SalaryStructuresList: undefined;
  SalaryStructureForm: undefined;
  PayrollRun: undefined;
  PayslipDetail: { payrollLine: PayrollLine };
  InfraExpensesList: undefined;
  InfraExpenseDetail: { request: InfraExpenseRequest };
  InfraExpenseForm: undefined;
  ClassesList: undefined;
  SectionsList: { className: string };
  SectionDetail: { classSection: ClassSection };
  SectionStudentsList: { classSection: ClassSection };
  SectionSubjectsList: { classSection: ClassSection };
  SectionAssessmentsList: { classSection: ClassSection };
  AssessmentForm: { classSection: ClassSection; assessment?: Assessment };
  AssessmentDetail: { assessment: Assessment; classSection: ClassSection };
  AttendanceTake: { classSection: ClassSection };
  AttendanceHistory: { student: Student };
  ConversationsList: undefined;
  NewConversation: undefined;
  ConversationThread: { conversationId: string; title: string };
  HelpdeskBot: undefined;
  VideoCallHub: undefined;
  PickCallTarget: undefined;
  ScheduleCall: undefined;
  ScheduledCalls: undefined;
  CallHistory: undefined;
  InCall: { roomName: string; displayName: string; callLogId?: string; scheduledCallId?: string };
  GamificationHub: undefined;
  Leaderboard: undefined;
  HouseWars: undefined;
  AwardRecognition: undefined;
};
