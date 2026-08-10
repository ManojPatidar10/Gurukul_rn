import type {
  Assessment,
  ClassSection,
  Employee,
  FeeAssessment,
  FeePayment,
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
  | 'myClassSection'
  | 'calls'
  | 'gamification'
  | 'houses'
  | 'arena'
  | 'events'
  | 'academicHelper'
  | 'teacherTools'
  | 'reportCard'
  | 'gradingScale'
  | 'markMyAttendance'
  | 'staffAttendance'
  | 'myAttendance'
  | 'registrationInbox';

export interface FeatureAction {
  id: FeatureId;
  title: string;
  icon: string;
  description: string;
}

export type PrincipalStackParamList = {
  PrincipalDashboard: undefined;
  Profile: undefined;
  GlobalSearch: undefined;
  StudentsList: undefined;
  Classmates: undefined;
  MyStudents: undefined;
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
  MyFees: undefined;
  FeeAssessmentDetail: { assessment: FeeAssessment };
  PayFees: { assessment: FeeAssessment };
  FeePaymentSettings: undefined;
  PaymentReceipt: { payment: FeePayment };
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
  AssessmentResults: { assessment: Assessment };
  AttendanceTake: { classSection: ClassSection };
  AttendanceHistory: { student: Pick<Student, 'id' | 'name'> };
  RegistrationInbox: undefined;
  ParentHome: undefined;
  ChildDashboard: { student: Pick<Student, 'id' | 'name'> };
  ChildFees: { student: Pick<Student, 'id' | 'name'> };
  ReportCard: { student: Pick<Student, 'id' | 'name'>; defaultTerm?: string };
  PublishReportCards: { classSection: ClassSection };
  GradingScale: undefined;
  MarkMyAttendance: undefined;
  SchoolLocationSettings: undefined;
  StaffAttendance: undefined;
  EmployeeAttendanceHistory: { employee: Pick<Employee, 'id' | 'name'> };
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
  Arena: undefined;
  NewChallenge: undefined;
  ChallengeDetail: { challengeId: string };
  QuestionAuthor: undefined;
  MyQuestions: undefined;
  BattleRoomMatch: undefined;
  BattleRoom: { roomId: string };
  PracticeStart: undefined;
  PracticeSession: { sessionId: string };
  EventsList: undefined;
  EventDetail: { eventId: string };
  EventForm: undefined;
  AcademicHelper: undefined;
  StudentPerformance: { student: Student };
  TeacherPerformance: { employee: Employee };
  TeacherToolsHub: undefined;
  ResourceGenerator: { teacherId: string; teacherName: string; classSectionId: string; classSectionLabel: string };
  ResourceUpload: { teacherId: string; teacherName: string; classSectionId: string; classSectionLabel: string };
};
