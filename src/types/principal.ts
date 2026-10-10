import type {
  Admission,
  Assessment,
  CallProvider,
  ClassSection,
  Employee,
  FeeAssessment,
  FeePayment,
  FeeStructure,
  GeneratedQuizQuestion,
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
  | 'houses'
  | 'events'
  | 'academicHelper'
  | 'teacherTools'
  | 'reportCard'
  | 'gradingScale'
  | 'markMyAttendance'
  | 'staffAttendance'
  | 'myAttendance'
  | 'registrationInbox'
  | 'attendanceDevices'
  | 'activityLog'
  | 'attendanceExport'
  | 'admissions'
  | 'idCards'
  | 'myTimetable'
  | 'timetableEditor'
  | 'bellSchedule'
  | 'schoolLocation'
  | 'attendance'
  | 'vendorsExpenses'
  | 'academics'
  | 'reports'
  | 'arena'
  | 'aiQuizGenerator'
  | 'transport'
  | 'schoolBus'
  | 'holidays';

/** A group of admin screens behind one dashboard tile - see SectionHubScreen. */
export type HubSection = 'students' | 'attendance' | 'vendorsExpenses' | 'academics' | 'reports';

export interface FeatureAction {
  id: FeatureId;
  title: string;
  icon: string;
  description: string;
}

export type PrincipalStackParamList = {
  /** School bus: a family's live view, the admin hub and trip detail, and the driver's screens. */
  MyBus: undefined;
  Holidays: undefined;
  TransportHub: undefined;
  BusTripDetail: { tripId: string };
  DriverHome: undefined;
  DriverTrip: { tripId: string };
  DriverPastTrips: undefined;
  PrincipalDashboard: undefined;
  Profile: undefined;
  PushDebug: undefined;
  SwitchChild: undefined;
  ConnectGoogleAccount: undefined;
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
  PayrollOverview: undefined;
  MyClassFees: { classSection: ClassSection };
  InfraExpensesList: undefined;
  InfraExpenseDetail: { request: InfraExpenseRequest };
  InfraExpenseForm: undefined;
  /** `homeroom`: a class teacher's own section, pinned above the class list. */
  ClassesList: { homeroom?: ClassSection } | undefined;
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
  SectionReportCardsGrid: { classSection: ClassSection };
  GradingScale: undefined;
  MarkMyAttendance: undefined;
  SchoolLocationSettings: undefined;
  StaffAttendance: undefined;
  EmployeeAttendanceHistory: { employee: Pick<Employee, 'id' | 'name'> };
  AttendanceDevices: undefined;
  ActivityLog: undefined;
  AttendanceExport: undefined;
  SchoolLogoSettings: undefined;
  /** `mode: 'edit'` shows only the details form (opened from Profile's Edit button). */
  IdCard: { kind: 'STUDENT' | 'EMPLOYEE'; id: string; name: string; mode?: 'edit' };
  IdCardSheets: undefined;
  ConversationsList: undefined;
  NewConversation: undefined;
  ConversationThread: { conversationId: string; title: string };
  Announcements: undefined;
  Notifications: undefined;
  HelpdeskBot: undefined;
  VideoCallHub: undefined;
  PickCallTarget: undefined;
  ScheduleCall: undefined;
  ScheduledCalls: undefined;
  CallHistory: undefined;
  InCall: { roomName: string; provider: CallProvider; displayName: string; callLogId?: string; scheduledCallId?: string };
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
  SectionHub: { section: HubSection };
  // Undefined = a teacher generating for themselves (from their dashboard tile); set = a principal
  // acting for a teacher from the Teacher Tools hub.
  ResourceGenerator: { teacherId: string; teacherName: string; classSectionId: string; classSectionLabel: string } | undefined;
  // storedDraft: the stored AI draft the questions came from (its key + savedAt), to record them as saved on it.
  QuizBankReview: {
    subjectId: string;
    subjectName: string;
    className: string;
    questions: GeneratedQuizQuestion[];
    storedDraft?: { key: string; savedAt: string };
  };
  NewAdmission: { admission?: Admission } | undefined;
  AdmissionsList: undefined;
  AdmissionDetail: { admissionId: string };
  ResourceUpload: { teacherId: string; teacherName: string; classSectionId: string; classSectionLabel: string };
  /** No params: the caller's own timetable. classSection: that section's. student: a parent's child. */
  MyTimetable: { classSection?: ClassSection; student?: Pick<Student, 'id' | 'name'> } | undefined;
  TimetableEditor: { classSection?: ClassSection } | undefined;
  PeriodSetup: undefined;
};
