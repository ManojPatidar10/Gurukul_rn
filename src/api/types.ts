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
