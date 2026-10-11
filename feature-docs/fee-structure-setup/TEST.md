# Fee Structure Setup & Bill Generation — Test Plan

## Manual test checklist

### Categories
- [ ] Create a category with code `" lab "`: the form shows "Saved as LAB" and the list shows `LAB`.
- [ ] Create `"Tuition_Fee"` when `TUITION_FEE` exists → "A fee category with this code already exists." (409 `FEE_CATEGORY_CODE_EXISTS`). A one-letter code (`"T"`) is refused before sending.
- [ ] Tap a category, rename it and save: the new name shows. Switch "In use" off and save: the row is greyed with "Not in use".
- [ ] On the structure form's category picker, the category not in use no longer appears; on a structure that already has it, its line still shows it (marked "Not in use") and saving keeps it.
- [ ] As a TEACHER, `PUT /api/v1/fee-categories/{id}` → 403.

### Creating a structure
- [ ] Create a structure on a section whose year is written `2026-2027`: the form shows "Academic year: 2026-27" read-only (no year dropdown); the saved structure's year is `2026-27`.
- [ ] A line with amount 0 is accepted. A line with `1.234`, `-5` or blank keeps Create disabled with the amount message. The same category twice → "Each fee category can appear only once."
- [ ] Create a second structure for the same section → "This class already has a fee structure for this academic year. Edit that one instead."
- [ ] Old build: pick a different year in the old dropdown → 400 "This class-section is for academic year …".

### Editing a structure
- [ ] Edit fee lines with "Also update bills…" on, on a structure whose class has one unpaid unadjusted bill, one with a payment and one with a concession: the alert says 1 bill was updated and 2 kept their amount (1 with payments, 1 with adjustments). The unpaid bill's total is the new total.
- [ ] Same with the switch off: every differing bill is listed as "because you chose not to update bills".
- [ ] Back on the detail screen, the lines and total show the new values without reopening.

### Generating bills
- [ ] Generate on a class with 3 active and 1 withdrawn student and no bills: the dialog shows a due date 30 days out, "Create 3 new bills of ₹X each, due <date>?" and "1 withdrawn student won't be billed." Create: "Created 3 new bills. 0 already had one." Each bill has that due date; the detail screen shows "Bills due on <date>".
- [ ] Generate again: "Everyone already has a bill. There's nothing to create." and no confirm button.
- [ ] After editing the structure without re-pricing, the preview names the students whose bill has a different amount.
- [ ] The date picker doesn't allow a date before today. `POST generate-bills` with a past date → 400.
- [ ] Old build: "Generate assessments" on a re-run says "Generated 0 assessments".

### Students joining later
- [ ] With a structure on a `2026-2027` section, admit a new student into it: they get a bill (`2026-27`), due the later of the structure's due date and today + 30 days.
- [ ] Move a student to another section of the same year: still one bill, unchanged.
- [ ] Promote a student into a section of the next year that has a structure: a new bill for that year. Into one with no structure: none. A withdrawn student moved: none.

## Existing automated test coverage
- App: `src/__tests__/feeBills.test.ts` — category code normalisation, pickable categories, line checks (0 allowed, duplicates, 2 decimals, 50-line cap), paise totals, `canonicalAcademicYear`, the Generate confirmation (counts, names, plurals, nobody to bill), the result text and the structure-edit message. `src/__tests__/i18nParity.test.ts` covers the new English/Hindi keys.
- Backend (`Gurukul_bk`, per the spec's testing plan): `FeeCategoryIntegrationTest`, `FeeStructureEditIntegrationTest`, `StudentTransferBillingIntegrationTest`, `FeePaymentIntegrationTest` (legacy generate returns only new bills), `AdminOnlyRulesIntegrationTest` (new ADMIN endpoints 403 for a teacher).

## Suggested additional test coverage
- No app test renders `GenerateBillsDialog` or `FeeStructureFormScreen` (edit mode) end to end.
- A backend test re-pricing a structure while a payment for one of its bills is being recorded (the per-bill lock should serialise them).
