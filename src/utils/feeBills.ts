import type { TFunction } from 'i18next';

import type {
  ClassSection,
  FeeAdjustment,
  FeeAdjustmentType,
  FeeAssessment,
  FeeAssessmentFilters,
  FeeAssessmentSummary,
  FeeBillLeftAloneReason,
  FeeBillStatus,
  FeeCategory,
  FeeStructure,
  FeeStructureLineRequest,
  FeeStructureUpdateResult,
  GenerateBillsResult,
  GeneratePreview,
} from '../api/types';
import { formatRupees, parseRupees, toPaise } from './money';

/**
 * Fee bill decisions the screens share (specs/fee-bills-and-dues): the status chip's colour and
 * words, adjustment signs and lines, due-date text, academic-year matching, the bill list's query
 * and empty text, category codes, structure lines, and the confirmations for adjustments, Generate,
 * structure edits and payment settings. Pure, so it's unit-tested in src/__tests__/feeBills.test.ts.
 */

// ---------------------------------------------------------------------------------------------
// Money: amounts are read with parseRupees and shown with formatRupees (src/utils/money.ts, finance
// fix 3), in whole paise, with Indian digit grouping and paise only when there are some.

/** An adjustment's amount with its sign either way: "-₹2,000", "+₹500". */
export function formatSignedRupees(amount: number): string {
  return toPaise(amount) > 0 ? `+${formatRupees(amount)}` : formatRupees(amount);
}

/** An amount for text that already has the ₹ sign ("₹{{amount}}"): 150000 -> "1,50,000". */
function plainRupees(amount: number): string {
  return formatRupees(amount, { symbol: false });
}

// ---------------------------------------------------------------------------------------------
// Status

export const FEE_BILL_STATUSES: readonly FeeBillStatus[] = ['UNPAID', 'PARTIAL', 'OVERDUE', 'PAID', 'CANCELLED'];

export type FeeStatusVariant = 'success' | 'warning' | 'error' | 'neutral';

/** The chip colour every fee screen uses for a bill's status. */
export function feeStatusVariant(status: string): FeeStatusVariant {
  switch (status) {
    case 'OVERDUE':
      return 'error';
    case 'PARTIAL':
      return 'warning';
    case 'PAID':
      return 'success';
    default:
      // UNPAID, CANCELLED, and a status a newer server adds.
      return 'neutral';
  }
}

const STATUS_LABEL_KEYS: Record<FeeBillStatus | 'ALL', string> = {
  UNPAID: 'fees.status.UNPAID',
  PARTIAL: 'fees.status.PARTIAL',
  OVERDUE: 'fees.status.OVERDUE',
  PAID: 'fees.status.PAID',
  CANCELLED: 'fees.status.CANCELLED',
  ALL: 'fees.status.ALL',
};

/** The i18n key for a status (or the 'ALL' filter), or null for one this app doesn't know. */
export function feeStatusLabelKey(status: string): string | null {
  return (STATUS_LABEL_KEYS[status as FeeBillStatus] as string | undefined) ?? null;
}

/** "Overdue" / "बकाया" for OVERDUE. A status a newer server adds shows as sent. */
export function feeStatusLabel(status: string, t: TFunction): string {
  const key = feeStatusLabelKey(status);
  return key ? t(key) : status;
}

type BillStatusFields = Pick<FeeAssessment, 'status'> & { cancelled?: boolean };

export function isBillCancelled(bill: BillStatusFields): boolean {
  return bill.status === 'CANCELLED' || bill.cancelled === true;
}

/**
 * A bill can be cancelled only while no money is on it. A reversed payment (finance fix 3) takes its
 * amount back off totalPaid, so once every payment is reversed the bill can be cancelled - the same
 * rule the server applies.
 */
export function canCancelBill(bill: BillStatusFields & Pick<FeeAssessment, 'totalPaid'>): boolean {
  return !isBillCancelled(bill) && toPaise(bill.totalPaid) <= 0;
}

/** Who is looking at a bill: the session's role and login type. */
export interface BillViewer {
  role: string;
  ownerType: string;
}

/** What the bill detail screen offers, worked out in one place so it's unit-tested. */
export interface BillDetailActions {
  /** Admin: Record payment. Only on a live bill with money still owed. */
  recordPayment: boolean;
  /** Admin: add an adjustment, change the due date, cancel. Not on a cancelled bill. */
  adminActions: boolean;
  /** Admin: Cancel bill, among those actions: only while nothing is paid on it. */
  cancelBill: boolean;
  /** Admin: the bill has payments, so Cancel is replaced by a hint to reverse them first. */
  cancelBlockedByPayments: boolean;
  /** Student or parent: how to pay at the school office, while money is owed on a live bill. */
  howToPay: boolean;
  /** Student or parent: "Nothing is owed" on a live bill that's fully paid. */
  nothingOwed: boolean;
  /** The bill's payments, reversed ones included: an admin or the student's own family (teachers get a 403). */
  paymentHistory: boolean;
}

export function billDetailActions(
  bill: BillStatusFields & Pick<FeeAssessment, 'totalPaid' | 'remainingDue'>,
  viewer: BillViewer
): BillDetailActions {
  const isAdmin = viewer.role === 'ADMIN';
  const isFamily = !isAdmin && (viewer.ownerType === 'STUDENT' || viewer.ownerType === 'PARENT');
  const live = !isBillCancelled(bill);
  const owed = live && toPaise(bill.remainingDue) > 0;
  const cancellable = canCancelBill(bill);
  return {
    recordPayment: isAdmin && owed,
    adminActions: isAdmin && live,
    cancelBill: isAdmin && cancellable,
    cancelBlockedByPayments: isAdmin && live && !cancellable,
    howToPay: isFamily && owed,
    nothingOwed: isFamily && live && !owed,
    paymentHistory: isAdmin || isFamily,
  };
}

// ---------------------------------------------------------------------------------------------
// Dates

/** Today's date in India ("2026-10-11"), the day the server counts a bill as overdue from. */
export function todayIst(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD date moved by whole years (29 Feb lands on 28 Feb) and then days. */
export function shiftIsoDate(iso: string, { years = 0, days = 0 }: { years?: number; days?: number }): string {
  const [y, m, d] = iso.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y + years, m, 0)).getUTCDate();
  const date = new Date(Date.UTC(y + years, m - 1, Math.min(d, daysInMonth) + days));
  return date.toISOString().slice(0, 10);
}

/** The dates an admin may move a bill's due date to: within two years either side of today. */
export function dueDateChangeBounds(today: string): { min: string; max: string } {
  return { min: shiftIsoDate(today, { years: -2 }), max: shiftIsoDate(today, { years: 2 }) };
}

/** The due dates Generate accepts: today to two years ahead. */
export function generateDueDateBounds(today: string): { min: string; max: string } {
  return { min: today, max: shiftIsoDate(today, { years: 2 }) };
}

/** A YYYY-MM-DD date kept within bounds (Generate's default when the server's suggestion falls outside). */
export function clampIsoDate(iso: string, bounds: { min: string; max: string }): string {
  return iso < bounds.min ? bounds.min : iso > bounds.max ? bounds.max : iso;
}

/** "2026-11-05" -> "5 Nov 2026", the month in the app's language. Anything else shows as sent. */
export function formatDueDate(iso: string, t: TFunction): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return iso;
  return `${Number(match[3])} ${t(`fees.bill.monthsShort.${month}`)} ${match[1]}`;
}

/** An instant ("2026-10-11T20:00:00Z") as its date in India: "12 Oct 2026". */
export function formatInstantDate(instant: string, t: TFunction): string {
  const time = Date.parse(instant);
  return Number.isNaN(time) ? instant : formatDueDate(todayIst(new Date(time)), t);
}

export interface BillDueNote {
  text: string;
  tone: 'error' | 'muted';
}

/**
 * The line under a bill: "Overdue by 11 days", "Due 5 Nov 2026" or "Cancelled". Null for a paid bill
 * or one with no due date.
 */
export function billDueNote(
  bill: BillStatusFields & Pick<FeeAssessment, 'dueDate' | 'daysOverdue' | 'remainingDue'>,
  t: TFunction
): BillDueNote | null {
  if (isBillCancelled(bill)) return { text: t('fees.bill.cancelled'), tone: 'muted' };
  if (bill.status === 'OVERDUE') {
    const days = bill.daysOverdue ?? 0;
    return { text: days > 0 ? t('fees.bill.overdueBy', { count: days }) : t('fees.status.OVERDUE'), tone: 'error' };
  }
  if (toPaise(bill.remainingDue) > 0 && bill.dueDate) {
    return { text: t('fees.bill.dueOn', { date: formatDueDate(bill.dueDate, t) }), tone: 'muted' };
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Adjustments

export const FEE_ADJUSTMENT_TYPES: readonly FeeAdjustmentType[] = ['CONCESSION', 'WAIVER', 'LATE_FEE', 'CORRECTION'];

const ADJUSTMENT_LABEL_KEYS: Record<FeeAdjustmentType, string> = {
  CONCESSION: 'fees.adjustment.types.CONCESSION',
  WAIVER: 'fees.adjustment.types.WAIVER',
  LATE_FEE: 'fees.adjustment.types.LATE_FEE',
  CORRECTION: 'fees.adjustment.types.CORRECTION',
};

export function adjustmentLabelKey(type: string): string | null {
  return (ADJUSTMENT_LABEL_KEYS[type as FeeAdjustmentType] as string | undefined) ?? null;
}

/** "Concession" for CONCESSION. A type a newer server adds shows as sent. */
export function adjustmentLabel(type: string, t: TFunction): string {
  const key = adjustmentLabelKey(type);
  return key ? t(key) : type;
}

/**
 * The amount to send for what the admin typed (a size, never signed): a concession or waiver
 * takes money off the fee, a late fee adds to it, and a correction goes the way the admin chose.
 */
export function signedAdjustmentAmount(type: FeeAdjustmentType, entered: number, correctionSign: 1 | -1 = -1): number {
  const size = Math.abs(entered);
  if (type === 'CONCESSION' || type === 'WAIVER') return -size;
  if (type === 'LATE_FEE') return size;
  return correctionSign * size;
}

/** "Concession: -₹2,000 (Sibling)". */
export function formatAdjustmentLine(adjustment: Pick<FeeAdjustment, 'type' | 'amount' | 'reason'>, t: TFunction): string {
  return t('fees.adjustment.line', {
    type: adjustmentLabel(adjustment.type, t),
    amount: formatSignedRupees(adjustment.amount),
    reason: adjustment.reason,
  });
}

/** "Priya Singh · 11 Oct 2026" for an admin; just the date for a family, who aren't sent the name. */
export function adjustmentByLine(adjustment: Pick<FeeAdjustment, 'createdByName' | 'createdAt'>, t: TFunction): string {
  const date = formatInstantDate(adjustment.createdAt, t);
  return adjustment.createdByName ? t('fees.adjustment.by', { name: adjustment.createdByName, date }) : date;
}

export interface AdjustmentDraft {
  /** The signed amount to send, once the typed amount is valid. */
  amount: number | null;
  /** The bill's total after it. */
  newTotal: number | null;
  /** 'amount': not a valid amount above 0. 'belowPaid': the fee would end up below what's paid. */
  error: 'amount' | 'belowPaid' | null;
}

/** Checks a typed adjustment the way the server will, before it's sent. */
export function adjustmentDraft(
  bill: Pick<FeeAssessment, 'totalDue' | 'totalPaid'>,
  type: FeeAdjustmentType,
  amountText: string,
  correctionSign: 1 | -1
): AdjustmentDraft {
  const entered = parseRupees(amountText);
  if (entered === null || toPaise(entered) === 0) return { amount: null, newTotal: null, error: 'amount' };
  const amount = signedAdjustmentAmount(type, entered, correctionSign);
  const newTotalPaise = toPaise(bill.totalDue) + toPaise(amount);
  const newTotal = newTotalPaise / 100;
  return { amount, newTotal, error: newTotalPaise < toPaise(bill.totalPaid) ? 'belowPaid' : null };
}

/**
 * What Save adjustment asks first: "Late fee of +₹5,000 on Asha's bill. The new total will be
 * ₹25,000." and that the family sees it with its reason and it can't be deleted (only reversed
 * with a correction).
 */
export function adjustmentConfirmText(
  studentName: string,
  type: FeeAdjustmentType,
  amount: number,
  newTotal: number,
  t: TFunction
): string {
  return t('fees.adjustment.confirmMessage', {
    type: adjustmentLabel(type, t),
    amount: formatSignedRupees(amount),
    name: studentName,
    total: plainRupees(newTotal),
  });
}

// ---------------------------------------------------------------------------------------------
// Academic years and the bill list

// The server's pattern (AcademicYears.java): -, /, en or em dash, spaces allowed around it.
const ACADEMIC_YEAR = /^(\d{4})\s*[-/–—]\s*(\d{2}|\d{4})$/;

/**
 * "2026-2027", "2026/27", "2026 – 27" or "2026—27" -> "2026-27", the one form the server stores on
 * fee rows. Anything else (not a year and the next) comes back trimmed, like the server's lenient form.
 */
export function canonicalAcademicYear(text: string | null | undefined): string {
  const trimmed = (text ?? '').trim();
  const match = ACADEMIC_YEAR.exec(trimmed);
  if (!match) return trimmed;
  const start = Number(match[1]);
  const end = Number(match[2]);
  const follows = match[2].length === 2 ? end === (start + 1) % 100 : end === start + 1;
  return follows ? `${start}-${String((start + 1) % 100).padStart(2, '0')}` : trimmed;
}

export const ALL_ACADEMIC_YEARS = 'ALL';

/** The year picker's years: the summary's own year and every year with bills, newest first. */
export function academicYearOptions(
  summary: Pick<FeeAssessmentSummary, 'academicYear' | 'availableAcademicYears'> | null
): string[] {
  if (!summary) return [];
  const years = new Set(summary.availableAcademicYears);
  if (summary.academicYear !== ALL_ACADEMIC_YEARS) years.add(summary.academicYear);
  return [...years].sort().reverse();
}

export interface AssessmentsEmptyState {
  /** The last page-0 load failed. */
  loadFailed: boolean;
  /** A status, search or class filter is on. */
  filtered: boolean;
  /** The year the list shows (ALL for every year), or null while it isn't known. */
  shownYear: string | null;
  /** The summary's years that have any bill, or null while there's no summary. */
  availableYears: readonly string[] | null;
}

/**
 * What the admin's bill list says when it has no rows. It defaults to the current year, so a
 * school whose bills are all from other years (last year's unpaid dues) is told to pick another
 * year, not that it has no bills. "Generate them first" only when the school has no bill at all.
 */
export function assessmentsEmptyText(state: AssessmentsEmptyState, t: TFunction): string {
  if (state.loadFailed) return t('fees.assessmentsList.loadError');
  if (state.availableYears?.length === 0) return t('fees.assessmentsList.empty');
  if (!state.filtered && state.shownYear && state.shownYear !== ALL_ACADEMIC_YEARS) {
    return t('fees.assessmentsList.noBillsForYear', { year: state.shownYear });
  }
  return t('fees.assessmentsList.noMatches');
}

/** The tag on a bill of a student who has left ("Alumni" or "Withdrawn"); null while they're ACTIVE. */
export function studentLeftTagKey(studentStatus: string | null | undefined): string | null {
  if (!studentStatus || studentStatus === 'ACTIVE') return null;
  return studentStatus === 'ALUMNI' ? 'fees.assessmentsList.alumniTag' : 'fees.assessmentsList.withdrawnTag';
}

/** The class filter's sections: those of the chosen year (whichever way their year is written), or all. */
export function sectionsForYear<T extends Pick<ClassSection, 'academicYear'>>(sections: T[], year: string | null): T[] {
  if (!year || year === ALL_ACADEMIC_YEARS) return sections;
  return sections.filter((section) => canonicalAcademicYear(section.academicYear) === year);
}

/** The bill list's query string. Filters left out get the server's default. */
export function feeAssessmentQuery(filters: FeeAssessmentFilters, page?: number, size?: number): string {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.classSectionId) params.set('classSectionId', filters.classSectionId);
  if (filters.academicYear) params.set('academicYear', filters.academicYear);
  const q = filters.q?.trim();
  if (q) params.set('q', q.slice(0, 100));
  if (filters.includeInactive) params.set('includeInactive', 'true');
  if (page !== undefined) params.set('page', String(page));
  if (size !== undefined) params.set('size', String(size));
  return params.toString();
}

// ---------------------------------------------------------------------------------------------
// Categories

/** What the server stores for a typed code (" tuition fee " -> "TUITION_FEE"), or null if it'd refuse it. */
export function normaliseCategoryCode(text: string): string | null {
  const code = text.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return /^[A-Z0-9_]{2,30}$/.test(code) ? code : null;
}

/** A picker's choices: the categories in use, plus the one already chosen even if it was retired since. */
export function pickableCategories<T extends Pick<FeeCategory, 'id' | 'active'>>(categories: T[], selectedId: string | null): T[] {
  return categories.filter((category) => category.active !== false || category.id === selectedId);
}

/** The picker's line when it shows no category: none made yet, or every one marked not in use. Null while it shows some. */
export function categoryPickerEmptyKey(categoryCount: number, shownCount: number): string | null {
  if (shownCount > 0) return null;
  return categoryCount > 0 ? 'fees.categoryPicker.allNotInUse' : 'fees.categoryPicker.empty';
}

// ---------------------------------------------------------------------------------------------
// Structure lines

export interface FeeLineDraft {
  feeCategoryId: string;
  /** As typed. */
  amount: string;
}

export const MAX_FEE_LINES = 50;

export type FeeLinesError = 'noLines' | 'tooManyLines' | 'missingCategory' | 'invalidAmount' | 'duplicateCategory';

/** What stops these lines being saved, checked the way the server does. 0 is a valid amount. */
export function feeLinesError(lines: FeeLineDraft[]): FeeLinesError | null {
  if (lines.length === 0) return 'noLines';
  if (lines.length > MAX_FEE_LINES) return 'tooManyLines';
  if (lines.some((line) => !line.feeCategoryId)) return 'missingCategory';
  if (lines.some((line) => parseRupees(line.amount) === null)) return 'invalidAmount';
  if (new Set(lines.map((line) => line.feeCategoryId)).size !== lines.length) return 'duplicateCategory';
  return null;
}

/** The lines to send. Call only once feeLinesError is null. */
export function feeLinesRequest(lines: FeeLineDraft[]): FeeStructureLineRequest[] {
  return lines.map((line) => ({ feeCategoryId: line.feeCategoryId, amount: parseRupees(line.amount) ?? 0 }));
}

/** The lines' total, added in paise, or null while any amount isn't valid. */
export function feeLinesTotal(lines: FeeLineDraft[]): number | null {
  let paise = 0;
  for (const line of lines) {
    const amount = parseRupees(line.amount);
    if (amount === null) return null;
    paise += toPaise(amount);
  }
  return paise / 100;
}

/** A structure's own total: the server's, or the lines added up for a server that doesn't send it. */
export function structureTotal(structure: Pick<FeeStructure, 'lines'> & { totalPerStudent?: number | null }): number {
  if (typeof structure.totalPerStudent === 'number') return structure.totalPerStudent;
  return structure.lines.reduce((paise, line) => paise + toPaise(line.amount), 0) / 100;
}

// ---------------------------------------------------------------------------------------------
// Generate and structure edits

const NAMES_SHOWN = 5;

/** "Asha, Ravi" or "Asha, Ravi, … and 3 more". */
function nameList(names: string[], t: TFunction): string {
  const shown = names.slice(0, NAMES_SHOWN).join(', ');
  const extra = names.length - NAMES_SHOWN;
  return extra > 0 ? t('fees.structureDetail.generate.moreNames', { names: shown, extra }) : shown;
}

export interface GenerateConfirmation {
  /** False when there's nobody to bill: the dialog shows no confirm button. */
  canGenerate: boolean;
  lines: string[];
}

/**
 * What Generate's confirmation says: "Create 40 new bills of ₹20,000 each, due 10 Nov 2026?", who
 * already has a bill (and which of them for a different amount), and who's skipped as withdrawn.
 */
export function generateConfirmation(preview: GeneratePreview, dueDate: string, t: TFunction): GenerateConfirmation {
  const lines: string[] = [];
  if (preview.toCreateCount > 0) {
    lines.push(
      t('fees.structureDetail.generate.confirmCreate', {
        count: preview.toCreateCount,
        amount: plainRupees(preview.totalPerStudent),
        date: formatDueDate(dueDate, t),
      })
    );
  } else if (preview.activeStudentCount === 0) {
    lines.push(t('fees.structureDetail.generate.noStudents'));
  } else {
    lines.push(t('fees.structureDetail.generate.everyoneBilled'));
  }
  if (preview.alreadyBilledCount > 0) {
    const different = preview.alreadyBilledDifferentTotal;
    lines.push(
      different.length > 0
        ? t('fees.structureDetail.generate.alreadyBilledDifferent', {
            count: preview.alreadyBilledCount,
            different: different.length,
            names: nameList(
              different.map((bill) => bill.studentName),
              t
            ),
          })
        : t('fees.structureDetail.generate.alreadyBilled', { count: preview.alreadyBilledCount })
    );
  }
  if (preview.inactiveStudentCount > 0) {
    lines.push(t('fees.structureDetail.generate.inactiveSkipped', { count: preview.inactiveStudentCount }));
  }
  return { canGenerate: preview.toCreateCount > 0, lines };
}

/** "Created 40 new bills. 2 already had one." */
export function generateResultText(result: Pick<GenerateBillsResult, 'createdCount' | 'alreadyBilledCount'>, t: TFunction): string {
  return t('fees.structureDetail.generate.result', { count: result.createdCount, already: result.alreadyBilledCount });
}

const LEFT_ALONE_REASONS: readonly FeeBillLeftAloneReason[] = ['HAS_PAYMENTS', 'HAS_ADJUSTMENTS', 'NOT_REQUESTED'];

/** What a structure edit did to its bills: how many were re-priced, how many kept their amount and why. */
export function structureUpdateMessage(
  result: Pick<FeeStructureUpdateResult, 'repricedCount' | 'leftAloneCount' | 'leftAlone'>,
  t: TFunction
): string {
  if (result.repricedCount === 0 && result.leftAloneCount === 0) return t('fees.structureForm.result.nothingToUpdate');
  const parts: string[] = [];
  if (result.repricedCount > 0) parts.push(t('fees.structureForm.result.repriced', { count: result.repricedCount }));
  if (result.leftAloneCount > 0) {
    parts.push(t('fees.structureForm.result.leftAlone', { count: result.leftAloneCount }));
    // The server lists at most 100; a breakdown of part of them would mislead.
    if (result.leftAlone.length === result.leftAloneCount) {
      for (const reason of LEFT_ALONE_REASONS) {
        const n = result.leftAlone.filter((bill) => bill.reason === reason).length;
        if (n > 0) parts.push(`• ${t(`fees.structureForm.result.reason.${reason}`, { n })}`);
      }
    }
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Payment settings

/** "123456789012" -> "XXXX9012". */
export function maskAccountNumber(account: string): string {
  const trimmed = account.trim();
  return trimmed.length <= 4 ? trimmed : `XXXX${trimmed.slice(-4)}`;
}

/** The question Save asks: "Save account XXXX9012 and UPI ID school@oksbi?". */
export function paymentSettingsConfirmText(accountNumber: string, upiId: string, t: TFunction): string {
  const account = maskAccountNumber(accountNumber);
  const upi = upiId.trim();
  return upi
    ? t('fees.paymentSettings.confirmWithUpi', { account, upiId: upi })
    : t('fees.paymentSettings.confirmWithoutUpi', { account });
}
