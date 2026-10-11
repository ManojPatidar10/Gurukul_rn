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

/**
 * Fee bill decisions the screens share (specs/fee-bills-and-dues): the status chip's colour and
 * words, adjustment signs and lines, due-date text, academic-year matching, the bill list's query,
 * category codes, structure lines, and the confirmations for Generate, structure edits and payment
 * settings. Pure, so it's unit-tested in src/__tests__/feeBills.test.ts.
 */

// ---------------------------------------------------------------------------------------------
// Money. formatAmount and parseAmountInput stand in for src/utils/money.ts (finance fix 3) until it
// lands on main, with the same behaviour, so they can be swapped for it.

function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

const AMOUNT_INPUT = /^\d{1,10}(\.\d{1,2})?$/;

/** "25000", "25,000" or " 2500.50 " -> the number. Blank, negative, 3 decimals or letters -> null. */
export function parseAmountInput(text: string): number | null {
  const cleaned = text.replace(/[\s,]/g, '');
  return AMOUNT_INPUT.test(cleaned) ? Number(cleaned) : null;
}

/**
 * 150000 -> "1,50,000", 1234567.5 -> "12,34,567.50", -2000 -> "-2,000": Indian digit grouping, with
 * paise only when there are some. Done by hand so every JS engine agrees.
 */
export function formatAmount(amount: number): string {
  const paise = toPaise(amount);
  const abs = Math.abs(paise);
  const rupees = String(Math.floor(abs / 100));
  const fraction = abs % 100;
  const lastThree = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  return `${paise < 0 ? '-' : ''}${grouped}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}

/** 2000 -> "₹2,000", -2000 -> "-₹2,000". */
export function formatRupees(amount: number): string {
  const text = formatAmount(amount);
  return text.startsWith('-') ? `-₹${text.slice(1)}` : `₹${text}`;
}

/** An adjustment's amount with its sign either way: "-₹2,000", "+₹500". */
export function formatSignedRupees(amount: number): string {
  return toPaise(amount) > 0 ? `+${formatRupees(amount)}` : formatRupees(amount);
}

/** What goes back in an amount field for a number: 13000 -> "13000", 13000.5 -> "13000.5". */
export function amountInputText(amount: number): string {
  return String(toPaise(amount) / 100);
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

/** A bill can be cancelled only while no money is on it: payments are reversed first. */
export function canCancelBill(bill: BillStatusFields & Pick<FeeAssessment, 'totalPaid'>): boolean {
  return !isBillCancelled(bill) && toPaise(bill.totalPaid) <= 0;
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
  const entered = parseAmountInput(amountText);
  if (entered === null || toPaise(entered) === 0) return { amount: null, newTotal: null, error: 'amount' };
  const amount = signedAdjustmentAmount(type, entered, correctionSign);
  const newTotalPaise = toPaise(bill.totalDue) + toPaise(amount);
  const newTotal = newTotalPaise / 100;
  return { amount, newTotal, error: newTotalPaise < toPaise(bill.totalPaid) ? 'belowPaid' : null };
}

// ---------------------------------------------------------------------------------------------
// Academic years and the bill list

const ACADEMIC_YEAR = /^(\d{4})[-/–](\d{2}|\d{4})$/;

/**
 * "2026-2027", "2026/27" or "2026–27" -> "2026-27", the one form the server stores on fee rows.
 * Anything else (not a year and the next) comes back trimmed, like the server's lenient form.
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
  if (lines.some((line) => parseAmountInput(line.amount) === null)) return 'invalidAmount';
  if (new Set(lines.map((line) => line.feeCategoryId)).size !== lines.length) return 'duplicateCategory';
  return null;
}

/** The lines to send. Call only once feeLinesError is null. */
export function feeLinesRequest(lines: FeeLineDraft[]): FeeStructureLineRequest[] {
  return lines.map((line) => ({ feeCategoryId: line.feeCategoryId, amount: parseAmountInput(line.amount) ?? 0 }));
}

/** The lines' total, added in paise, or null while any amount isn't valid. */
export function feeLinesTotal(lines: FeeLineDraft[]): number | null {
  let paise = 0;
  for (const line of lines) {
    const amount = parseAmountInput(line.amount);
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
        amount: formatAmount(preview.totalPerStudent),
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
