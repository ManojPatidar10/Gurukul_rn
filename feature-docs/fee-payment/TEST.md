# Fee Payments — Recording, History, Receipts, Reversal, and the (Disabled) Online UPI Attempt — Test Plan

## Manual test checklist

### Recording a payment in the app (admin)
- [ ] Admin → Fees → Assessments → an unpaid bill: **Record payment** is shown; on a fully paid bill it isn't. A student or parent never sees it.
- [ ] The form opens with the amount prefilled to the remaining due, Cash selected and today's date.
- [ ] Cash, no reference → Save → the receipt opens with the receipt number, student, class, method Cash, "Received by <admin name>", the amount and "Balance due after this payment".
- [ ] Back → the bill shows the new paid total and status, and the payment is at the top of its payment history.
- [ ] UPI / Bank transfer / Cheque with no reference → the inline "Enter the UTR, cheque or transaction number…" error; nothing sent.
- [ ] Amount `15,000` and `15000.50` are accepted; `100.555`, `1e5`, `-5`, `0` and more than the remaining due show the matching inline error.
- [ ] The date picker doesn't allow a future date or one more than 400 days back.
- [ ] Reference ` utr 1234 5 ` is saved as `UTR12345`.
- [ ] Tap Save twice quickly → one payment (the button is disabled while saving).
- [ ] Airplane mode, Save (fails), airplane mode off, Save again without editing → still one receipt.
- [ ] Slow network: Save, then press Back (header, Android Back, iOS swipe) before the reply → "Please wait while the payment is saved." and the screen stays; the receipt opens when the reply arrives. The same on Reverse payment.
- [ ] Record UPI with the same UTR on a sibling's bill → "Reference already used" alert naming the existing receipt, student, date and amount → **Record anyway** → recorded. Cancel → nothing recorded.
- [ ] The same number with a different method → recorded without a warning. Cash references are never checked.

### Receipt and PDF
- [ ] Share receipt (PDF) → the share sheet opens with `fee-receipt-<receipt-slug>.pdf`: logo (or school name), the rows above, "Amount received ₹…", footer with the generation date.
- [ ] A Hindi student name renders correctly in the PDF.
- [ ] Done / back returns to where the receipt was opened from (for a parent: the bill or Payment history, never an admin screen).
- [ ] A payment recorded before this release shows no "Received by" or balance row (no crash).

### Payment history
- [ ] Student: My Fees → **Payment history** lists every payment across years (academic year on each row); My Fees → a bill → its payments; tap → receipt → Share PDF. No Record or Reverse buttons.
- [ ] Parent: Child → Fees → a row opens the bill (new) → payments → receipt. **Payment history** lists every year.
- [ ] Admin: bill → "All payments for this student".
- [ ] Empty: "No payments recorded yet."; offline: the error with Retry.
- [ ] Bill detail offline (go back to it from a receipt with the network off) → "Could not refresh this bill…" with Retry above the totals; network on → Retry → the notice goes and the totals are current.
- [ ] Teacher: no route reaches payments; a forged `GET /fee-assessments/{id}/payments` → 403.

### Reversing (admin)
- [ ] Receipt → **Reverse payment**: Cash offers Entered by mistake and Refunded only; Cheque/UPI/Bank also offer Cheque or transfer bounced.
- [ ] Reason under 10 characters → inline error; the counter counts trimmed characters.
- [ ] Refund without a method or reference → inline errors; refund date limited to payment date…today.
- [ ] Confirm alert names the receipt, amount and student → Reverse → toast "Payment reversed.", the receipt shows **CANCELLED** with type, date, who and reason (and refund method, reference, date for a refund); Reverse is gone.
- [ ] Back → the bill's paid total dropped by the amount and the status was recomputed; the history row is struck through with **Cancelled**.
- [ ] The shared PDF of a reversed payment has the CANCELLED watermark and the red cancellation box.
- [ ] Reverse the same payment from a second phone → toast "This payment was already reversed." and back to the refreshed receipt.
- [ ] Record → reverse (CORRECTION) → record again: the new receipt number is the next one; the cancelled number is never reissued. The same UTR can now be recorded without a warning.
- [ ] Finance summary: after a CORRECTION/BOUNCED, inflow is back to the value before the payment; after a REFUND, inflow is unchanged and outflow rose by the amount.

### API checks (backend)
- [ ] `POST /fee-payments` with `amount: 99.999` → 400, nothing written; `100.100` → stored 100.10.
- [ ] Date: IST today + 1 → 400; today − 401 → 400; today − 400 → 200; omitted → IST today.
- [ ] `Idempotency-Key: abc` → 400. Same key twice → same id and receipt number, one ledger row, `totalPaid` up once. Same key, different amount → 409 `IDEMPOTENCY_KEY_REUSED`. No key, two identical posts → two payments.
- [ ] Reverse twice with the same key → both 200, reversed once; a second reverse with a new key → 409 `ALREADY_REVERSED`. BOUNCED on cash → 400.
- [ ] Access matrix for GET payment, both lists, the PDF, record and reverse: ADMIN 200/200; class teacher and other teacher 403/403; own student and linked parent 200 reads, 403 writes; other student and unlinked parent 403; anonymous 401; another school's admin on school A's ids 404.

### Online UPI flow (backend and screen work, but nothing in the UI opens the screen)
- [ ] Confirm the "Pay Fees" button on `FeeAssessmentDetailScreen` only ever shows the "coming soon" toast and never navigates, for every role/fully-paid combination.
- [ ] Confirm no in-app path (menus, deep links surfaced in the UI, notifications) routes to the `'PayFees'` screen.
- [ ] Create a payment request for a school with no UPI ID set and verify 409 `UPI_NOT_CONFIGURED` ("This school has not set up UPI payments yet."), no `PaymentAttempt` row, and (driving `PayFees` by deep link) the app shows that message with a **Back** button instead of **Try again**.
- [ ] Set a UPI ID but no bank account or IFSC on the school: the payment request succeeds, `payeeVpa` equals the UPI ID, and `upiUri` contains `pa=<that id>`.
- [ ] As a STUDENT, verify `accountNumber` and `ifsc` in the payment-request response are `null`; as an ADMIN, verify they are filled.
- [ ] Create a payment request for an already fully-paid assessment and verify 400 ("This fee assessment is already fully paid").
- [ ] Create a payment request and verify a `PaymentAttempt` is persisted with status `INITIATED` and a `transactionRef` starting with `FEE`, before any simulated UPI-app return.
- [ ] Verify `GET /api/v1/fee-assessments/{id}/payment-attempts/pending` returns that attempt while `INITIATED`/`PENDING`, and nothing once it has a final result.
- [ ] Post `VERIFIED` or `INITIATED` as a result → 400.
- [ ] Post `RESPONSE_SUCCESS` with a UPI transaction id → 200. The assessment stays unpaid (`totalPaid` unchanged, no `FeePayment`, no ledger entry).
- [ ] Then post `CANCELLED` for the same attempt → 409 `PAYMENT_ATTEMPT_ALREADY_REPORTED`, and the stored transaction id is unchanged. Post `RESPONSE_SUCCESS` again → 200, nothing changes.
- [ ] Post `PENDING` with some evidence, then `RESPONSE_SUCCESS` with different evidence → 200, status `RESPONSE_SUCCESS`, the first evidence kept, only empty fields filled.
- [ ] As a TEACHER, call payment-request, attempts, pending and result → 403 each. An unlinked PARENT → 403; a linked PARENT → 200.
- [ ] (Driving `PayFees` directly) Double-tap Pay Now → one payment request. With the attempts check failing (offline) → the error stage, no request made. Once a request exists, the amount shown is the server's.
- [ ] A reported payment confirmed by an admin (recording with the attempt's `transactionRef`); recording it again → 400; after that payment is reversed, it can be confirmed again.
- [ ] (Driving `PayFees` by deep link) Report "Yes, it succeeded", tap Done, then Pay Now again: a "Payment already reported" warning appears (the fee still shows its full due until an admin records the payment). With only an `INITIATED`/`PENDING` attempt, the "Payment already in progress" warning appears instead. Both offer Cancel and Pay Again.
- [ ] (`PayFees`) An admin records the payment for a reported attempt (it becomes `VERIFIED`), then the payer reports success again from the manual card: the result card shows the success title with "The school has confirmed this payment.", not an empty card.
- [ ] (`PayFees`) Report "Yes, it succeeded" with the reply lost (e.g. airplane mode after the request leaves), then "No, cancelled" from the manual card: the 409 is replaced by the stored "Payment response received" result with Done, never Try again. With the attempts lookup also failing, the error shows Back only and no manual card.

### Payment Settings (ADMIN)
- [ ] The UPI ID field and hint say families can pay by UPI only once it is set, and that the app never guesses a UPI ID. With the field empty, the warning shows.
- [ ] The screen's hint and the Fees hub's "Payment Settings" description say families pay to the school's UPI ID and the bank details are for records, not that fees go into the bank account.

### Old builds
- [ ] The current Play Store build against the new backend: fee screens render, nothing calls the new endpoints.

## Existing automated test coverage
- App (`npm test`):
  - `src/__tests__/money.test.ts` — `parseRupees` (grouped, ₹/Rs prefixes, refuses >2 decimals, `1e5`, `0x10`, signs, `.`, `5.`), paise maths (`sumRupees([0.1, 0.2]) === 0.3`), `formatRupees` (Indian grouping, `'always'` decimals, no symbol, negatives, rounding, missing values), `rupeesInputValue`.
  - `src/__tests__/feePayments.test.ts` — methods and labels, reference rule and normalisation, 400-day date bounds, `validateRecordPayment`, `reversalTypesFor('CASH')` without BOUNCED, `validateReversal` (reason, refund fields, refund date range), `duplicateReferenceInfo`, `refreshedBill`, the PDF file name.
  - `src/__tests__/idempotencyKey.test.ts` — UUID v4 in the server's key format, distinct per call, with and without `crypto.randomUUID`.
  - `src/__tests__/feeStructureLines.test.ts` — fee-structure line validation (shared amount parser, duplicate category).
  - `src/__tests__/apiClientHeaders.test.ts` — `Idempotency-Key` is sent, and re-sent unchanged on the 401 refresh retry.
  - `src/__tests__/errorMessage.test.ts` — `DUPLICATE_REFERENCE`, `ALREADY_REVERSED`, `IDEMPOTENCY_KEY_REUSED`, `UPI_NOT_CONFIGURED` and `PAYMENT_ATTEMPT_ALREADY_REPORTED` wording; `i18nParity.test.ts` — every new key in en and hi.
  - `src/__tests__/feePaymentErrors.test.ts` — `UPI_NOT_CONFIGURED` and `PAYMENT_ATTEMPT_ALREADY_REPORTED` offer Back, everything else Try again.
  - `src/__tests__/feePaymentAttempts.test.ts` — the result card per status including `VERIFIED`, the Pay Now warning for a reported success or an attempt in progress, finding the attempt by reference.
- Backend (`Gurukul_bk`): `FeePaymentRecordingIntegrationTest`, `FeePaymentReversalIntegrationTest`, `FeePaymentAccessIntegrationTest`, `FeeReceiptPdfIntegrationTest`, `finance/LedgerReversalIntegrationTest`, `common/IndianRupeesTest`, `common/IdempotencyKeysTest`, plus `FeePaymentIntegrationTest`, `PaymentIntegrityIntegrationTest`, `PaymentAttemptIntegrationTest` (attempt lifecycle, the payer-report rules, roles, UPI ID requirement), `FeeAccessIntegrationTest`, `FeePaymentServiceOwnershipTest`, `SecurityMatcherIntegrationTest`, `AdminOnlyRulesIntegrationTest`.

## Suggested additional test coverage
- Screen-level tests for RecordPayment (key kept on retry, cleared on edit; the duplicate alert resends with `confirmDuplicateReference`) and ReversePayment (no BOUNCED for cash; ALREADY_REVERSED goes back).
- A frontend test that "Pay Fees" only toasts and never navigates, and one that drives `PayFeesScreen` itself (the error stage and its Back/Try again button).
- Concurrent `recordAttemptResult` calls for one reference.
