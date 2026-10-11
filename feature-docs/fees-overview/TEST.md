# Fees Overview & My Class Fees — Test Plan

## Manual test checklist
- [ ] As Admin, open Fee Assessments and confirm every student in the school appears, across multiple class-sections (scroll to the end to load further pages of 50).
- [ ] Apply each status filter chip (All/Unpaid/Partial/Overdue/Paid) and confirm the visible list and the summary card's counts match.
- [ ] Search by student name and by roll number and confirm the client-side filter narrows correctly.
- [ ] As a homeroom Teacher, confirm the dashboard shows a "My Class Fees" tile and it opens directly to that teacher's own section with no section picker.
- [ ] As a Teacher who is *not* a homeroom/class teacher of any section, confirm the "My Class Fees" tile does not appear at all.
- [ ] As a Teacher, call `GET /api/v1/class-sections/{id}/fee-status` directly for a section you are **not** the class teacher of — confirm HTTP 403 ("You are not the class teacher of this section").
- [ ] As Admin, call the same endpoint for any section — confirm it succeeds regardless of whether Admin is that section's class teacher.
- [ ] Create a fee assessment, let its due date pass without recording any payment, then check the status filter chips and `reports/dues` — confirm it still shows as "Unpaid," not "Overdue" (status only updates on payment).
- [ ] Make a partial payment on an assessment past its due date, and confirm it now correctly flips to `OVERDUE` (since `computeStatus` runs on `recordPayment`).
- [ ] As a Teacher token, call `GET /api/v1/fee-assessments` directly with a valid `X-School-Id` → 403. STUDENT/PARENT → 403; ADMIN → 200; no token → 401.
- [ ] As a class Teacher, call `GET /api/v1/students/{id}/fee-assessments` for a student in your section → 200; for a student in another section, or an unknown id → 403. A teacher who isn't that student's class teacher → 403.
- [ ] As a Student, the same endpoint for another student's id → 403; as a Parent, an unlinked student's id → 403.
- [ ] An unlisted fee path (e.g. `GET /api/v1/fee-assessments/{id}/anything`) → 403 for TEACHER/STUDENT, 404 for ADMIN.
- [ ] Call `GET /api/v1/reports/dues` as ADMIN (TEACHER/STUDENT → 403, no token → 401) and confirm `totalUnpaid` matches the sum of all Unpaid/Partial/Overdue assessments' remaining dues, and `totalOverdue`/`overdueAssessments` only include assessments whose stored status is `OVERDUE`.
- [ ] A teacher who is class teacher of two different sections — confirm which section "My Class Fees" resolves to (the dashboard only picks the first match), and treat a second-section view as currently unsupported.

## Existing automated test coverage
- `D:\Gurukul\Gurukul_bk\src\test\java\com\gurukul\fees\ClassSectionFeeStatusIntegrationTest.java` — `classTeacherSeesOwnSectionFeesButAnUnrelatedTeacherCannot()`: creates a class-section, assigns a class teacher, generates a fee assessment for a student in it, then asserts: the assigned class teacher can see the section's fee status (200, correct `totalDue`); an unrelated teacher gets HTTP 403 calling the same endpoint; and Admin can see it regardless. This is the authoritative test for the `GET /api/v1/class-sections/{id}/fee-status` ownership rule that backs "My Class Fees."
- `D:\Gurukul\Gurukul_bk\src\test\java\com\gurukul\reports\ReportOverviewIntegrationTest.java` — `duesReportIncludesUnpaidAssessmentAndItsOverdueSubset()`: creates a class-section, fee category, fee structure, and student, generates an assessment, then calls `GET /api/v1/reports/dues` and asserts `totalUnpaid` is at least the assessment's amount and `unpaidAssessments` is non-empty. Covers the dues-report happy path but not the `overdueAssessments`/`totalOverdue` subset specifically, nor the stale-status limitation noted above.

- `Gurukul_bk/src/test/java/com/gurukul/fees/FeeAccessIntegrationTest.java` — `GET /fee-assessments` admin-only (class teacher and student 403, admin 200); per-student bills for the student's class teacher only (another section's student, an unrelated teacher and an unknown id → 403; the student, a linked parent and admin 200); the fee catch-all (403 teacher/student, 404 admin) while teachers keep reading fee categories and structures.
- `Gurukul_bk/src/test/java/com/gurukul/fees/FeePaymentServiceOwnershipTest.java` — `listByStudent`: student self vs other, class teacher vs other teacher vs unknown student, driver 403.
- `Gurukul_bk/src/test/java/com/gurukul/auth/AdminOnlyRulesIntegrationTest.java`, `SecurityMatcherIntegrationTest.java` — `GET /fee-assessments` and `GET /reports/dues` refused for non-admins and without a login, 200 for an admin.

## Suggested additional test coverage
- A test proving the stale-status limitation directly: create an assessment, advance/mock the clock (or set a due date in the past at creation), and assert its status is still `UNPAID`/not `OVERDUE` until a payment is recorded against it — this is currently undocumented in the test suite and is easy to regress either direction (accidentally "fixing" it without updating the docs, or someone assuming it already auto-updates).
- A test for `classSectionId` filtering and pagination on `GET /api/v1/fee-assessments` (supported by the API, `classSectionId` unused by any screen and not directly asserted by any existing test).
- A test for a teacher who is class teacher of more than one section, to define expected behavior (today the frontend just picks the first match; there is no equivalent backend test of this ambiguity).
- A test asserting `GET /api/v1/students/{studentId}/fee-assessments` rejects a PARENT not linked to that student (`FeeAccessIntegrationTest` covers only the linked parent's 200).
