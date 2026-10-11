# Feature docs

Flow walkthroughs and test plans for money-related features, written directly from the
current frontend (`src/screens/principal`) and backend (`com.gurukul.fees`, `com.gurukul.payroll`,
`com.gurukul.expenses.infrastructure`, `com.gurukul.reports`) code — not a design spec. Each feature
has a `FLOW.md` (overview, actors, diagram, endpoints, data model, known limitations) and a `TEST.md`
(manual checklist, existing automated coverage, suggested gaps).

Kept separate from `docs/`, which is the public smartgurukul.org website served by GitHub Pages.

- [`fee-structure-setup/`](./fee-structure-setup/FLOW.md) — Fee categories, fee structures (create, edit, re-price), and bill (`StudentFeeAssessment`) generation with a chosen due date.
- [`fee-payment/`](./fee-payment/FLOW.md) — Recording fee payments in the app, payment history, receipts (PDF), reversals, cancelled-bill guards, fee reminders, and the built-but-disabled online UPI payment attempt flow.
- [`fees-overview/`](./fees-overview/FLOW.md) — The admin's bill list and totals, a bill's detail (adjustments, due date, cancelling, recording payments and their history), the family fee screens, a teacher's "My Class Fees", and the dues report.
- [`payroll-runs/`](./payroll-runs/FLOW.md) — Salary structures and the payroll run lifecycle (Draft → Processed → Paid).
- [`payroll-overview/`](./payroll-overview/FLOW.md) — The paid/pending payroll rollup across every run.
- [`infra-expenses/`](./infra-expenses/FLOW.md) — Infrastructure expense request → approve/reject → purchase → pay workflow.
