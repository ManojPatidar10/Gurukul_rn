import { api, ApiError } from './client';
import type { DayBook, FundSummary, LedgerFilter, LedgerTransaction, ReceiptView, ReversalResult } from './types';
import { buildLedgerQuery, LEDGER_PAGE_SIZE, summaryFilterOf } from '../utils/ledger';

// The school ledger, day book, receipt lookup and reversal (specs/ledger-and-receipts). Admin-only.

// Bumped after every reversal, so the Ledger screen knows to reload when it comes back into focus.
let changeCount = 0;

/** How many ledger changes this app session has made; compare before and after to spot one. */
export function ledgerChangeCount(): number {
  return changeCount;
}

/** One page of ledger entries, newest first. `totalElements` is only meaningful on page 0. */
export function listLedger(schoolId: string, filter: LedgerFilter, page: number, size = LEDGER_PAGE_SIZE) {
  return api.getPaginated<LedgerTransaction>(`/api/v1/finance/transactions${buildLedgerQuery(filter, page, size)}`, schoolId);
}

/** Totals for the same filter (no filter: all time). */
export function getFundSummary(schoolId: string, filter: LedgerFilter) {
  return api.get<FundSummary>(`/api/v1/finance/summary${buildLedgerQuery(summaryFilterOf(filter))}`, schoolId);
}

/** One day's entries with opening and closing balances; `date` is YYYY-MM-DD. */
export function getDayBook(schoolId: string, date: string) {
  return api.get<DayBook>(`/api/v1/finance/day-book?date=${encodeURIComponent(date)}`, schoolId);
}

export function getLedgerTransaction(schoolId: string, id: string) {
  return api.get<LedgerTransaction>(`/api/v1/finance/transactions/${encodeURIComponent(id)}`, schoolId);
}

/**
 * Adds a linked reversal entry dated today; the original's receipt then shows as cancelled. A 409
 * ALREADY_REVERSED means someone else got there first, which changes the ledger all the same.
 */
export async function reverseLedgerTransaction(schoolId: string, id: string, reason: string) {
  try {
    const result = await api.post<ReversalResult>(
      `/api/v1/finance/transactions/${encodeURIComponent(id)}/reverse`,
      { reason: reason.trim() },
      schoolId
    );
    changeCount += 1;
    return result;
  } catch (e) {
    if (e instanceof ApiError && e.errorCode === 'ALREADY_REVERSED') changeCount += 1;
    throw e;
  }
}

/** Looks a receipt or voucher up by its number (any case). 404 when there's no such number. */
export function findReceipt(schoolId: string, number: string) {
  return api.get<ReceiptView>(`/api/v1/finance/receipts?number=${encodeURIComponent(number)}`, schoolId);
}
