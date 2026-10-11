# Fees Overview, Bills & My Class Fees — Test Plan

## Manual test checklist

### Admin bill list
- [ ] Open Assessments & Dues: the year dropdown shows the current academic year, the list has only active students' bills for it and no cancelled ones, and the summary card (bills, unpaid, overdue, amount due) matches `GET /api/v1/reports/dues` for the same year.
- [ ] Pick "All years": last year's unpaid bills appear and the totals grow. Pick a class: only that class's bills, and the class dropdown lists only sections of the chosen year (a `2026-2027` section shows under `2026-27`).
- [ ] Search by part of a name and by the start of a roll number: matches beyond the first page are found (server search).
- [ ] Type quickly or switch filters while a page is loading: the list always ends up matching the last filters chosen.
- [ ] Turn on "Show withdrawn students": withdrawn students' bills appear with a "Withdrawn" tag (or "Alumni").
- [ ] Each status chip, including Cancelled, filters the list; the chips and row chips are translated (switch to Hindi).
- [ ] A bill due yesterday with nothing paid shows "Overdue" and "Overdue by 1 day" without any payment; one due today doesn't.

### Bill detail (ADMIN)
- [ ] Add a concession of 2,000 with a reason: the total drops by 2,000, the Adjustments card shows "Concession: -₹2,000 (…)" with your name and the date, and the list's totals change when you go back.
- [ ] A concession larger than what's left above the paid amount is refused before sending; force it (e.g. a second device) → "This would make the fee less than what has already been paid."
- [ ] "Waive all ₹X still owed" fills the remaining amount; saving makes the bill Paid.
- [ ] A late fee on a paid bill: no longer Paid. A correction with "Add to the fee" raises the total.
- [ ] Change the due date to yesterday: Overdue, "Overdue by 1 day". To next week: back to Unpaid/Part paid.
- [ ] On an unpaid bill, Cancel bill asks for a reason, then confirms; the bill shows the cancelled banner and disappears from the default list (and appears under Cancelled). On a bill with a payment, the Cancel button is hidden and the hint says to reverse payments first.
- [ ] On a cancelled bill, no admin actions show; recording a payment on it → "This bill was cancelled, so it can't be changed or paid."

### Families
- [ ] Parent: a child's fees list shows the translated chip and due date / overdue note; tapping a bill opens its detail with the adjustments (no names) and the How to pay card. Coming back re-fetches.
- [ ] Student: My Fees → a bill: same. A fully paid or zero bill says "Nothing is owed on this bill." A cancelled bill shows "Cancelled" and no How to pay card.
- [ ] Tap a FEE_DUE push as a student (no parent linked): My Fees opens. As a parent: the child's fees open.
- [ ] `GET /api/v1/fee-assessments/{id}`: own STUDENT 200, another student 403, linked PARENT 200, unrelated TEACHER 403.

### My Class Fees (class teacher)
- [ ] Only active students, no last-year bills after a promotion, no cancelled bills. Pull to refresh works; with the network off, the error shows with "Try again", which reloads.

### Routes
- [ ] As a TEACHER: `GET /fee-assessments`, `/fee-assessments/summary`, `PATCH /fee-assessments/{id}`, `POST …/adjustments`, `POST …/cancel` → 403. `GET /fee-assessments/summary` isn't swallowed by `GET /fee-assessments/*`.

## Existing automated test coverage
- App: `src/__tests__/feeBills.test.ts` — status chip colour and labels (en/hi, unknown status), `billDueNote` (overdue days, due date, cancelled, paid), IST date at 23:00 UTC, due-date bounds, adjustment signs, lines and the below-paid check, academic-year spelling and options, sections per year, the list query string, withdrawn tags. `src/__tests__/notificationRouting.test.ts` — a student's FEE_DUE opens My Fees. `src/__tests__/i18nParity.test.ts`.
- Backend (per the spec's testing plan): `FeeStatusRuleTest`, `AcademicYearsTest`, `FeeAdjustmentIntegrationTest`, `FeeBillCancelIntegrationTest`, `FeeOverdueIntegrationTest` (derived OVERDUE, due-date PATCH, the sync job), `FeeDuesAndSummaryIntegrationTest` (withdrawn, years, `q`, paging, size cap), `ClassSectionFeeStatusIntegrationTest`, `ReportOverviewIntegrationTest`, `AdminOnlyRulesIntegrationTest`, `SecurityMatcherIntegrationTest`.

## Suggested additional test coverage
- No app test renders the list screen to check the stale-response guard end to end (the logic is a request counter in the screen).
- No app test drives `FeeBillAdminActions` (cancel confirmation, hidden cancel with payments).
