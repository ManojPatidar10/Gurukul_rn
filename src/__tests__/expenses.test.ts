import type { ExpenseAction, InfraExpenseRequest, InfraExpenseStatus } from '../api/expenseTypes';
import hi from '../i18n/locales/hi.json';
import { fill, tEn, tHi } from '../testUtils/i18nFixture';
import {
  aboveApprovedData,
  aboveApprovedMessage,
  actorLabel,
  approvedLimit,
  billAboveApproved,
  categoryExistsData,
  categoryLabel,
  DEFAULT_CATEGORY_NAMES,
  defaultReviseAmount,
  DESCRIPTION_MAX_LENGTH,
  duplicateInvoiceData,
  duplicateInvoiceMessage,
  EXPENSE_PAYMENT_METHODS,
  expenseErrorKind,
  INFRA_STATUSES,
  infraActions,
  infraRowSubtitle,
  infraStatusLabel,
  infraStatusVariant,
  needsPaymentReference,
  needsReapproval,
  otherAdminNames,
  payConfirmation,
  paymentCategoryLabel,
  paymentMethodLabel,
  paymentMethodOptions,
  requestCategoryLabel,
  reviseBelowBillMessage,
  selfApprovalMessage,
  timelineStepLabel,
} from '../utils/expenses';

function request(status: InfraExpenseStatus, extra: Partial<InfraExpenseRequest> = {}): InfraExpenseRequest {
  return {
    id: 'r1',
    categoryId: 'c1',
    categoryCode: 'LIBRARY',
    categoryName: 'Library',
    description: 'Books',
    estimatedAmount: 5000,
    status,
    ...extra,
  };
}

const purchase = (actualAmount: number) => ({
  vendorId: 'v1',
  vendorName: 'ABC Supplies',
  invoiceNumber: 'INV-1',
  actualAmount,
  recordedBy: 'principal',
  recordedByName: 'Asha',
  recordedAt: '2026-10-10T10:00:00Z',
  vendorBankDetailsChangedAt: null,
});

/** An error shaped like the API client's ApiError. */
function apiError(errorCode: string, data?: unknown) {
  return Object.assign(new Error('refused'), { status: 409, errorCode, data });
}

describe('status words', () => {
  it('has a label and chip colour for all 7 statuses', () => {
    const labels = Object.fromEntries(INFRA_STATUSES.map((s) => [s, infraStatusLabel(s, tEn)]));
    expect(labels).toEqual({
      DRAFT: 'Draft',
      SUBMITTED: 'Waiting for approval',
      APPROVED: 'Approved',
      REJECTED: 'Rejected',
      PURCHASED: 'Bought, not paid',
      PAID: 'Paid',
      CANCELLED: 'Cancelled',
    });
    const variants = Object.fromEntries(INFRA_STATUSES.map((s) => [s, infraStatusVariant(s)]));
    expect(variants).toEqual({
      DRAFT: 'neutral',
      SUBMITTED: 'warning',
      APPROVED: 'info',
      REJECTED: 'error',
      PURCHASED: 'info',
      PAID: 'success',
      CANCELLED: 'neutral',
    });
    for (const s of INFRA_STATUSES) expect(infraStatusLabel(s, tHi)).toBe(hi.infraExpenses.status[s]);
  });

  it('shows a status a newer server adds as sent', () => {
    expect(infraStatusLabel('ARCHIVED', tEn)).toBe('ARCHIVED');
    expect(infraStatusVariant('ARCHIVED')).toBe('neutral');
  });

  it('names every timeline step', () => {
    expect(timelineStepLabel('SENT_BACK', tEn)).toBe('Sent back for approval');
    expect(timelineStepLabel('PURCHASE_RECORDED', tEn)).toBe('Purchase recorded');
    expect(timelineStepLabel('PAID', tHi)).toBe(hi.infraExpenses.timeline.PAID);
    expect(timelineStepLabel('SOMETHING_NEW', tEn)).toBe('SOMETHING_NEW');
  });
});

describe('infraActions', () => {
  it('uses the server list when there is one, dropping actions the app has no button for', () => {
    expect(infraActions(request('SUBMITTED', { allowedActions: ['REJECT', 'CANCEL'] }))).toEqual(['REJECT', 'CANCEL']);
    expect(infraActions(request('PAID', { allowedActions: [] }))).toEqual([]);
    expect(infraActions(request('DRAFT', { allowedActions: ['SUBMIT', 'ARCHIVE' as ExpenseAction] }))).toEqual(['SUBMIT']);
    // The server list wins even when the status table would say otherwise.
    expect(infraActions(request('PURCHASED', { allowedActions: ['REVISE'] }))).toEqual(['REVISE']);
  });

  it('falls back to the status table without one (an older server)', () => {
    expect(infraActions(request('DRAFT'))).toEqual(['SUBMIT', 'REVISE', 'CANCEL']);
    expect(infraActions(request('SUBMITTED'))).toEqual(['APPROVE', 'REJECT', 'CANCEL']);
    expect(infraActions(request('SUBMITTED', { selfApprovalBlocked: true }))).toEqual(['REJECT', 'CANCEL']);
    expect(infraActions(request('SUBMITTED', { purchase: purchase(4000) }))).toEqual(['APPROVE', 'REJECT']);
    expect(infraActions(request('SUBMITTED', { purchase: purchase(4000), selfApprovalBlocked: true }))).toEqual(['REJECT']);
    expect(infraActions(request('APPROVED'))).toEqual(['RECORD_PURCHASE', 'REVISE', 'CANCEL']);
    expect(infraActions(request('REJECTED'))).toEqual(['SUBMIT', 'REVISE', 'CANCEL']);
    expect(infraActions(request('REJECTED', { purchase: purchase(4000) }))).toEqual(['SUBMIT', 'REVISE']);
    expect(infraActions(request('PURCHASED', { approvedAmount: 5000, purchase: purchase(5000) }))).toEqual(['PAY']);
    expect(infraActions(request('PURCHASED', { approvedAmount: 5000, purchase: purchase(5000.01) }))).toEqual(['REVISE']);
    expect(infraActions(request('PURCHASED', { needsReapproval: true, purchase: purchase(100) }))).toEqual(['REVISE']);
    expect(infraActions(request('PAID'))).toEqual([]);
    expect(infraActions(request('CANCELLED'))).toEqual([]);
  });
});

describe('amounts', () => {
  it('limits the bill to the approved amount, or the amount asked when there is none', () => {
    expect(approvedLimit(request('APPROVED', { approvedAmount: 4000 }))).toBe(4000);
    expect(approvedLimit(request('APPROVED', { approvedAmount: null }))).toBe(5000);
    expect(billAboveApproved(request('APPROVED', { approvedAmount: 4000 }), 4000)).toBe(false);
    expect(billAboveApproved(request('APPROVED', { approvedAmount: 4000 }), 4000.01)).toBe(true);
    expect(billAboveApproved(request('APPROVED', { approvedAmount: 0.3 }), 0.1 + 0.2)).toBe(false);
  });

  it('works out when a bill needs approving again', () => {
    expect(needsReapproval(request('PURCHASED', { approvedAmount: 5000, purchase: purchase(6000) }))).toBe(true);
    expect(needsReapproval(request('PURCHASED', { approvedAmount: 5000, purchase: purchase(5000) }))).toBe(false);
    expect(needsReapproval(request('APPROVED'))).toBe(false);
    expect(needsReapproval(request('PURCHASED', { needsReapproval: false, purchase: purchase(9000) }))).toBe(false);
  });

  it('starts the revise panel at the bill when it is above the approval', () => {
    expect(defaultReviseAmount(request('PURCHASED', { approvedAmount: 5000, purchase: purchase(6000) }))).toBe(6000);
    expect(defaultReviseAmount(request('APPROVED', { estimatedAmount: 4500 }))).toBe(4500);
  });

  it('describes a row by category and the amounts so far', () => {
    expect(infraRowSubtitle(request('SUBMITTED'), tEn)).toBe('Library · Requested ₹5,000.00');
    expect(infraRowSubtitle(request('PURCHASED', { purchase: purchase(4800) }), tEn)).toBe(
      'Library · Requested ₹5,000.00 · Bill ₹4,800.00'
    );
    const payment = {
      transactionId: 't1',
      amount: 4800,
      paymentMethod: 'UPI' as const,
      paymentReference: 'UTR1',
      transactionDate: '2026-10-11',
      paidBy: 'admin',
      paidByName: null,
      paidAt: '2026-10-11T10:00:00Z',
    };
    expect(infraRowSubtitle(request('PAID', { purchase: purchase(4800), payment }), tEn)).toBe(
      'Library · Requested ₹5,000.00 · Paid ₹4,800.00'
    );
  });
});

describe('payment method', () => {
  it('offers exactly the backend methods, without card', () => {
    expect(EXPENSE_PAYMENT_METHODS).toEqual(['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE']);
    expect(paymentMethodOptions(tEn)).toEqual([
      { label: 'Cash', value: 'CASH' },
      { label: 'UPI', value: 'UPI' },
      { label: 'Bank transfer', value: 'BANK_TRANSFER' },
      { label: 'Cheque', value: 'CHEQUE' },
    ]);
    expect(paymentMethodLabel('BANK_TRANSFER', tHi)).toBe(hi.fees.paymentMethods.bankTransfer);
    expect(paymentMethodLabel('NEFT', tEn)).toBe('NEFT');
    expect(paymentMethodLabel(null, tEn)).toBe('');
  });

  it('needs a reference for everything except cash', () => {
    expect(needsPaymentReference('CASH')).toBe(false);
    expect(needsPaymentReference('UPI')).toBe(true);
    expect(needsPaymentReference('BANK_TRANSFER')).toBe(true);
    expect(needsPaymentReference('CHEQUE')).toBe(true);
    expect(needsPaymentReference('')).toBe(false);
    expect(needsPaymentReference(null)).toBe(false);
  });

  it('confirms a payment with the amount, vendor, method and date', () => {
    const purchase = { actualAmount: 48000.5, vendorName: 'ABC Supplies' };
    const inEnglish = payConfirmation(purchase, 'BANK_TRANSFER', '2026-10-11', tEn, 'en-IN');
    expect(inEnglish.title).toBe('Mark as paid?');
    expect(inEnglish.body).toContain('₹48,000.50');
    expect(inEnglish.body).toContain('ABC Supplies');
    expect(inEnglish.body).toContain('Bank transfer');
    expect(inEnglish.body).toContain('2026');
    expect(inEnglish.body).toContain("can't be undone");
    expect(inEnglish.body).not.toMatch(/\{\{/);

    const inHindi = payConfirmation(purchase, 'CASH', '2026-10-11', tHi, 'hi-IN');
    expect(inHindi.title).toBe(hi.infraExpenses.panels.payConfirmTitle);
    expect(inHindi.body).toContain(hi.fees.paymentMethods.cash);
    expect(inHindi.body).toContain('₹48,000.50');
    expect(inHindi.body).not.toMatch(/\{\{/);
  });
});

describe('categories', () => {
  it('translates a default category whose name has not changed', () => {
    expect(categoryLabel({ code: 'LAB', name: 'Laboratory' }, tEn)).toBe('Laboratory');
    expect(categoryLabel({ code: 'LAB', name: 'Laboratory' }, tHi)).toBe(hi.expenseCategories.defaultNames.LAB);
    expect(categoryLabel({ code: 'IT', name: null }, tHi)).toBe(hi.expenseCategories.defaultNames.IT);
  });

  it('shows the stored name for a renamed default, or any other category', () => {
    expect(categoryLabel({ code: 'LAB', name: 'Science Lab' }, tHi)).toBe('Science Lab');
    expect(categoryLabel({ code: 'CANTEEN', name: 'Canteen' }, tHi)).toBe('Canteen');
    expect(categoryLabel({ code: 'CATEGORY_1', name: '' }, tEn)).toBe('CATEGORY_1');
    expect(categoryLabel({ code: 'toString', name: 'x' }, tEn)).toBe('x');
  });

  it('has a translation for every default category', () => {
    expect(Object.keys(DEFAULT_CATEGORY_NAMES)).toEqual(['LIBRARY', 'LAB', 'SPORTS', 'FURNITURE', 'CLASSROOM', 'IT', 'OTHER']);
    for (const code of Object.keys(DEFAULT_CATEGORY_NAMES)) {
      expect(categoryLabel({ code, name: DEFAULT_CATEGORY_NAMES[code] }, tEn)).toBe(DEFAULT_CATEGORY_NAMES[code]);
      expect(categoryLabel({ code, name: DEFAULT_CATEGORY_NAMES[code] }, tHi)).toMatch(/[ऀ-ॿ]/);
    }
  });

  it("translates a default category's name in a vendor's payment history, which carries only the name", () => {
    expect(paymentCategoryLabel('Library', tHi)).toBe(hi.expenseCategories.defaultNames.LIBRARY);
    expect(paymentCategoryLabel(' Classroom Maintenance ', tHi)).toBe(hi.expenseCategories.defaultNames.CLASSROOM);
    expect(paymentCategoryLabel('Library', tEn)).toBe('Library');
    expect(paymentCategoryLabel('Science Lab', tHi)).toBe('Science Lab');
    expect(paymentCategoryLabel('library', tHi)).toBe('library');
    expect(paymentCategoryLabel(null, tHi)).toBeNull();
    expect(paymentCategoryLabel('  ', tEn)).toBeNull();
  });

  it("uses the request's category name, or the code from an older server", () => {
    expect(requestCategoryLabel(request('DRAFT', { categoryCode: 'SPORTS', categoryName: 'Sports Equipment' }), tEn)).toBe(
      'Sports Equipment'
    );
    expect(requestCategoryLabel(request('DRAFT', { categoryCode: 'X1', categoryName: undefined }), tEn)).toBe('X1');
  });

  it('reads the existing category from a 409 CATEGORY_EXISTS', () => {
    expect(categoryExistsData(apiError('CATEGORY_EXISTS', { id: 'c9', name: 'Canteen', active: false }))).toEqual({
      id: 'c9',
      name: 'Canteen',
      active: false,
    });
    expect(categoryExistsData(apiError('CATEGORY_EXISTS'))).toBeNull();
    expect(categoryExistsData(apiError('OTHER', { id: 'c9', name: 'Canteen', active: false }))).toBeNull();
  });

  it('caps descriptions at the column size', () => {
    expect(DESCRIPTION_MAX_LENGTH).toBe(1000);
  });
});

describe('refusals', () => {
  it('sorts each error code into how the screen reacts', () => {
    expect(expenseErrorKind(apiError('EXPENSE_CHANGED'))).toBe('stale');
    expect(expenseErrorKind(apiError('CONCURRENT_UPDATE'))).toBe('stale');
    expect(expenseErrorKind(apiError('EXPENSE_WRONG_STATUS'))).toBe('stale');
    expect(expenseErrorKind(apiError('AMOUNT_ABOVE_APPROVED'))).toBe('aboveApproved');
    expect(expenseErrorKind(apiError('SELF_APPROVAL_NOT_ALLOWED'))).toBe('selfApproval');
    expect(expenseErrorKind(apiError('DUPLICATE_INVOICE'))).toBe('duplicateInvoice');
    expect(expenseErrorKind(apiError('PAYMENT_REFERENCE_REQUIRED'))).toBe('other');
    expect(expenseErrorKind(new Error('boom'))).toBe('other');
    expect(expenseErrorKind(null)).toBe('other');
  });

  it('offers to send back for approval with the amounts from the 409', () => {
    const data = aboveApprovedData(apiError('AMOUNT_ABOVE_APPROVED', { approvedAmount: 5000, actualAmount: 8000 }));
    expect(data).toEqual({ approvedAmount: 5000, actualAmount: 8000 });
    expect(aboveApprovedMessage(data!, tEn)).toBe(
      'The bill of ₹8,000.00 is more than the ₹5,000.00 approved. Send the request back for approval at the bill amount? Another admin will have to approve it.'
    );
    expect(aboveApprovedMessage(data!, tHi)).toBe(
      fill(hi.infraExpenses.aboveApproved.body, { bill: '₹8,000.00', approved: '₹5,000.00' })
    );
    expect(aboveApprovedData(apiError('AMOUNT_ABOVE_APPROVED', { approvedAmount: '5000' }))).toBeNull();
  });

  it('names the admins who can approve instead', () => {
    const error = apiError('SELF_APPROVAL_NOT_ALLOWED', { otherAdminNames: ['Ravi Kumar', 'administrator'] });
    expect(otherAdminNames(error)).toEqual(['Ravi Kumar', 'administrator']);
    expect(selfApprovalMessage(error, tEn)).toBe(
      'You sent this request for approval, so another admin has to approve it: Ravi Kumar, administrator.'
    );
    expect(selfApprovalMessage(apiError('SELF_APPROVAL_NOT_ALLOWED'), tEn)).toBe(
      'You sent this request for approval, so another admin has to approve it.'
    );
    expect(otherAdminNames(apiError('SELF_APPROVAL_NOT_ALLOWED', { otherAdminNames: [3, ' ', 'Asha'] }))).toEqual(['Asha']);
  });

  it("names the duplicate invoice and the other expense's status", () => {
    const error = apiError('DUPLICATE_INVOICE', {
      source: 'INFRA',
      requestId: 'r2',
      eventId: null,
      status: 'PAID',
      invoiceNumber: 'INV-001',
    });
    expect(duplicateInvoiceData(error)).toEqual({
      source: 'INFRA',
      requestId: 'r2',
      eventId: null,
      status: 'PAID',
      invoiceNumber: 'INV-001',
    });
    expect(duplicateInvoiceMessage(error, tEn)).toBe(
      'Invoice INV-001 from this vendor is already recorded on another expense (Paid). If this is a different bill, add its date to the invoice number.'
    );
    const fromEvent = apiError('DUPLICATE_INVOICE', { source: 'EVENT', requestId: 'e1', eventId: 'ev1', status: 'PAID', invoiceNumber: 'INV-9' });
    expect(duplicateInvoiceMessage(fromEvent, tEn)).toContain('already paid through an event expense');
    expect(duplicateInvoiceMessage(apiError('DUPLICATE_INVOICE'), tEn)).toBeNull();
  });

  it('names the bill when a revised amount is below it', () => {
    expect(reviseBelowBillMessage(apiError('REVISED_AMOUNT_BELOW_BILL', { actualAmount: 8000 }), tEn)).toBe(
      'The new amount must cover the bill of ₹8,000.00.'
    );
    expect(reviseBelowBillMessage(apiError('REVISED_AMOUNT_BELOW_BILL'), tEn)).toBeNull();
    expect(reviseBelowBillMessage(apiError('OTHER', { actualAmount: 8000 }), tEn)).toBeNull();
  });

  it('shows the name behind a username, else the username', () => {
    expect(actorLabel('Asha Verma', 'principal')).toBe('Asha Verma');
    expect(actorLabel(null, 'principal')).toBe('principal');
    expect(actorLabel(' ', null)).toBeNull();
  });
});
