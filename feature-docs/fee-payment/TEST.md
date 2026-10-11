# Fee Payment Recording & the (Disabled) Online Payment Attempt — Test Plan

## Manual test checklist

### Recording a payment (ADMIN)
- [ ] Record a partial payment (amount < remaining due) and verify assessment status becomes `PARTIAL` and `totalPaid` increases by exactly the paid amount.
- [ ] Record enough additional payments to fully cover `totalDue` and verify status flips to `PAID`.
- [ ] Attempt to record a payment whose amount exceeds the current remaining due and verify the API returns 400 ("Payment amount exceeds remaining due").
- [ ] Record a partial payment for an assessment whose `dueDate` is in the past; verify status becomes `OVERDUE` rather than `PARTIAL`.
- [ ] Verify each recorded payment returns a receipt number (`FeePaymentResponse.receiptNumber`), and `GET /api/v1/fee-payments/{id}` returns the same one.
- [ ] As a TEACHER, STUDENT or PARENT, call `POST /api/v1/fee-payments` and verify 403.
- [ ] Record a payment with `paymentReference` set to a reported attempt's `transactionRef`: the attempt becomes `VERIFIED`. Recording a second payment with the same reference returns 400 ("A payment has already been recorded for this payment attempt").
- [ ] Confirm cross-school isolation: a payment/assessment created under one `X-School-Id` is not visible or actionable under another school's header.
- [ ] Cancel an unpaid bill, then record a payment on it → 409 `FEE_BILL_CANCELLED` ("This bill was cancelled, so it can't be changed or paid."), and nothing is written (no ledger entry, `totalPaid` unchanged).
- [ ] A `paymentReference` of 101 characters → 400.

### Receipts (`GET /api/v1/fee-payments/{id}`)
- [ ] ADMIN → 200. The student who owns it → 200. A different student → 403. A linked parent → 200. An unlinked parent → 403. A TEACHER → 403. An id from another school → 404.

### Online UPI flow (backend and screen work, but nothing in the UI opens the screen)
- [ ] As a student or parent, a bill with money owed shows the "How to pay" card and no "Pay Fees" button; a paid or cancelled bill shows neither.
- [ ] Confirm no in-app path (menus, deep links surfaced in the UI, notifications) routes to the `'PayFees'` screen.
- [ ] Create a payment request for a school with no UPI ID set and verify 409 `UPI_NOT_CONFIGURED` ("This school has not set up UPI payments yet."), no `PaymentAttempt` row, and (driving `PayFees` by deep link) the app shows that message with a **Back** button instead of **Try again**.
- [ ] Set a UPI ID but no bank account or IFSC on the school: the payment request succeeds, `payeeVpa` equals the UPI ID, and `upiUri` contains `pa=<that id>`.
- [ ] As a STUDENT, verify `accountNumber` and `ifsc` in the payment-request response are `null`; as an ADMIN, verify they are filled.
- [ ] Create a payment request for an already fully-paid assessment and verify 400 ("This fee assessment is already fully paid").
- [ ] Create a payment request and verify a `PaymentAttempt` is persisted with status `INITIATED` and a `transactionRef` starting with `FEE`, before any simulated UPI-app return.
- [ ] Verify `GET /api/v1/fee-assessments/{id}/payment-attempts/pending` returns that attempt while `INITIATED`/`PENDING`, and nothing once it has a final result.
- [ ] Post `VERIFIED` or `INITIATED` as a result → 400. A 256-character `upiTransactionId` → 400.
- [ ] Create a payment request on a cancelled bill → 409 `FEE_BILL_CANCELLED`, no attempt saved.
- [ ] Post `RESPONSE_SUCCESS` with a UPI transaction id → 200. The assessment stays unpaid (`totalPaid` unchanged, no `FeePayment`, no ledger entry).
- [ ] Then post `CANCELLED` for the same attempt → 409 `PAYMENT_ATTEMPT_ALREADY_REPORTED`, and the stored transaction id is unchanged. Post `RESPONSE_SUCCESS` again → 200, nothing changes.
- [ ] Post `PENDING` with some evidence, then `RESPONSE_SUCCESS` with different evidence → 200, status `RESPONSE_SUCCESS`, the first evidence kept, only empty fields filled.
- [ ] As a TEACHER, call payment-request, attempts, pending and result → 403 each. An unlinked PARENT → 403; a linked PARENT → 200.
- [ ] (Driving `PayFees` by deep link) Report "Yes, it succeeded", tap Done, then Pay Now again: a "Payment already reported" warning appears (the fee still shows its full due until an admin records the payment). With only an `INITIATED`/`PENDING` attempt, the "Payment already in progress" warning appears instead. Both offer Cancel and Pay Again.
- [ ] (`PayFees`) An admin records the payment for a reported attempt (it becomes `VERIFIED`), then the payer reports success again from the manual card: the result card shows the success title with "The school has confirmed this payment.", not an empty card.
- [ ] (`PayFees`) Report "Yes, it succeeded" with the reply lost (e.g. airplane mode after the request leaves), then "No, cancelled" from the manual card: the 409 is replaced by the stored "Payment response received" result with Done, never Try again. With the attempts lookup also failing, the error shows Back only and no manual card.

### Payment Settings (ADMIN)
- [ ] The UPI ID field and hint say families can pay by UPI only once it is set, and that the app never guesses a UPI ID. With the field empty, the warning shows; with one typed, "UPI payments go to: <id>" shows.
- [ ] The screen's hint says families can't pay fees in the app yet and doesn't claim fees go into the bank account.
- [ ] With the network off, open the screen: the error shows with Retry and Save is disabled. Retry once online loads the settings.
- [ ] A school with no holder name saved: the field is empty with the school's name as a placeholder (not filled in).
- [ ] Change the account number without retyping it in "Confirm bank account number": the mismatch message shows and Save is refused. Retype it: Save asks "Save account XXXX…  and UPI ID …?"; Cancel saves nothing.

### Reminders (`FEE_DUE`)
- [ ] A bill due in 3 days for a student with a linked parent: the parent gets the push (English then Hindi, `₹4,000`-style amounts), the student doesn't. A student with no linked parent: their own login gets it, and tapping it opens My Fees.
- [ ] No reminder for a cancelled bill, a bill of a withdrawn student, or any bill of a deactivated school.

## Existing automated test coverage
- Backend (`D:\Gurukul\Gurukul_bk\src\test\java\com\gurukul\fees\`): `FeePaymentIntegrationTest` (manual recording: partial, full, overpay 400), `PaymentAttemptIntegrationTest` (attempt lifecycle, the payer-report rules, roles, UPI ID requirement), `PaymentIntegrityIntegrationTest` (admin confirmation of an attempt, a later report on a `VERIFIED` attempt), `FeePaymentServiceOwnershipTest` (`assertCanPayOrRecord` per role).
- App: `src/__tests__/errorMessage.test.ts` (both new error codes map to their translated messages), `src/__tests__/feePaymentErrors.test.ts` (`UPI_NOT_CONFIGURED` and `PAYMENT_ATTEMPT_ALREADY_REPORTED` offer Back, everything else Try again), `src/__tests__/feePaymentAttempts.test.ts` (result card per status including `VERIFIED`, the Pay Now warning for a reported success or an attempt in progress, finding the attempt by reference), `src/__tests__/upiResponseParser.test.ts`, `src/__tests__/i18nParity.test.ts`.

## Suggested additional test coverage
- No frontend test asserts that `FeeAssessmentDetailScreen.tsx` shows the "How to pay" card and no way into `PayFeesScreen` — worth a regression test so a future change doesn't silently re-enable online payment without a decision.
- No app test drives `FeePaymentSettingsScreen` (load failure, confirm-number mismatch, the save confirmation); `paymentSettingsConfirmText` and `maskAccountNumber` are covered in `src/__tests__/feeBills.test.ts`.
- No test drives `PayFeesScreen` itself (rendering the error stage and its Back/Try again button).
