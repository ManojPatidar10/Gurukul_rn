export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
}

export interface School {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  principalName: string;
  directorName: string;
  studentCount: number;
  classSectionCount: number;
  teacherCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolRegistrationRequest {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  principalName: string;
  principalPhone: string;
  directorName: string;
  adminPhone: string;
  adminUsername?: string;
  adminPassword?: string;
}

export interface SchoolUpdateRequest {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactEmail: string;
  contactPhone: string;
  principalName: string;
  directorName: string;
}

export interface SchoolSearchResult {
  id: string;
  name: string;
  city: string;
  state: string;
}

export interface SchoolRegistrationResponse {
  school: School;
  admin: LoginResponse;
}

export interface ClassSection {
  id: string;
  schoolId: string;
  className: string;
  section: string;
  academicYear: string;
  displayLabel: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
}

export interface ClassSectionRequest {
  className: string;
  section: string;
  academicYear: string;
}

export interface Student {
  id: string;
  schoolId: string;
  rollNumber: string;
  name: string;
  dob: string;
  gender: string;
  address: string;
  parentName: string;
  parentContact: string;
  classSectionId: string;
  className: string;
  section: string;
  academicYear: string;
  classSectionLabel: string;
  classTeacherId: string | null;
  classTeacherName: string | null;
  admissionDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentRequest {
  rollNumber: string;
  name: string;
  dob: string;
  gender: string;
  address: string;
  parentName: string;
  parentContact: string;
  classSectionId: string;
  admissionDate: string;
  status?: string;
}

export interface StudentClassSectionUpdateRequest {
  classSectionId: string;
}

export interface Employee {
  id: string;
  schoolId: string;
  name: string;
  designation: string;
  joinDate: string;
  bankAccount: string;
  contactPhone: string;
  status: string;
  role: UserRole | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRequest {
  name: string;
  designation: string;
  joinDate: string;
  bankAccount?: string;
  contactPhone?: string;
  status?: string;
}

export interface Vendor {
  id: string;
  schoolId: string;
  name: string;
  contactPhone: string;
  contactEmail: string;
  bankAccount: string;
  upiId: string;
  address: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorRequest {
  name: string;
  contactPhone?: string;
  contactEmail?: string;
  bankAccount?: string;
  upiId?: string;
  address?: string;
}

export interface FeeCategory {
  id: string;
  schoolId: string;
  code: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeeCategoryRequest {
  code: string;
  name: string;
}

export interface FeeStructureLine {
  id: string;
  feeCategoryId: string;
  feeCategoryCode: string;
  feeCategoryName: string;
  amount: number;
}

export interface FeeStructureLineRequest {
  feeCategoryId: string;
  amount: number;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  classSectionId: string;
  className: string;
  section: string;
  academicYear: string;
  lines: FeeStructureLine[];
  createdAt: string;
  updatedAt: string;
}

export interface FeeStructureRequest {
  classSectionId: string;
  academicYear: string;
  lines: FeeStructureLineRequest[];
}

export interface FeeAssessment {
  id: string;
  schoolId: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  academicYear: string;
  totalDue: number;
  totalPaid: number;
  remainingDue: number;
  status: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeePaymentRequest {
  assessmentId: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  transactionDate?: string;
}

export interface FeePayment {
  id: string;
  schoolId: string;
  assessmentId: string;
  studentId: string;
  amount: number;
  transactionId: string;
  receiptNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface DuesReport {
  overdueAssessments: FeeAssessment[];
  totalOverdue: number;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  employeeName: string;
  basic: number;
  allowances: number;
  deductions: number;
  effectiveFrom: string;
}

export interface SalaryStructureRequest {
  employeeId: string;
  basic: number;
  allowances: number;
  deductions: number;
  effectiveFrom: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
}

export interface PayrollRunRequest {
  month: number;
  year: number;
}

export interface PayrollPayRequest {
  paymentMethod: string;
  paymentReference?: string;
  transactionDate?: string;
}

export interface PayrollLine {
  id: string;
  employeeId: string;
  employeeName: string;
  gross: number;
  deductions: number;
  net: number;
}

export interface Payslip {
  payrollLineId: string;
  employeeId: string;
  employeeName: string;
  net: number;
  documentRef: string;
}

export interface SalaryHistoryEntry {
  payrollLineId: string;
  month: number;
  year: number;
  net: number;
  runStatus: string;
}

export interface InfraExpenseCategory {
  id: string;
  code: string;
  name: string;
}

export interface InfraExpenseRequest {
  id: string;
  categoryId: string;
  categoryCode: string;
  description: string;
  estimatedAmount: number;
  status: string;
}

export interface InfraExpenseRequestCreate {
  categoryId: string;
  description: string;
  estimatedAmount: number;
}

export interface ApprovalActionRequest {
  actor?: string;
  comment?: string;
}

export interface InfraPurchaseRequest {
  vendorId: string;
  invoiceNumber: string;
  actualAmount: number;
}

export interface InfraPayRequest {
  paymentMethod: string;
  paymentReference?: string;
  transactionDate?: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  description: string;
}

export interface SubjectRequest {
  code: string;
  name: string;
  description?: string;
}

export interface SubjectAssignment {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  teacherId: string;
  teacherName: string;
}

export interface SectionSubjectRequest {
  subjectId: string;
  teacherId: string;
}

export type AssessmentType = 'ASSIGNMENT' | 'QUIZ' | 'TEST' | 'EXAM';

export interface Assessment {
  id: string;
  schoolId: string;
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  type: AssessmentType;
  title: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  assessmentDate: string;
  maxMarks: number;
  description: string;
  createdByTeacherId: string;
  createdByTeacherName: string;
}

export interface AssessmentRequest {
  title: string;
  type: AssessmentType;
  subjectId: string;
  assessmentDate: string;
  maxMarks: number;
  description?: string;
  teacherId: string;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

export interface AttendanceEntryRequest {
  studentId: string;
  status: AttendanceStatus;
  remarks?: string;
}

export interface BulkAttendanceRequest {
  date: string;
  teacherId: string;
  records: AttendanceEntryRequest[];
}

export interface StudentAttendanceEntry {
  studentId: string;
  rollNumber: string;
  studentName: string;
  status: AttendanceStatus;
  remarks: string;
}

export interface SectionAttendance {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  date: string;
  entries: StudentAttendanceEntry[];
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  sectionId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  markedByTeacherId: string;
  markedByTeacherName: string;
  remarks: string;
}

export interface StudentAttendanceHistory {
  studentId: string;
  studentName: string;
  rollNumber: string;
  from: string;
  to: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  records: AttendanceRecord[];
}

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';
export type OwnerType = 'EMPLOYEE' | 'STUDENT';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  ownerType: OwnerType;
  ownerId: string;
  role: UserRole;
  schoolId: string;
  username: string;
}

export interface OtpRequest {
  phone: string;
}

export interface OtpVerifyRequest {
  phone: string;
  otp: string;
}

export interface CredentialRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface Credential {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  username: string;
  role: UserRole;
}

export type ConversationType = 'DIRECT' | 'BOT';

export interface ConversationParticipant {
  ownerType: OwnerType;
  ownerId: string;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  participants: ConversationParticipant[];
}

export interface CreateConversationRequest {
  otherPartyOwnerType: OwnerType;
  otherPartyOwnerId: string;
}

export type SenderKind = 'USER' | 'BOT';

export interface Message {
  id: string;
  senderKind: SenderKind;
  senderOwnerType: OwnerType | null;
  senderOwnerId: string | null;
  content: string;
  sentAt: string;
}

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
}

export type AnnouncementScope = 'SCHOOL' | 'CLASS' | 'GRADE';

export interface Announcement {
  id: string;
  scope: AnnouncementScope;
  sectionId: string | null;
  className: string | null;
  title: string;
  body: string;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  scope: AnnouncementScope;
  sectionId?: string;
  className?: string;
  title: string;
  body: string;
}

export interface GameProfileResponse {
  totalXp: number;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export type LeagueTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' | 'GURUKUL_MASTER';

export interface LeaderboardEntryResponse {
  rank: number;
  studentId: string;
  name: string;
  weeklyXp: number;
  isYou: boolean;
}

export interface LeaderboardResponse {
  tier: LeagueTier;
  classSectionLabel: string;
  entries: LeaderboardEntryResponse[];
  yourRank: number;
  currentStreakDays: number;
  longestStreakDays: number;
}

export interface HouseResponse {
  id: string;
  name: string;
  colorHex: string;
}

export interface CreateHouseRequest {
  name: string;
  colorHex: string;
}

export interface AwardSpotRecognitionRequest {
  studentId: string;
  amount: number;
  reason: string;
}

export interface HouseStandingResponse {
  houseId: string;
  name: string;
  colorHex: string;
  totalPoints: number;
  memberCount: number;
}

export interface SpotRecognitionFeedItem {
  studentName: string;
  houseName: string;
  amount: number;
  reason: string;
  occurredAt: string;
}

export interface HouseWarsResponse {
  standings: HouseStandingResponse[];
  recentFeed: SpotRecognitionFeedItem[];
  yourHouseId: string | null;
}

export type QuizOption = 'A' | 'B' | 'C' | 'D';
export type ChallengeStatus = 'ACTIVE' | 'COMPLETED' | 'EXPIRED';

export interface CreateQuizQuestionRequest {
  subjectId: string;
  className: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: QuizOption;
}

export interface QuizQuestionResponse {
  id: string;
  className: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: QuizOption;
}

export interface PublicQuizQuestionResponse {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface CreateChallengeRequest {
  opponentStudentId: string;
  subjectId: string;
}

export interface SubmitAnswerRequest {
  questionId: string;
  selectedOption: QuizOption;
}

export interface SubmitAnswerResponse {
  correct: boolean;
  challengeCompleted: boolean;
}

export interface ChallengeSummaryResponse {
  id: string;
  subjectName: string;
  opponentName: string;
  status: ChallengeStatus;
  totalQuestions: number;
  myAnsweredCount: number;
  opponentAnsweredCount: number;
  youWon: boolean | null;
  draw: boolean;
}

export interface ChallengeDetailResponse {
  summary: ChallengeSummaryResponse;
  questions: PublicQuizQuestionResponse[];
  myAnsweredQuestionIds: string[];
}

export type PracticeSessionStatus = 'ACTIVE' | 'COMPLETED';

export interface CreatePracticeSessionRequest {
  subjectId: string;
}

export interface PracticeSessionResponse {
  id: string;
  subjectName: string;
  status: PracticeSessionStatus;
  totalQuestions: number;
  answeredCount: number;
  correctCount: number;
  questions: PublicQuizQuestionResponse[];
  myAnsweredQuestionIds: string[];
}

export interface SubmitPracticeAnswerRequest {
  questionId: string;
  selectedOption: QuizOption;
}

export interface SubmitPracticeAnswerResponse {
  correct: boolean;
  sessionCompleted: boolean;
}

export type BattleRoomStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface BattleRoomParticipant {
  studentId: string;
  name: string;
  correctCount: number;
}

export interface BattleRoomQuestion {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

export interface BattleRoomState {
  id: string;
  roomCode: string;
  className: string;
  subjectName: string;
  status: BattleRoomStatus;
  minPlayers: number;
  maxPlayers: number;
  joinWindowSeconds: number;
  joinWindowEndsAt: string;
  questionCount: number;
  currentQuestionIndex: number;
  participants: BattleRoomParticipant[];
  currentQuestion: BattleRoomQuestion | null;
  currentBuzzWinnerStudentId: string | null;
  lastAnswerCorrect: boolean | null;
  winnerStudentId: string | null;
  winnerName: string | null;
}

export interface BattleRoomSummary {
  id: string;
  roomCode: string;
  subjectName: string;
  className: string;
  status: 'WAITING' | 'ACTIVE';
  participantCount: number;
  maxPlayers: number;
}

export interface CreateBattleRoomRequest {
  subjectId: string;
}

export interface SubmitBattleAnswerRequest {
  selectedOption: QuizOption;
}

export type CallStatus = 'SCHEDULED' | 'STARTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
export type RsvpStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
export type CallOutcome = 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'DECLINED' | 'BUSY' | 'CANCELLED';

export interface ScheduleCallRequest {
  title: string;
  inviteeOwnerType: OwnerType;
  inviteeOwnerIds: string[];
  scheduledAt: string;
}

export interface RsvpRequest {
  status: RsvpStatus;
}

export interface StartImmediateCallRequest {
  calleeOwnerType: OwnerType;
  calleeOwnerId: string;
}

export interface CallInviteeResponse {
  ownerType: OwnerType;
  ownerId: string;
  rsvpStatus: RsvpStatus;
}

export interface ScheduledCallResponse {
  id: string;
  title: string;
  hostOwnerType: OwnerType;
  hostOwnerId: string;
  scheduledAt: string;
  roomName: string;
  status: CallStatus;
  invitees: CallInviteeResponse[];
}

export interface MyInviteResponse {
  scheduledCallId: string;
  title: string;
  hostOwnerType: OwnerType;
  hostOwnerId: string;
  scheduledAt: string;
  status: CallStatus;
  myRsvpStatus: RsvpStatus;
}

export interface CallSessionResponse {
  callLogId: string;
  roomName: string;
  outcome: CallOutcome;
}

export interface CallLogResponse {
  id: string;
  scheduledCallId: string | null;
  callerOwnerType: OwnerType;
  callerOwnerId: string;
  calleeOwnerType: OwnerType | null;
  calleeOwnerId: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  outcome: CallOutcome;
}

export type CallEventType =
  | 'INCOMING_CALL'
  | 'CALL_ACCEPTED'
  | 'CALL_DECLINED'
  | 'CALL_BUSY'
  | 'CALL_MISSED'
  | 'CALL_CANCELLED'
  | 'CALL_ENDED'
  | 'SCHEDULED_CALL_STARTED'
  | 'SCHEDULED_CALL_REMINDER';

export interface CallEvent {
  type: CallEventType;
  callLogId: string | null;
  scheduledCallId: string | null;
  roomName: string | null;
  counterpartOwnerType: OwnerType | null;
  counterpartOwnerId: string | null;
  title: string | null;
  scheduledAt: string | null;
}
