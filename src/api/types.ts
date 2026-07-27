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

export type AnnouncementScope = 'SCHOOL' | 'CLASS';

export interface Announcement {
  id: string;
  scope: AnnouncementScope;
  sectionId: string | null;
  title: string;
  body: string;
  createdAt: string;
}

export interface CreateAnnouncementRequest {
  scope: AnnouncementScope;
  sectionId?: string;
  title: string;
  body: string;
}
