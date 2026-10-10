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
  bankAccountNumber: string | null;
  bankIfsc: string | null;
  bankAccountHolderName: string | null;
  upiVpaOverride: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusMeters: number;
  /** Short-lived presigned URL, null if no logo was uploaded (or storage isn't configured). */
  logoUrl: string | null;
  studentCount: number;
  classSectionCount: number;
  teacherCount: number;
  createdAt: string;
  updatedAt: string;
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
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankAccountHolderName?: string;
  upiVpaOverride?: string;
}

export interface SchoolLocationUpdateRequest {
  latitude: number;
  longitude: number;
  geofenceRadiusMeters: number;
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
  latitude?: number;
  longitude?: number;
  geofenceRadiusMeters?: number;
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
  /** Only populated for the ADMIN caller; null for anyone else (teacher, student, parent, unauthenticated). */
  registrationNumber: string | null;
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
  /** Optional - for the staff birthday wish. */
  dob: string | null;
  bankAccount: string;
  contactPhone: string;
  contactEmail: string | null;
  status: string;
  employeeType: EmployeeType | null;
  role: UserRole | null;
  createdAt: string;
  updatedAt: string;
}

export type EmployeeType = 'TEACHING' | 'NON_TEACHING';

export interface EmployeeRequest {
  name: string;
  designation: string;
  joinDate: string;
  /** Left out keeps the saved date of birth. */
  dob?: string;
  bankAccount?: string;
  contactPhone?: string;
  /** '' clears a saved email; left out keeps it. */
  contactEmail?: string;
  status?: string;
  /** Left out keeps the saved type (it can't be cleared once set). */
  employeeType?: EmployeeType;
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
  studentName: string;
  rollNumber: string;
  classSectionLabel: string;
  academicYear: string;
  schoolName: string;
  paymentMethod: string;
  paymentReference: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface DuesReport {
  unpaidAssessments: FeeAssessment[];
  totalUnpaid: number;
  overdueAssessments: FeeAssessment[];
  totalOverdue: number;
}

export interface PayrollRunSummary {
  month: number;
  year: number;
  status: string;
  employeeCount: number;
  totalNet: number;
}

export interface PayrollOverview {
  paidEmployeeCount: number;
  pendingEmployeeCount: number;
  paidAmount: number;
  pendingAmount: number;
  runs: PayrollRunSummary[];
}

export interface FeePaymentRequestResponse {
  assessmentId: string;
  studentName: string;
  amount: number;
  payeeName: string;
  accountNumber: string;
  ifsc: string;
  payeeVpa: string;
  upiUri: string;
  referenceId: string;
  generatedAt: string;
}

export type PaymentAttemptStatus =
  | 'INITIATED'
  | 'RESPONSE_SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN'
  | 'VERIFIED';

export interface PaymentAttempt {
  id: string;
  assessmentId: string;
  transactionRef: string;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  upiTransactionId: string | null;
  approvalRefNo: string | null;
  responseCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAttemptResultRequest {
  status: PaymentAttemptStatus;
  upiTransactionId?: string;
  approvalRefNo?: string;
  responseCode?: string;
  rawResponse?: string;
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

export interface TeacherSubjectAssignment {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
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
  /** The subject and creator are null on old assessments saved without them. */
  subjectId: string | null;
  subjectName: string | null;
  subjectCode: string | null;
  assessmentDate: string;
  maxMarks: number;
  description: string;
  createdByTeacherId: string | null;
  createdByTeacherName: string | null;
  term: string | null;
  /**
   * ACTIVE students in the section with a mark or Absent saved, and ACTIVE students in the section.
   * Only sent to ADMIN and TEACHER callers (null for STUDENT and PARENT), and missing from older servers.
   */
  marksEnteredCount?: number | null;
  marksExpectedCount?: number | null;
}

export interface CreateAssessmentRequest {
  title: string;
  type: AssessmentType;
  subjectId: string;
  assessmentDate: string;
  maxMarks: number;
  description?: string;
  /**
   * Who is recorded as the creator. Only an ADMIN can choose: the server ignores it from a TEACHER
   * (the creator is them). Older servers clear the creator when it's left out - see
   * utils/assessmentPermissions creatorTeacherId.
   */
  teacherId?: string;
  term?: string;
}

/** PUT /assessments/{id}: a field left out keeps its current value. `description: ""` clears it. */
export type UpdateAssessmentRequest = Partial<CreateAssessmentRequest>;

export interface AssessmentResultEntry {
  studentId: string;
  marksObtained?: number;
  absent: boolean;
  remarks?: string;
}

export interface StudentResult {
  studentId: string;
  studentName: string;
  rollNumber: string;
  marksObtained: number | null;
  absent: boolean;
  remarks: string | null;
}

export interface AssessmentResults {
  assessmentId: string;
  assessmentTitle: string;
  maxMarks: number;
  results: StudentResult[];
  /** Missing from older servers. */
  term?: string | null;
  /** True when the term's report cards are published, so marks can't be saved. Missing from older servers. */
  locked?: boolean;
}

export interface GradingBand {
  id: string | null;
  minPercentage: number;
  maxPercentage: number;
  label: string;
}

export interface SubjectResult {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  marksObtained: number;
  percentage: number;
  grade: string;
}

export interface ReportCard {
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  section: string;
  academicYear: string;
  term: string;
  subjects: SubjectResult[];
  totalMaxMarks: number;
  totalMarksObtained: number;
  /** Null when the student has no marks for the term (none entered, none marked absent). */
  overallPercentage: number | null;
  overallGrade: string | null;
  /** Assessments in this term with no mark for the student (blank and not marked absent). */
  missingMarksCount: number;
  attendancePercentage: number | null;
  published: boolean;
  publishedAt: string | null;
}

export interface ReportCardPublication {
  classSectionId: string;
  term: string;
  publishedAt: string;
  publishedByEmployeeName: string;
}

/** GET /class-sections/{id}/report-cards/publish-check - what publishing this term would do. */
export interface ReportCardPublishCheck {
  /** The section's own spelling of the term. */
  term: string;
  assessmentCount: number;
  /** Assessments in the section with no term, which no report card includes. */
  untermedAssessmentCount: number;
  studentCount: number;
  studentsWithMissingMarks: number;
  missingMarksCount: number;
  alreadyPublished: boolean;
  publishedAt: string | null;
}

export interface PublishedTerm {
  term: string;
  publishedAt: string;
}

export interface TermSummary {
  term: string;
  published: boolean;
}

export interface BackfillTermResult {
  assessmentsUpdated: number;
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

export type AttendanceMethod = 'RFID' | 'FINGERPRINT' | 'FACE';

export interface StudentAttendanceEntry {
  studentId: string;
  rollNumber: string;
  studentName: string;
  status: AttendanceStatus;
  remarks: string;
  method: AttendanceMethod | null;
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
  markedByTeacherId: string | null;
  markedByTeacherName: string | null;
  remarks: string;
  method: AttendanceMethod | null;
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

export interface SectionStudentAttendanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
}

export interface SectionAttendanceHistory {
  sectionId: string;
  className: string;
  section: string;
  academicYear: string;
  from: string | null;
  to: string | null;
  students: SectionStudentAttendanceSummary[];
}

export interface StaffAttendanceEntryRequest {
  employeeId: string;
  status: AttendanceStatus;
  remarks?: string;
}

/** An admin marking (or correcting) staff attendance for one day; re-sending a day overwrites it. */
export interface BulkStaffAttendanceRequest {
  date: string;
  /** Defaults to the logged-in admin when left out. */
  markedByEmployeeId?: string;
  records: StaffAttendanceEntryRequest[];
}

export interface SelfMarkAttendanceRequest {
  latitude: number;
  longitude: number;
  accuracy?: number;
  /** True when Android reports the fix came from a mock-location app; the server refuses it. */
  mocked?: boolean;
  /** When the device took the fix, epoch ms; the server refuses stale fixes. */
  fixTimestamp?: number;
  /** Developer options / root / cloner-app checks from the native module; the server refuses any that are true. */
  deviceChecks?: {
    developerOptionsEnabled: boolean;
    rooted: boolean;
    appCloned: boolean;
  };
}

export interface StaffAttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  markedByEmployeeId: string | null;
  markedByEmployeeName: string | null;
  remarks: string | null;
  selfMarked: boolean;
  method: AttendanceMethod | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffAttendanceEntry {
  employeeId: string;
  employeeName: string;
  designation: string;
  status: AttendanceStatus | null;
  remarks: string | null;
  selfMarked: boolean;
  method: AttendanceMethod | null;
}

export interface StaffAttendanceRoster {
  date: string;
  entries: StaffAttendanceEntry[];
}

export interface EmployeeAttendanceHistory {
  employeeId: string;
  employeeName: string;
  from: string | null;
  to: string | null;
  totalRecords: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  records: StaffAttendanceRecord[];
}

export interface PagedResponse<T> {
  content: T[];
  hasNext: boolean;
  totalElements: number;
}

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT' | 'DRIVER';
export type OwnerType = 'EMPLOYEE' | 'STUDENT' | 'PARENT';

export interface AttendanceDevice {
  id: string;
  name: string;
  deviceType: AttendanceMethod;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface AttendanceDeviceKey {
  id: string;
  name: string;
  deviceType: AttendanceMethod;
  /** Only ever present in the create/rotate-key response - never shown again after that. */
  apiKey: string;
}

export interface AttendanceIdentifier {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  ownerName: string;
  method: AttendanceMethod;
  externalId: string;
  active: boolean;
  createdAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  ownerType: OwnerType;
  ownerId: string;
  role: UserRole;
  schoolId: string;
  username: string;
  // Absent on sessions saved by app builds from before refresh tokens existed - those keep working
  // until their access token's first 401, then send the user to login once.
  refreshToken?: string;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

export interface RegistrationSubmittedResponse {
  entityId: string;
  message: string;
}

// Claim-by-reference-key model: admin already created the underlying record (student at
// enrollment, employee at hiring) - self-registration just proves who you are with a reference
// key and sets credentials, instead of re-entering data admin already has on file. The exact
// field name/format for each reference key is pending confirmation from backend - update here
// once known, screens just bind to these types.
export interface RegisterStudentRequest {
  registrationNumber: string;
  username: string;
  password: string;
}

export type RegisterStudentGoogleRequest = Omit<RegisterStudentRequest, 'username' | 'password'> & {
  idToken: string;
};

export interface StudentInviteResponse {
  code: string;
  expiresAt: string;
}

export interface RegisterStudentInviteRequest {
  inviteCode: string;
  username: string;
  password: string;
}

export type RegisterStudentInviteGoogleRequest = Omit<RegisterStudentInviteRequest, 'username' | 'password'> & {
  idToken: string;
};

export interface TeacherInviteResponse {
  code: string;
  expiresAt: string;
}

export interface RegisterTeacherRequest {
  inviteCode: string;
  username: string;
  password: string;
}

export type RegisterTeacherGoogleRequest = Omit<RegisterTeacherRequest, 'username' | 'password'> & {
  idToken: string;
};

export interface RegisterParentRequest {
  studentRegistrationNumber: string;
  parentContact: string;
  username: string;
  password: string;
}

export type RegisterParentGoogleRequest = Omit<RegisterParentRequest, 'username' | 'password'> & {
  idToken: string;
};

export type RegistrationEntityType = 'STUDENT_REGISTRATION' | 'EMPLOYEE_REGISTRATION' | 'PARENT_REGISTRATION';

export interface RegistrationInboxEntry {
  entityId: string;
  entityType: RegistrationEntityType;
  displayName: string;
  submittedBy: string;
  submittedAt: string;
}

export interface RegistrationDecisionRequest {
  comment?: string;
}

export interface LinkChildRequest {
  studentRegistrationNumber: string;
}

export interface OtpRequest {
  phone: string;
}

export interface OtpVerifyRequest {
  phone: string;
  otp: string;
}

// A phone number shared by siblings (or a teacher who is also a parent) resolves to more than one
// profile - verify/select-profile/switch all use this same shape so the UI can render one card
// component across the pre-login picker and the post-login "switch child" screen.
export type AuthProfileOwnerType = 'STUDENT' | 'EMPLOYEE';
export type AuthProfileRole = 'STUDENT' | 'TEACHER' | 'ADMIN' | 'DRIVER';
export type AuthProfileStatus = 'ACTIVE' | 'ALUMNI' | 'WITHDRAWN';

export interface AuthProfile {
  ownerType: AuthProfileOwnerType;
  ownerId: string;
  name: string;
  role: AuthProfileRole;
  className: string | null;
  section: string | null;
  rollNumber: string | null;
  status: AuthProfileStatus | null;
  current: boolean;
}

// `token` and the other login fields are only meaningful when profileSelectionRequired is false -
// otherwise they're a login for profiles[0], kept only so an app build without the picker still
// works (see PR #110 on the backend).
export interface OtpVerifyResponse extends LoginResponse {
  profileSelectionRequired: boolean;
  selectionToken?: string;
  profiles?: AuthProfile[];
}

export interface SelectProfileRequest {
  selectionToken: string;
  ownerType: AuthProfileOwnerType;
  ownerId: string;
}

export interface SwitchProfileRequest {
  ownerType: AuthProfileOwnerType;
  ownerId: string;
  refreshToken?: string;
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

export type ConversationType = 'STAFF_STAFF' | 'STAFF_STUDENT' | 'PARENT_STAFF' | 'BOT';

export interface ConversationParticipant {
  ownerType: OwnerType;
  ownerId: string;
  /** Resolved by the backend; null if that person no longer exists. */
  name?: string | null;
}

/** Someone the caller may start a parent-staff chat with (GET /api/v1/chat/contacts). */
export interface ChatContact {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  /** Staff contact: a school admin. */
  admin: boolean;
  /** Staff contact: sections (e.g. "5 - A") they are class teacher of, among the parent's children's. */
  classTeacherOf: string[];
  /** Staff contact: "Subject (section)" they teach the parent's children. */
  subjects: string[];
  /** Parent contact: "Child (section)" for each of their children the caller teaches. */
  children: string[];
}

/** One inbox entry - a copy of a push the caller was sent (GET /api/v1/notifications). */
export interface AppNotification {
  id: string;
  /** The push's data.type, e.g. ABSENCE_ALERT, FEE_DUE, ANNOUNCEMENT, NEW_MESSAGE. */
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  notifications: AppNotification[];
  hasMore: boolean;
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
  attachmentUrl: string | null;
  attachmentContentType: string | null;
  attachmentFileName: string | null;
}

export interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
}

export interface PresignChatAttachmentRequest {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface PresignChatAttachmentResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
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

/** Question-bank answer kinds. Only MCQ is used by Arena games; NUMERIC/SHORT_WORD are marked automatically. */
export type QuizQuestionType = 'MCQ' | 'NUMERIC' | 'SHORT_WORD';

export interface QuizQuestionResponse {
  id: string;
  className: string;
  questionText: string;
  /** Options and correctOption are null for NUMERIC / SHORT_WORD questions. */
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: QuizOption | null;
  createdByEmployeeId: string;
  createdByEmployeeName: string;
  /** Absent from older servers - treat as MCQ. */
  questionType?: QuizQuestionType;
  answerText?: string | null;
}

export interface BankQuestionInput {
  questionType: QuizQuestionType;
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctOption?: QuizOption;
  answerText?: string;
}

export interface BulkCreateQuizQuestionsRequest {
  subjectId: string;
  className: string;
  questions: BankQuestionInput[];
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
  correctOption: QuizOption;
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
  correctOption: QuizOption;
}

export type BattleRoomStatus = 'WAITING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface BattleRoomParticipant {
  studentId: string;
  name: string;
  /** Total score: each correct answer earns 1-10 by speed, wrong answers 0. */
  points: number;
  correctCount: number;
  /** Whether they've locked in an answer to currentQuestion - never whether it's right. */
  answeredCurrentQuestion: boolean;
}

export interface BattleRoomQuestion {
  id: string;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

/** One participant's outcome on a closed question. `selectedOption`/`responseMs` are null when they didn't answer in time. */
export interface BattlePlayerResult {
  studentId: string;
  name: string;
  answered: boolean;
  selectedOption: QuizOption | null;
  correct: boolean;
  points: number;
  responseMs: number | null;
}

/** Revealed once a question closes, for every participant - never sent for the question still in play. */
export interface BattleQuestionResult {
  questionIndex: number;
  questionId: string;
  correctOption: QuizOption;
  /** One row per participant, fastest correct answer first. */
  results: BattlePlayerResult[];
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
  /** Ordered by points, highest first. */
  participants: BattleRoomParticipant[];
  currentQuestion: BattleRoomQuestion | null;
  /**
   * When answering opens for currentQuestion. While this is in the future (the reveal pause after
   * the previous question), hide currentQuestion, show lastResult, and count down to this instead -
   * the server rejects answers until then.
   */
  currentQuestionStartsAt: string | null;
  /** When answering closes for currentQuestion - the question closes earlier if everyone answers. */
  currentQuestionEndsAt: string | null;
  lastResult: BattleQuestionResult | null;
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

export type CallProvider = 'JITSI' | 'GOOGLE_MEET';

export interface GoogleMeetStatusResponse {
  connected: boolean;
  googleEmail: string | null;
}

export interface ScheduledCallResponse {
  id: string;
  title: string;
  hostOwnerType: OwnerType;
  hostOwnerId: string;
  scheduledAt: string;
  roomName: string;
  provider: CallProvider;
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
  provider: CallProvider;
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
  provider: CallProvider | null;
  counterpartOwnerType: OwnerType | null;
  counterpartOwnerId: string | null;
  title: string | null;
  scheduledAt: string | null;
}

export type EventCategory = 'SPORTS' | 'CULTURAL' | 'ACADEMIC' | 'OTHER';
export type EventScope = 'SCHOOL' | 'CLASS' | 'GRADE';
// Old finance lifecycle - unrelated to participation, kept separate per backend's note.
export type EventFinanceStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';
export type EventParticipationStatus = 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
export type EventParticipationType = 'RSVP' | 'REGISTRATION' | 'POLL' | 'NONE';
export type EventRsvpStatus = 'ACCEPTED' | 'DECLINED' | 'MAYBE';

export interface EventRegistrationField {
  key: string;
  label: string;
  required: boolean;
}

export interface SchoolEvent {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  eventDate: string;
  status: EventFinanceStatus;
  inflowEnabled: boolean;
  outflowEnabled: boolean;
  category: EventCategory | null;
  scope: EventScope | null;
  sectionId: string | null;
  className: string | null;
  venue: string | null;
  startAt: string | null;
  endAt: string | null;
  participationStatus: EventParticipationStatus | null;
  participationType: EventParticipationType | null;
  registrationFields: EventRegistrationField[] | null;
  myRsvpStatus: EventRsvpStatus | null;
  myRegistrationAnswers: Record<string, string> | null;
  createdByEmployeeId: string;
  createdByEmployeeName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEventRequest {
  name: string;
  description: string;
  eventDate: string;
  category?: EventCategory;
  scope?: EventScope;
  sectionId?: string;
  className?: string;
  venue?: string;
  startAt?: string;
  endAt?: string;
  participationType?: EventParticipationType;
  registrationFields?: EventRegistrationField[];
}

export interface EventRsvpRequest {
  status: EventRsvpStatus;
}

export interface EventRsvpEntry {
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  status: EventRsvpStatus;
}

export interface EventRegistrationRequest {
  answers: Record<string, string>;
}

export interface EventRegistrationEntry {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  name: string;
  answers: Record<string, string>;
  submittedAt: string;
}

export interface CreateEventPollOptionsRequest {
  options: string[];
}

export interface EventPollOption {
  id: string;
  label: string;
  voteCount: number;
}

export interface EventPollResponse {
  options: EventPollOption[];
  myVoteOptionId: string | null;
}

export interface EventPollVoteRequest {
  optionId: string;
}

export interface AssessmentResultResponse {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentDate: string;
  subjectName: string | null;
  studentId: string;
  studentName: string;
  rollNumber: string;
  marksObtained: number | null;
  maxMarks: number;
  percentage: number;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackCategory =
  | 'TEACHING_QUALITY'
  | 'DISCIPLINE'
  | 'PUNCTUALITY'
  | 'PARENT_FEEDBACK'
  | 'PEER_REVIEW'
  | 'OTHER';

export interface EmployeeFeedbackRequest {
  rating: number;
  category: FeedbackCategory;
  comment?: string;
  feedbackDate: string;
  submittedBy?: string;
}

export interface EmployeeFeedbackResponse {
  id: string;
  employeeId: string;
  rating: number;
  category: FeedbackCategory;
  comment: string | null;
  feedbackDate: string;
  submittedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TypeBreakdown {
  type: AssessmentType;
  averagePercentage: number;
  count: number;
}

export interface AttendanceSummary {
  totalDays: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  halfDayCount: number;
  attendancePercentage: number;
}

export interface MonthAttendance {
  month: string;
  percentage: number;
}

export interface StudentPerformanceSummary {
  studentId: string;
  studentName: string;
  rollNumber: string;
  overallPerformancePercentage: number;
  examWeightedAveragePercentage: number;
  byAssessmentType: TypeBreakdown[];
  examHistory: AssessmentResultResponse[];
  attendance: AttendanceSummary;
  attendanceByMonth: MonthAttendance[];
}

export interface SectionResultBreakdown {
  sectionId: string;
  className: string;
  section: string;
  averagePercentage: number;
}

export interface CategoryBreakdown {
  category: FeedbackCategory;
  averageRating: number;
  count: number;
}

export interface EmployeePerformanceSummary {
  employeeId: string;
  employeeName: string;
  overallResultPercentage: number;
  byClassSection: SectionResultBreakdown[];
  averageFeedbackRating: number;
  feedbackByCategory: CategoryBreakdown[];
  feedbackHistory: EmployeeFeedbackResponse[];
}

export interface Teacher {
  id: string;
  schoolId: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string;
  qualification: string;
  specialization: string;
  joiningDate: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type TeacherResourceType = 'BOOK' | 'NOTES' | 'WORKSHEET' | 'PRESENTATION' | 'VIDEO' | 'LINK' | 'OTHER';

export interface TeacherResourceRequest {
  classSectionId: string;
  subjectName: string;
  resourceType: TeacherResourceType;
  title: string;
  description: string;
  resourceUrl: string;
  availableOffline: boolean;
}

export interface TeacherResourceUploadFields {
  classSectionId: string;
  subjectName: string;
  resourceType: TeacherResourceType;
  title: string;
  description: string;
  availableOffline: boolean;
}

export interface TeacherResourceResponse {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionId: string;
  className: string;
  section: string;
  academicYear: string;
  classSectionLabel: string;
  subjectName: string;
  resourceType: TeacherResourceType;
  title: string;
  description: string;
  resourceUrl: string;
  availableOffline: boolean;
  fileName: string | null;
  contentType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  updatedAt: string;
}

export type TeacherAssessmentType = 'QUIZ' | 'TEST' | 'EXAM' | 'ASSIGNMENT_CHECK';
export type QuizDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';
export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER' | 'TRUE_FALSE' | 'NUMERIC' | 'SHORT_WORD';

export interface AiQuizGenerationRequest {
  classSectionId: string;
  /** Required when a teacher generates for themselves; the server checks their assignment against it. */
  subjectId?: string;
  subjectName: string;
  assessmentType: TeacherAssessmentType;
  title: string;
  syllabus: string;
  difficulty: QuizDifficulty;
  questionCount: number;
  maxMarks: number;
  questionTypes?: QuestionType[];
  additionalInstructions?: string;
}

export interface GeneratedQuizQuestion {
  number: number;
  questionType: QuestionType;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  marks: number;
}

export interface AiQuizGenerationResponse {
  schoolId: string;
  teacherId: string;
  teacherName: string;
  classSectionId: string;
  classSectionLabel: string;
  /** Grade of the section, e.g. "Grade 8" - what the question bank is scoped to. */
  className?: string;
  subjectId?: string | null;
  subjectName: string;
  assessmentType: TeacherAssessmentType;
  title: string;
  syllabus: string;
  difficulty: QuizDifficulty;
  maxMarks: number;
  questionCount: number;
  generatorMode: string;
  reviewNote: string;
  model?: string;
  questions: GeneratedQuizQuestion[];
}

// --- Admissions (admin-only)

export type AdmissionStage = 'NEW' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'ENROLLED';

export type AdmissionDocumentType =
  | 'BIRTH_CERTIFICATE'
  | 'TRANSFER_CERTIFICATE'
  | 'PREVIOUS_MARKSHEET'
  | 'AADHAAR'
  | 'PHOTO'
  | 'OTHER';

export interface AdmissionRequest {
  studentName: string;
  dob: string;
  gender: string;
  address: string;
  previousSchoolName?: string;
  parentName: string;
  parentContact: string;
  parentEmail?: string;
  /** A class name from GET /class-sections/classes - the section is picked later, at enrolment. */
  appliedClassName: string;
  notes?: string;
}

export interface AdmissionDocument {
  id: string;
  documentType: AdmissionDocumentType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  /** Time-limited link; null when document storage isn't configured on the server. */
  downloadUrl: string | null;
  createdAt: string;
}

export interface AdmissionDuplicateStudent {
  id: string;
  name: string;
  rollNumber: string;
  classSectionLabel: string;
}

export interface Admission {
  id: string;
  stage: AdmissionStage;
  studentName: string;
  dob: string;
  gender: string;
  address: string;
  previousSchoolName: string | null;
  parentName: string;
  parentContact: string;
  parentEmail: string | null;
  appliedClassName: string;
  assignedClassSectionId: string | null;
  notes: string | null;
  studentId: string | null;
  decidedAt: string | null;
  enrolledAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Detail responses only (null in lists). */
  documents: AdmissionDocument[] | null;
  possibleDuplicates: AdmissionDuplicateStudent[] | null;
  documentUploadsEnabled: boolean | null;
}

export interface PresignAdmissionDocumentRequest {
  documentType: AdmissionDocumentType;
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface PresignAdmissionDocumentResponse {
  uploadUrl: string;
  objectKey: string;
  expiresAt: string;
}

export interface RegisterAdmissionDocumentRequest extends PresignAdmissionDocumentRequest {
  objectKey: string;
}

export interface ConvertAdmissionRequest {
  classSectionId: string;
  admissionDate?: string;
  sendParentInvite?: boolean;
  allowDuplicate?: boolean;
}

export interface ConvertAdmissionResponse {
  application: Admission;
  studentId: string | null;
  studentName: string | null;
  /** Server-assigned (alphabetical rank in the section). */
  rollNumber: string | null;
  registrationNumber: string | null;
  classSectionLabel: string | null;
  alreadyEnrolled: boolean;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
}

// ---------------------------------------------------------------- school bus (transport)

export type TripDirection = 'MORNING' | 'RETURN';
export type TripStatus = 'CHECKLIST' | 'ACTIVE' | 'ENDED';
export type BoardingStatus = 'BOARDED' | 'NOT_BOARDED';
export type NotBoardedReason = 'PICKED_UP_BY_PARENT' | 'LEFT_EARLY' | 'OTHER_BUS' | 'OTHER';

export interface Bus {
  id: string;
  name: string;
  registrationNumber: string | null;
  capacity: number | null;
  defaultDriverId: string | null;
  defaultDriverName: string | null;
  active: boolean;
}

export interface BusRequest {
  name: string;
  registrationNumber?: string;
  capacity?: number;
  defaultDriverId?: string | null;
  active?: boolean;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
}

/** A bus's latest known position - also the payload on /topic/transport/trips/{id}. */
export interface BusLocation {
  tripId: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  at: string;
}

export interface TripStudent {
  studentId: string;
  name: string;
  className: string;
  section: string;
  /** Null on a return checklist row nobody has marked yet. */
  status: BoardingStatus | null;
  reason: NotBoardedReason | null;
  note: string | null;
  extra: boolean;
  markedAt: string | null;
  /** Trip home: when the driver marked the child dropped at their stop. */
  droppedAt: string | null;
}

export interface BusTrip {
  id: string;
  busId: string;
  busName: string;
  busRegistrationNumber: string | null;
  driverId: string;
  driverName: string | null;
  direction: TripDirection;
  status: TripStatus;
  serviceDate: string;
  startedAt: string | null;
  endedAt: string | null;
  endedAutomatically: boolean;
  lastLocation: BusLocation | null;
  students: TripStudent[];
  morningTripIds: string[];
}

export interface MorningTripOption {
  tripId: string;
  busId: string;
  busName: string;
  driverName: string | null;
  endedAt: string | null;
  boardedCount: number;
}

export interface DriverHome {
  buses: Bus[];
  currentTrip: BusTrip | null;
  returnableMorningTrips: MorningTripOption[];
}

export interface TripSummary {
  id: string;
  busName: string;
  busRegistrationNumber: string | null;
  direction: TripDirection;
  status: TripStatus;
  serviceDate: string;
  startedAt: string | null;
  endedAt: string | null;
  endedAutomatically: boolean;
  boardedCount: number;
  notBoardedCount: number;
  droppedCount: number;
}

export interface TripHistoryPage {
  trips: TripSummary[];
  hasMore: boolean;
}

export interface DriverStudentResult {
  studentId: string;
  name: string;
  className: string;
  section: string;
}

export interface MyChildTrip {
  studentId: string;
  studentName: string;
  tripId: string;
  busName: string;
  busRegistrationNumber: string | null;
  driverName: string | null;
  direction: TripDirection;
  startedAt: string | null;
  lastLocation: BusLocation | null;
}

/** What a WhatsApp tracking link shows (public, no login). */
export interface PublicTracking {
  state: 'ON_BUS' | 'DROPPED' | 'ENDED' | 'INVALID';
  childName?: string;
  busName?: string;
  busRegistrationNumber?: string | null;
  direction?: TripDirection;
  schoolName?: string | null;
  location?: BusLocation | null;
  path?: [number, number][];
  droppedAt?: string | null;
  endedAt?: string | null;
}

export interface LocationFix {
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  at: string;
}

// ---------------------------------------------------------------- holidays & festivals

export type HolidayKind = 'FESTIVAL' | 'HOLIDAY';

export interface HolidayRequest {
  name: string;
  date: string;
  kind: HolidayKind;
  greetingEnabled?: boolean;
  /** Blank: the ready-written / default text. */
  greetingTitle?: string;
  greetingMessage?: string;
}

export interface Holiday {
  id: string;
  name: string;
  date: string;
  kind: HolidayKind;
  /** Set on national days / festivals pre-filled from the built-in list. */
  festivalKey: string | null;
  greetingEnabled: boolean;
  /** What will be sent. */
  greetingTitle: string;
  greetingMessage: string;
}
