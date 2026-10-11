/**
 * Infrastructure expenses, their categories, and vendors - the shapes in specs/expenses-and-vendors
 * (API contract sections 1, 2 and 4). Money is a number with at most 2 decimals, dates are
 * YYYY-MM-DD, and instants are ISO-8601. "by" fields are login usernames; the matching `…Name` is
 * the employee behind that username, or null when there isn't one.
 */

/** The backend's PaymentMethod enum, without CARD - expenses aren't paid by card. */
export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

// ---------------------------------------------------------------------------------------------
// Categories

export interface InfraExpenseCategory {
  id: string;
  code: string;
  name: string;
  /** Turned-off categories can't be picked for a new request. Missing from an older server: treat as on. */
  active: boolean;
}

export interface InfraExpenseCategoryCreate {
  name: string;
  /** ^[A-Za-z0-9_]{2,50}$. Left out, the server derives it from the name. */
  code?: string;
}

/** The code never changes. */
export interface InfraExpenseCategoryUpdate {
  name: string;
  active: boolean;
}

// ---------------------------------------------------------------------------------------------
// Requests

export type InfraExpenseStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'PURCHASED' | 'PAID' | 'CANCELLED';

export type ExpenseAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'REVISE' | 'RECORD_PURCHASE' | 'PAY' | 'CANCEL';

export type ExpenseTimelineStep =
  | 'CREATED'
  | 'SUBMITTED'
  | 'SENT_BACK'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PURCHASE_RECORDED'
  | 'PAID';

export interface ExpenseTimelineEntry {
  step: ExpenseTimelineStep;
  at: string;
  by: string | null;
  byName: string | null;
  /** SUBMITTED/SENT_BACK: amount asked; APPROVED: amount approved; PURCHASE_RECORDED: bill; PAID: paid. */
  amount: number | null;
  comment: string | null;
  /** True only on an APPROVED step the submitter approved as the only active admin. */
  selfApproved: boolean;
}

export interface InfraPurchaseInfo {
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  actualAmount: number;
  recordedBy: string | null;
  recordedByName: string | null;
  recordedAt: string;
  /** The vendor's current value, for the "bank details changed recently" warning. */
  vendorBankDetailsChangedAt: string | null;
}

export interface ExpensePaymentInfo {
  transactionId: string;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  transactionDate: string;
  paidBy: string | null;
  paidByName: string | null;
  paidAt: string;
}

/**
 * One request. Everything after `status` is new in specs/expenses-and-vendors, so an older server
 * leaves it out - screens fall back (see utils/expenses.ts).
 */
export interface InfraExpenseRequest {
  id: string;
  categoryId: string;
  categoryCode: string;
  description: string;
  /** The amount asked for (the latest revision). */
  estimatedAmount: number;
  status: InfraExpenseStatus;
  categoryName?: string;
  categoryActive?: boolean;
  /** Set by approve; null before the first approval. */
  approvedAmount?: number | null;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | null;
  createdByName?: string | null;
  /** Whoever last submitted or revised it. */
  submittedBy?: string | null;
  submittedByName?: string | null;
  decidedBy?: string | null;
  decidedByName?: string | null;
  decisionComment?: string | null;
  purchase?: InfraPurchaseInfo | null;
  payment?: ExpensePaymentInfo | null;
  /** A legacy bill above its approval: it has to be revised and approved again before paying. */
  needsReapproval?: boolean;
  /** The steps the caller can take now. */
  allowedActions?: ExpenseAction[];
  /** Waiting for approval, the caller sent it, and another active admin has to approve it. */
  selfApprovalBlocked?: boolean;
  /** Null in the list; filled in every single-request response. */
  timeline?: ExpenseTimelineEntry[] | null;
}

export interface InfraExpenseRequestCreate {
  categoryId: string;
  /** At most 1000 characters. */
  description: string;
  estimatedAmount: number;
}

/** Submit, approve, reject and cancel. `expectedVersion` makes a stale screen get 409 EXPENSE_CHANGED. */
export interface ExpenseActionRequest {
  comment?: string;
  expectedVersion?: number;
}

export interface InfraReviseRequest {
  estimatedAmount: number;
  comment?: string;
  expectedVersion?: number;
}

export interface InfraPurchaseRequest {
  vendorId: string;
  invoiceNumber: string;
  actualAmount: number;
  expectedVersion?: number;
}

export interface InfraPayRequest {
  paymentMethod: PaymentMethod;
  /** Required for UPI, bank transfer and cheque: the UTR, transaction ID or cheque number. */
  paymentReference?: string;
  transactionDate?: string;
  expectedVersion?: number;
}

// Refusal details sent in the error envelope's `data`.

export interface AmountAboveApprovedData {
  approvedAmount: number;
  actualAmount: number;
}

export interface SelfApprovalData {
  otherAdminNames: string[];
}

export interface DuplicateInvoiceData {
  source: 'INFRA' | 'EVENT';
  requestId: string;
  eventId: string | null;
  status: string;
  invoiceNumber: string;
}

export interface CategoryExistsData {
  id: string;
  name: string;
  active: boolean;
}

// ---------------------------------------------------------------------------------------------
// Vendors

export interface Vendor {
  id: string;
  schoolId: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  bankAccount: string | null;
  upiId: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  ifsc?: string | null;
  accountHolderName?: string | null;
  gstin?: string | null;
  pan?: string | null;
  bankDetailsChangedAt?: string | null;
  bankDetailsChangedBy?: string | null;
  bankDetailsChangedByName?: string | null;
}

/** On create, a left-out field means none. On update, left out keeps the saved value and '' clears it. */
export interface VendorRequest {
  name: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  bankAccount?: string | null;
  ifsc?: string | null;
  accountHolderName?: string | null;
  upiId?: string | null;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
}

export interface VendorSimilar {
  id: string;
  name: string;
}

export interface VendorPaymentRow {
  source: 'INFRA' | 'EVENT';
  requestId: string;
  eventId: string | null;
  eventName: string | null;
  categoryName: string | null;
  description: string;
  invoiceNumber: string | null;
  amount: number;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  transactionDate: string;
  transactionId: string;
  paidAt: string;
}

export interface VendorPayments {
  vendorId: string;
  totalPaid: number;
  paymentCount: number;
  payments: VendorPaymentRow[];
}
