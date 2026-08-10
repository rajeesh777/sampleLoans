# Product Requirements Document — Isthooi Savings Group Fund Manager

| Field | Value |
|---|---|
| Product name | Isthooi (package name: `fund-manager-app`) |
| Document version | 1.0 |
| Date | 6 August 2026 |
| Status | As-built specification + forward requirements |
| Repository branch | `dev` |
| Author | Engineering |

### How to read this document

This PRD is written against the **code as it exists today**, not against an idealised design. Sections 8–10 describe behaviour that is implemented and verifiable in source. Section 13 catalogues places where the implementation contradicts itself, contradicts its own UI copy, or contradicts `CLAUDE.md`; those are defects to be resolved, not requirements to be preserved. Where a requirement is aspirational rather than built, it is tagged **[PROPOSED]**.

---

## 1. Executive Summary

Isthooi is a browser-based fund manager for small informal savings groups ("chit"-style committees) common in India. A fixed roster of members contributes a fixed amount every Sunday for a 52-week cycle. The pooled cash is lent back out to members as short-term loans that carry a flat 10% upfront fee. At the end of the cycle the pool is dissolved: every member gets back what they actually paid in, plus an equal share of all fee income earned, minus any loan principal they still owe.

The application digitises what is normally tracked in a paper notebook or a WhatsApp group: who paid, who didn't, who owes, who borrowed, and what everyone is owed at year end. It runs entirely client-side with `localStorage` as the system of record, so it works offline and requires no server, no account provisioning, and no hosting cost. An optional Supabase backup path exists.

**Primary value proposition:** replace an error-prone shared spreadsheet with a purpose-built ledger that enforces the group's own rules (dues before current week, no loans for defaulters) and generates the year-end settlement automatically.

---

## 2. Problem Statement

Informal savings groups fail for administrative reasons, not financial ones:

1. **Collection tracking is manual and disputed.** The treasurer records payments in a notebook; members dispute entries months later with no audit trail.
2. **Arrears go unnoticed until they are severe.** Nobody computes "who has missed how many weeks" until it is too late to act.
3. **Loan accounting is ad hoc.** Interest/fee arrangements are agreed verbally; repayment schedules are not tracked against a term.
4. **Year-end settlement is a multi-hour arithmetic exercise** that the treasurer performs alone, which is precisely where trust breaks down.
5. **Chasing defaulters is socially awkward** and inconsistently done.

## 3. Product Vision

> A savings group should be able to run a full 52-week cycle — collection, lending, arrears management, and year-end payout — from a single screen on a phone, with the arithmetic guaranteed correct and every rule enforced by the software rather than by the treasurer's memory.

---

## 4. Target Users

The product currently ships a **single, undifferentiated user role**. Every authenticated user has full administrative capability. The personas below describe intent; Section 13 flags the absence of a permission model as a defect.

### 4.1 Persona A — The Treasurer / Organiser (primary)

- Runs the collection every Sunday evening (the app's copy assumes ~8:00 PM).
- Needs: fast bulk marking of payments, immediate visibility of who has not paid, one-tap reminders, loan issuance with automatic fee maths, and a defensible year-end statement per member.
- Success looks like: the entire Sunday collection recorded in under five minutes, with zero arithmetic performed by hand.

### 4.2 Persona B — The Member (secondary)

- Contributes weekly, may borrow occasionally.
- Needs: to see their own payment history, their outstanding dues, their loan balance, and their projected year-end payout.
- Success looks like: never having to ask the treasurer "how much do I owe?"

### 4.3 Persona C — The Borrower (a member in a particular state)

- Has an active loan; repays a weekly installment alongside their regular contribution.
- Needs: a clear view of which weeks of the loan they have paid, how much principal remains, and how many weeks of the term are left.

---

## 5. Scope

### 5.1 In scope (built)

- Member roster management (create, edit, delete).
- 52-week (configurable 1–104) Sunday calendar generation.
- Weekly contribution collection with payment method, arrears settlement, and advance payment.
- Loan origination with a fixed 10% upfront fee and 10-week term.
- Flexible loan repayment including early closure.
- Arrears/defaulter classification and WhatsApp escalation.
- Per-loan transaction ledger.
- Year-end settlement calculation.
- Week finalisation ("cease") and a global edit lock.
- JSON backup, restore, and reset to demo data.
- Optional, best-effort Supabase state backup.

### 5.2 Out of scope (explicitly not built)

- Real payment processing or UPI transaction verification. All payment recording is manual attestation by the operator.
- Bank/UPI reconciliation or statement import.
- Multi-group / multi-tenant operation. One browser profile holds exactly one group.
- Server-side authentication, user accounts, or password management.
- Automated notifications. WhatsApp messages are composed and handed to the OS via a `wa.me` deep link; the operator must press send.
- Automatic week advancement. `currentWeekNum` never changes on its own.
- Interest accrual, penalties, or late fees beyond the flat upfront loan fee.
- Audit log / change history.
- Localisation. The UI is English with Indian Rupee (`en-IN`) formatting hardcoded.
- Automated test suite.

---

## 6. Glossary

| Term | Definition |
|---|---|
| **Cycle** | The full savings period, default 52 weeks starting from a configured Sunday. |
| **Week** | One Sunday collection event, numbered 1..N. |
| **Contribution** | The fixed weekly amount each member owes (`weeklyAmount`, default ₹1,000). |
| **Collection record** | The per-member, per-week row holding contribution and loan-installment status. |
| **Dues / arrears** | Unpaid contributions from weeks strictly before the week being worked on. |
| **Advance payment** | A lump sum applied forward across future weeks. |
| **Requested amount** | The loan principal the borrower asks for and must repay in full. |
| **Upfront fee** | 10% of the requested amount, retained by the group at disbursal. This is the group's profit. |
| **Disbursed amount** | Requested amount minus upfront fee — the cash the borrower actually receives (90%). |
| **Weekly installment** | Requested amount ÷ 10, the per-Sunday loan repayment. |
| **Ceased week** | A week finalised by an administrator; no further edits permitted. Irreversible. |
| **Edit lock** | A global flag that disables mutation controls across collection screens. |
| **Treasury cash** | Notional cash on hand: contributions + fees + principal repaid − principal disbursed. |
| **Profit dividend** | Each member's equal 1/Nth share of total fee income at settlement. |

---

## 7. Domain Model / Data Dictionary

The entire application state is a single JSON object persisted under the `localStorage` key `ISTHOOI_APP_STATE_V2`.

### 7.1 Root state

| Field | Type | Default | Notes |
|---|---|---|---|
| `groupName` | string | `"Isthooi Savings Group"` | Displayed in headers and WhatsApp messages. |
| `weeklyAmount` | number | `1000` | Configurable, minimum ₹100. |
| `currentWeekNum` | number | `3` | 1..52. **Never advanced automatically**; there is no UI to change it. |
| `startDate` | `YYYY-MM-DD` | `"2026-01-04"` | Intended to be the first Sunday of the cycle. |
| `totalWeeks` | number | `52` | Configurable 1–104. Honoured only by Settings; the rest of the UI hardcodes 52 (see D-01). |
| `members` | array | 10 seeded | See 7.2. |
| `weeks` | object keyed by week number | 52 entries | See 7.3. |
| `loans` | array | 1 seeded | See 7.5. |
| `groupUpiVpa` | string | `"isthooi@upi"` | Pay-to address injected into reminder messages. |
| `groupNotes` | string | `"Collection every Sunday around 8:00 PM."` | Free text. |
| `editLocked` | boolean \| undefined | **absent on a fresh install** | Created on first toggle. Treat `undefined` as `false`. |

A second, independent key `ISTHOOI_LOGGED_IN_MEMBER` stores the logged-in member object in plaintext. It is not part of `state` and is not exported in backups.

### 7.2 `members[]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | Seeded `m1`..`m10`; runtime `m{Date.now()}`. |
| `name` | string | Full name. **The first whitespace-delimited token is the login username.** |
| `phone` | string | Free text, e.g. `+91 9876543210`. Sanitised to digits for `wa.me` links. |
| `upiId` | string | Display only; not validated. |
| `avatarColor` | string (hex) | Chosen from a fixed 10-colour palette. |

### 7.3 `weeks[weekNum]`

| Field | Type | Notes |
|---|---|---|
| `weekNum` | number | 1-indexed. |
| `date` | `YYYY-MM-DD` | Generated Sunday date. |
| `displayDate` | string | `en-IN` long form, e.g. `4 Jan 2026`. |
| `collections` | object keyed by `memberId` | See 7.4. |
| `ceased` | boolean | Absent until the week is finalised. |
| `ceaseDate` | `YYYY-MM-DD` \| null | Stamped when ceased. |

### 7.4 `weeks[w].collections[memberId]`

| Field | Type | Default | Notes |
|---|---|---|---|
| `paid` | boolean | `false` | Contribution settled for this week. |
| `amount` | number | `1000` | Amount recorded. Seeded as a literal `1000`, not from `weeklyAmount`. |
| `paymentMethod` | `UPI` \| `Cash` \| `Bank` | `UPI` | Not validated against an enum in code. |
| `paidAt` | `YYYY-MM-DD` \| null | `null` | UTC-derived stamp. |
| `loanInstallmentPaid` | boolean | `false` | Loan installment settled for this week. |
| `loanInstallmentAmount` | number | `0` | Amount of that installment. |
| `loanInstallmentPaidAt` | `YYYY-MM-DD` \| null | `null` | |

**Structural limitation.** The collection record carries a single `loanInstallmentPaid` flag per member per week. It is **not keyed by loan id**, so a member holding two concurrent active loans cannot have one installment marked paid and the other unpaid in the same week. See D-05.

### 7.5 `loans[]`

| Field | Type | Notes |
|---|---|---|
| `id` | string | `loan-{Date.now()}`. |
| `memberId` | string | Borrower. |
| `nickname` | string | Purpose label, e.g. `Festival Advance`. Defaults to `General Advance` / `Loan` depending on entry path. |
| `requestedAmount` | number | Principal. **This is what must be repaid in full.** |
| `disbursedAmount` | number | `requestedAmount − upfrontFee` (90%). |
| `upfrontFee` | number | `round(requestedAmount × 0.1)`. Group profit. |
| `startWeekNum` | number | Week the loan begins. |
| `termWeeks` | number | Fixed at `10` by both creation paths. |
| `weeklyInstallment` | number | `ceil(requestedAmount / 10)`. |
| `repaidAmount` | number | Running total of principal repaid. |
| `status` | `ACTIVE` \| `REPAID` | Derived from `repaidAmount >= requestedAmount`. |
| `createdAt` | `YYYY-MM-DD` | |
| `isFullyRepaid` | boolean | Written opportunistically by repayment handlers; absent on seeded loans. Redundant with `status`. |

---

## 8. Functional Requirements

### 8.1 Authentication & Session (`AUTH`)

| ID | Requirement | Status |
|---|---|---|
| FR-AUTH-01 | The application is gated: no screen other than Login is reachable without a logged-in member. | Built |
| FR-AUTH-02 | A user authenticates by entering a **username equal to the first token of their full name** (case-insensitive) and a password. | Built |
| FR-AUTH-03 | The password is the shared literal `abcd` for every member. | Built (demo-grade) |
| FR-AUTH-04 | The login screen displays a clickable chip per member that auto-fills the username. | Built |
| FR-AUTH-05 | The password field offers a show/hide toggle. | Built |
| FR-AUTH-06 | Validation errors: missing field → "Please enter both username and password"; unknown user → "Member not found. Use your first name as username."; wrong password → "Incorrect password. (Hint: abcd)". | Built |
| FR-AUTH-07 | On success the member object is persisted to `localStorage` and the active tab resets to Dashboard. | Built |
| FR-AUTH-08 | Logout clears the session key and returns the user to Login. | Built |
| FR-AUTH-09 | The session never expires. | Built |
| FR-AUTH-10 | **[PROPOSED]** Introduce two roles — Administrator and Member — and restrict Settings, member CRUD, loan origination, edit lock, import, and reset to Administrator. | Not built (see D-02) |
| FR-AUTH-11 | **[PROPOSED]** Per-member credentials with, at minimum, a hashed password and no credential disclosure in error text or UI copy. | Not built |

### 8.2 Navigation & Application Shell (`NAV`)

| ID | Requirement | Status |
|---|---|---|
| FR-NAV-01 | A persistent header shows the group brand, member count, weekly amount, the logged-in member's name, and the current week. | Built |
| FR-NAV-02 | The desktop tab bar exposes six destinations: Dashboard, Contributions, Loan Collections, Year-End, Members, Settings. | Built |
| FR-NAV-03 | The mobile bottom bar exposes three destinations: Dashboard, Contributions, Year-End. | Built |
| FR-NAV-04 | An overdue pill appears in the header when at least one member has arrears, coloured amber normally and rose when any member is blocked. | Built |
| FR-NAV-05 | The Loan Ledger screen is reachable from the Dashboard's "Open Full Ledger" action. | Built |
| FR-NAV-06 | **[PROPOSED]** Add Loan Ledger to the primary tab bar; it is currently discoverable only via the Dashboard. | Not built (D-03) |
| FR-NAV-07 | **[PROPOSED]** Restore a Defaulters destination, or remove the two controls that route to it. Both currently render a blank screen. | Not built (D-04) |

### 8.3 Dashboard (`DASH`)

| ID | Requirement | Status |
|---|---|---|
| FR-DASH-01 | Display a collection banner for the current week with its date and a link to the full ledger. | Built |
| FR-DASH-02 | Display a progress bar showing paid members over total members and rupees collected against target. | Built |
| FR-DASH-03 | Display four KPI cards: Total Treasury Cash, 10% Profit Pool, Active Loans Outstanding, Overdue Member count (with blocked count as subtext). | Built |
| FR-DASH-04 | Display cycle progress as a percentage of 52 weeks. | Built |
| FR-DASH-05 | Display a static legend of the 3-week default rule with its four escalation tiers. | Built |
| FR-DASH-06 | Display a loan portfolio summary: active count, outstanding principal, fee income, repaid count, and a warning listing loans with two or fewer weeks of term remaining. | Built |
| FR-DASH-07 | List every member with outstanding dues, showing missed week numbers and total owed (arrears + active loan liability), each with a WhatsApp escalation action. | Built |
| FR-DASH-08 | List members in good standing as chips. | Built |
| FR-DASH-09 | Raise a prominent alert banner when any member has reached three or more unpaid weeks. | Built |

### 8.4 Sunday Contributions (`CONT`)

The weekly collection workspace. This is the screen the treasurer uses live during collection.

| ID | Requirement | Status |
|---|---|---|
| FR-CONT-01 | Provide a horizontally scrollable ribbon of week pills for week selection, defaulting to the current week. | Built |
| FR-CONT-02 | Show the selected week's header with formatted date, and a CEASED badge with cease date where applicable. | Built |
| FR-CONT-03 | Provide a filter toggle cycling All ⇄ Unpaid. | Built |
| FR-CONT-04 | Provide a "Mark All Paid" bulk action for the selected week. | Built |
| FR-CONT-05 | Render one card per member showing avatar, name, arrears status badge, phone, and UPI id. | Built |
| FR-CONT-06 | Where a member has unpaid weeks **strictly before** the selected week, render a Pending Dues panel listing each due week with its amount and the total. | Built |
| FR-CONT-07 | **Dues-first enforcement:** the current-week "Mark Paid" and "Advance Pay" controls are disabled while the member has any outstanding dues. | Built |
| FR-CONT-08 | The Pay Dues modal accepts any amount up to the total due and previews, before confirmation, exactly which weeks the payment clears — labelling any week that would be only partially covered. | Built |
| FR-CONT-09 | Dues are allocated greedily, oldest unpaid week first. | Built |
| FR-CONT-10 | Provide a payment-method selector per member per week: UPI, Cash, Bank Transfer. | Built |
| FR-CONT-11 | Provide a toggle to mark the selected week paid or unpaid, stamping `paidAt` on transition to paid and clearing it on transition to unpaid. | Built |
| FR-CONT-12 | The Advance Payment modal accepts a lump sum, previews the forward week coverage (up to 10 rows), and records payment across those weeks. | Built |
| FR-CONT-13 | Provide a per-member WhatsApp reminder composing the week, the contribution due, any loan installment due, the total, an arrears warning when more than one week is unpaid, and the group UPI address. | Built |
| FR-CONT-14 | All mutation controls are disabled when the selected week is ceased or the global edit lock is on, with an explanatory tooltip. | Built |
| FR-CONT-15 | **[PROPOSED]** Persist the true amount paid per week so a partial dues payment does not mark the week fully settled. | Not built (D-06) |

### 8.5 Loan Collections (`LOAN`)

Loan servicing and origination, scoped to a selected week.

| ID | Requirement | Status |
|---|---|---|
| FR-LOAN-01 | Provide the same week-pill selector as Contributions. | Built |
| FR-LOAN-02 | Provide a view toggle between Active Loans and Closed Loans. | Built |
| FR-LOAN-03 | In the active view, render **one card per active loan**, so a member with two loans produces two cards. | Built |
| FR-LOAN-04 | Each active card shows borrower identity, loan nickname, outstanding principal, repaid-of-requested, weeks remaining in term, and a status chip (`CLOSED`, `N WKS LEFT`, or amount due). | Built |
| FR-LOAN-05 | Loans with two or fewer weeks of term remaining are visually flagged as urgent. | Built |
| FR-LOAN-06 | Provide a three-state filter cycling All → Unpaid → Paid. | Built |
| FR-LOAN-07 | The repayment modal accepts any amount up to the outstanding balance, prefilled at the lesser of ₹5,000 and the balance, and previews the resulting balance, announcing when the payment closes the loan. | Built |
| FR-LOAN-08 | Repayment supports **early closure** — a borrower may repay more than one installment at a time, or the full balance at once. | Built |
| FR-LOAN-09 | A loan whose `repaidAmount` reaches `requestedAmount` transitions to `REPAID` automatically. | Built |
| FR-LOAN-10 | The closed view lists repaid loans with requested, disbursed, total repaid, a completed progress bar, and a detail grid (installment, term, group profit, completion date). | Built |
| FR-LOAN-11 | Provide loan origination via a modal with fields: borrower (dropdown), nickname (optional free text), requested amount (numeric, default ₹10,000). | Built |
| FR-LOAN-12 | The origination modal displays a live breakdown: requested amount, −10% group fee, disbursed 90%, and the weekly installment over 10 weeks. | Built |
| FR-LOAN-13 | Members failing the eligibility rule are disabled in the borrower dropdown and, if selected, surface an explicit ineligibility banner; submission is blocked. | Built |
| FR-LOAN-14 | Provide a "Mark All Paid" bulk action. | Built |
| FR-LOAN-15 | All mutation controls respect ceased weeks and the global edit lock. | Built |
| FR-LOAN-16 | **[PROPOSED]** Enforce the treasury-solvency check at origination — the disbursed amount must not exceed available treasury cash. This check exists only in an orphaned component and is absent from the live path. | Not built (D-07) |
| FR-LOAN-17 | **[PROPOSED]** Enforce the documented ₹1,000 minimum loan amount in JavaScript, not only as an HTML attribute. | Not built (D-08) |

### 8.6 Loan Ledger (`LEDG`)

A loan-first transaction view. Reorganised in the current revision from a member-first weekly ledger to a per-loan drill-down.

| ID | Requirement | Status |
|---|---|---|
| FR-LEDG-01 | List every loan as an **individual entry**. Loans are never aggregated or grouped by member. | Built |
| FR-LEDG-02 | Each loan row summarises nickname, borrower, weekly installment, term length, count of weeks paid, and repaid-of-disbursed. | Built |
| FR-LEDG-03 | Clicking a loan row expands it to reveal all transactions associated with that loan. | Built |
| FR-LEDG-04 | The expanded payment schedule renders **at most 10 weeks**, matching the fixed loan term. | Built |
| FR-LEDG-05 | Each week tile shows the week number, the date, and paid/unpaid state, with paid weeks visually distinguished. | Built |
| FR-LEDG-06 | Clicking a week tile toggles that week's loan installment. | Built |
| FR-LEDG-07 | The expanded view includes a summary panel: loan amount, repaid to date, status, and upfront fee. | Built |
| FR-LEDG-08 | Only one loan is expanded at a time. | Built |
| FR-LEDG-09 | Render an empty state when the group holds no loans. | Built |
| FR-LEDG-10 | **[PROPOSED]** Respect the edit lock and ceased-week rules on tile toggling. The Ledger is not currently passed `editLocked`. | Not built (D-09) |

### 8.7 Members (`MEMB`)

| ID | Requirement | Status |
|---|---|---|
| FR-MEMB-01 | Display a card per member with avatar, name, derived login username, phone, and UPI id. | Built |
| FR-MEMB-02 | Display each member's standing badge, total regular contributions paid, and unpaid week count. | Built |
| FR-MEMB-03 | Display the member's current-week contribution and loan installment status. | Built |
| FR-MEMB-04 | Display active loans with repaid/remaining amounts and a progress bar. | Built |
| FR-MEMB-05 | Display an eight-week payment sparkline with hover detail, highlighting the current week. | Built |
| FR-MEMB-06 | Provide a "Full Ledger" action opening a per-member modal. | Built |
| FR-MEMB-07 | The ledger modal header shows five summary metrics: total weeks, weeks paid, total collected, loans availed, and standing. | Built |
| FR-MEMB-08 | The ledger modal has two tabs: Contributions and Loans. | Built |
| FR-MEMB-09 | The Contributions tab renders a sortable, filterable table (week, due date, status, amount, paid date, method). Sorts: week ascending/descending, status, amount. Filters: all, paid, unpaid. | Built |
| FR-MEMB-10 | The Loans tab renders the **same loan-first, expandable design as the Loan Ledger** — individual loan entries, expandable to a payment schedule of at most 10 weeks, with a summary panel. | Built |
| FR-MEMB-11 | The Members screen is read-only; all mutation is directed to Settings. | Built |
| FR-MEMB-12 | **[PROPOSED]** Make the week tiles in the Members ledger Loans tab actionable, or render them explicitly as read-only. The click handler is currently an empty stub. | Not built (D-10) |

### 8.8 Annual Settlement (`SETL`)

| ID | Requirement | Status |
|---|---|---|
| FR-SETL-01 | Display the total base pool target with its derivation (weeks × members × weekly amount). | Built |
| FR-SETL-02 | Display total group profit pool, profit dividend per member, and estimated final payout per member. | Built |
| FR-SETL-03 | Render a closing statement per member: base invested, plus profit dividend, minus unpaid loan principal, equals disbursable cash. | Built |
| FR-SETL-04 | Provide a celebratory confetti action. | Built |
| FR-SETL-05 | The screen is viewable at any point in the cycle, not gated to week 52. | Built |
| FR-SETL-06 | **[PROPOSED]** Provide export or print of the settlement statement, per member and for the group. | Not built |

### 8.9 Settings & Administration (`SETT`)

| ID | Requirement | Status |
|---|---|---|
| FR-SETT-01 | Configure cycle start date, total weeks (1–104), group name, weekly contribution (min ₹100, step ₹100), group UPI VPA, and free-text group notes. | Built |
| FR-SETT-02 | Display a live derived "expected total pool" and cycle duration as settings are edited. | Built |
| FR-SETT-03 | Saving settings regenerates the week calendar while preserving existing collection records, ceased flags, and cease dates. | Built |
| FR-SETT-04 | Provide a global edit lock toggle, with a page-level banner while locked. | Built |
| FR-SETT-05 | Provide multi-select week finalisation ("cease"), showing how many weeks are already finalised and disabling those already ceased. | Built |
| FR-SETT-06 | Ceasing is irreversible; there is no un-cease action anywhere in the product. | Built (by design) |
| FR-SETT-07 | Provide member create, edit, and delete. Deleting confirms first and preserves the member's historical collection records. | Built |
| FR-SETT-08 | The member form captures name, phone, UPI id, and an avatar colour from a fixed 10-swatch palette, validating that all three text fields are non-empty. | Built |
| FR-SETT-09 | **[PROPOSED]** Confirm before finalising weeks. Cease is currently a one-click irreversible action with no confirmation dialog. | Not built (D-11) |
| FR-SETT-10 | **[PROPOSED]** Enforce uniqueness of the first name across members, since the first name is the login username. | Not built (D-12) |
| FR-SETT-11 | **[PROPOSED]** Warn before reducing `totalWeeks`, which permanently deletes the payment history of the discarded weeks. | Not built (D-13) |
| FR-SETT-12 | **[PROPOSED]** Apply the edit lock to Settings itself. Member deletion, reset, and import are currently reachable while locked, contradicting the UI copy. | Not built (D-14) |

### 8.10 Data Portability (`DATA`)

| ID | Requirement | Status |
|---|---|---|
| FR-DATA-01 | Export the complete application state as pretty-printed JSON, filename `isthooi-backup-YYYY-MM-DD.json`. | Built |
| FR-DATA-02 | Import a JSON backup after explicit confirmation, replacing current state wholesale. | Built |
| FR-DATA-03 | Reset to seeded demo data after explicit confirmation. | Built |
| FR-DATA-04 | Reset the settings form to defaults without touching persisted data, after confirmation. | Built |
| FR-DATA-05 | **[PROPOSED]** Validate the shape and schema version of an imported backup before applying it. Import currently performs `JSON.parse` and nothing else. | Not built (D-15) |
| FR-DATA-06 | **[PROPOSED]** Restore CSV export of the collection ledger. The capability exists only in an orphaned component and is unreachable. | Not built (D-16) |

### 8.11 Member Communications (`COMM`)

| ID | Requirement | Status |
|---|---|---|
| FR-COMM-01 | Compose WhatsApp reminders as `wa.me` deep links opened in a new tab; the operator sends manually. | Built |
| FR-COMM-02 | Sanitise the member's phone number to digits only; fall back to a recipient-less link when no phone is on file. | Built |
| FR-COMM-03 | The standard reminder states the week, contribution due, loan installment due, total due, and the group UPI address. | Built |
| FR-COMM-04 | The urgent alert additionally lists missed week numbers and, at three or more unpaid weeks, states that loan privileges are locked. | Built |
| FR-COMM-05 | **[PROPOSED]** Normalise phone numbers to E.164 with a country code. No country-code prefixing is applied today, so links can fail for locally-formatted numbers. | Not built (D-17) |

---

## 9. Business Rules Catalogue

| ID | Rule | Where enforced |
|---|---|---|
| BR-01 | The contribution amount is uniform across all members and is set by `weeklyAmount` (default ₹1,000, minimum ₹100). | Settings |
| BR-02 | Collection occurs weekly on the generated Sunday dates of the cycle. | Calendar generation |
| BR-03 | **Dues before current week.** A member with any unpaid week prior to the selected week cannot have the selected week marked paid until those dues are settled. | Contributions |
| BR-04 | Dues payments are applied to the **oldest unpaid week first**. | Contributions |
| BR-05 | Advance payments are applied **forward from the selected week**, one full weekly amount at a time, with any remainder applied to the next week. | Contributions |
| BR-06 | Advance payments never extend beyond week 52; any excess is silently discarded. | Contributions / handlers |
| BR-07 | Every loan carries a **flat 10% upfront fee**, `round(requested × 0.1)`, retained by the group at disbursal. | Loan origination |
| BR-08 | The borrower receives **90%** of the requested amount but repays **100%**. The 10% differential is the group's entire profit; there is no other interest mechanism. | Loan origination + repayment |
| BR-09 | Every loan has a **fixed 10-week term**. | Loan origination |
| BR-10 | The weekly installment is `ceil(requestedAmount / 10)`. | Loan origination |
| BR-11 | Loan repayment is measured against `requestedAmount`, never `disbursedAmount`. | Repayment handlers |
| BR-12 | A loan is `REPAID` when `repaidAmount >= requestedAmount`, and `ACTIVE` otherwise. The transition is bidirectional — un-toggling an installment can reopen a closed loan. | Repayment handlers |
| BR-13 | Borrowers may repay early, in any amount up to the outstanding balance. | Loan Collections |
| BR-14 | **Arrears classification** is based on `unpaidPastWeeks`, counted over weeks 1 through the current week **inclusive** — so an unpaid current week counts toward the total. | `getMemberStats` |
| BR-15 | Standing tiers: `0` → CLEAN; `1` → PENDING_1; `2` → OVERDUE_2; `3` → CRITICAL_3; `>3` → BLOCKED. | `getMemberStats` |
| BR-16 | **Loan eligibility is revoked at 3 unpaid weeks** (`unpaidPastWeeks > 2`). | `getMemberStats`, Loan Collections |
| BR-17 | **Blocked status requires more than 3 unpaid weeks** (i.e. 4+). A member at exactly 3 is CRITICAL_3 — loan-ineligible but not blocked. | `getMemberStats` |
| BR-18 | The arrears count is of **total** missed weeks, not consecutive ones, despite UI copy referring to consecutive weeks. | `getMemberStats` |
| BR-19 | A member counts toward the group overdue total at **2 or more** unpaid weeks. | `getGroupStats` |
| BR-20 | A ceased week is permanently read-only. | Settings, collection screens |
| BR-21 | The edit lock is global, not per-user, and advisory — it disables controls but is not checked in the state-mutation layer. | Settings, collection screens |
| BR-22 | At settlement, fee income is split **equally across all members**, regardless of how much each contributed or whether they ever borrowed. | Annual Settlement |
| BR-23 | At settlement, each member receives back **what they actually paid in**, not the notional cycle target. | Annual Settlement |
| BR-24 | At settlement, outstanding **active** loan principal is deducted from the member's payout. Repaid loans have no effect. | Annual Settlement |
| BR-25 | Deleting a member removes them from the roster but preserves their historical collection records. | Settings |
| BR-26 | The login username is derived from the member's first name and is not independently editable. | Login, Settings |

---

## 10. Calculation Specifications

All monetary values are integers in rupees. Formatting is `en-IN`.

### 10.1 Loan origination

```
upfrontFee        = round(requestedAmount × 0.10)
disbursedAmount   = requestedAmount − upfrontFee
termWeeks         = 10
weeklyInstallment = ceil(requestedAmount / 10)
```

Worked example — ₹10,000 loan: fee ₹1,000, disbursed ₹9,000, installment ₹1,000/week for 10 weeks, total repaid ₹10,000, group profit ₹1,000.

### 10.2 Member statistics (`getMemberStats`)

Evaluated over weeks `1..currentWeekNum` inclusive. Weeks with no collection record for the member are skipped entirely.

```
totalRegularPaid   = Σ (record.amount ?? weeklyAmount ?? 1000)  for records where paid
unpaidPastWeeks    = count of records where NOT paid
missedWeeksList    = the corresponding week numbers, ascending
activeLoans        = loans for this member with status ACTIVE
totalLoansTaken    = count of all loans for this member
totalLoanLiability = Σ (requestedAmount − repaidAmount)  over activeLoans
isBlocked          = unpaidPastWeeks > 3
isEligibleForLoan  = unpaidPastWeeks <= 2
```

### 10.3 Group statistics (`getGroupStats`)

Collection aggregates iterate weeks 1..52.

```
currentWeekTarget              = totalMembers × weeklyAmount
currentWeekCollected           = Σ paid amounts in currentWeek
currentWeekPaidCount           = count of paid records in currentWeek
currentWeekPendingCount        = totalMembers − currentWeekPaidCount
totalRegularCollectedAllTime   = Σ paid amounts across all 52 weeks
totalDisbursedLoans            = Σ disbursedAmount over ALL loans
totalGroupProfitsEarned        = Σ upfrontFee over ALL loans
totalLoanPrincipalRepaid       = Σ repaidAmount over ALL loans
totalActiveLoansBalance        = Σ (requestedAmount − repaidAmount) over ACTIVE loans

treasuryCash = totalRegularCollectedAllTime
             + totalGroupProfitsEarned
             + totalLoanPrincipalRepaid
             − totalDisbursedLoans

totalOverdueMembersCount = count of members with unpaidPastWeeks >= 2
totalBlockedMembersCount = count of members with unpaidPastWeeks > 3
totalAnnualBaseTarget    = 52 × totalMembers × weeklyAmount
estimatedProfitDividendPerMember = round(totalGroupProfitsEarned / totalMembers)
estimatedAnnualPayoutPerMember   = (52 × weeklyAmount) + estimatedProfitDividendPerMember
```

Note that `totalRegularCollectedAllTime` includes future weeks already settled by advance payment, which is intentional for treasury purposes.

### 10.4 Year-end settlement, per member

```
regularInvested      = totalRegularPaid            (what they actually paid)
profitDividend       = estimatedProfitDividendPerMember   (equal 1/N share)
pendingLoanLiability = totalLoanLiability          (active loans only)

netPayout = regularInvested + profitDividend − pendingLoanLiability
```

Worked example — 10 members, ₹1,000/week, one ₹10,000 loan fully cycled, a member who paid all 52 weeks and owes nothing:

```
regularInvested = 52,000
profitDividend  = round(1,000 / 10) = 100
netPayout       = 52,100
```

### 10.5 Loan urgency

```
weeksRemaining = startWeekNum + termWeeks − currentWeekNum
isUrgent       = weeksRemaining <= 2
```

---

## 11. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | **Offline-first.** All core functionality must work with no network connection. `localStorage` is the system of record; the app never blocks on a remote call. |
| NFR-02 | **Zero-install.** The product is a static single-page application deployable to any static host. No server runtime, no database provisioning. |
| NFR-03 | **Persistence latency.** State is written synchronously to `localStorage` on every mutation. Cloud sync, when configured, is fire-and-forget and must never block the UI. |
| NFR-04 | **Mobile-first responsiveness.** The primary usage context is a phone during a live collection. A reduced bottom navigation is provided below tablet width. |
| NFR-05 | **Dark theme.** A single dark visual theme is used throughout, driven by CSS custom properties. |
| NFR-06 | **Data volume.** The design target is up to ~50 members × 104 weeks. The full state object must remain comfortably within the ~5 MB `localStorage` quota. |
| NFR-07 | **Graceful degradation of cloud sync.** Missing, malformed, or unreachable Supabase configuration must leave the application fully functional in local-only mode, with failures logged rather than surfaced as errors. |
| NFR-08 | **Currency and locale.** All amounts render as Indian Rupees with `en-IN` grouping. |
| NFR-09 | **[PROPOSED]** No credential material should appear in UI copy, placeholder text, or error messages. |
| NFR-10 | **[PROPOSED]** Introduce automated regression tests. Playwright is a dependency but no test suite or `test` script exists. |
| NFR-11 | **[PROPOSED]** Date handling must be timezone-safe. All date stamps currently derive from `toISOString()` (UTC), which can record the previous day for users in positive-offset timezones such as IST. |

---

## 12. Technical Architecture

### 12.1 Stack

| Layer | Choice | Version |
|---|---|---|
| Framework | React (no TypeScript) | ^19.2.8 |
| Build tool | Vite | ^8.2.0 |
| Icons | lucide-react | ^1.28.0 |
| Effects | canvas-confetti | ^1.9.4 |
| Optional backend | @supabase/supabase-js | ^2.112.0 |
| Linting | oxlint | ^1.75.0 |
| Browser automation (unused) | playwright | ^1.62.1 |

Scripts: `dev` (Vite dev server), `build`, `lint`, `preview`. There is no `test` script.

### 12.2 State management

All application state lives in a single `useState` in `App.jsx`, alongside `activeTab` and `loggedInMember`. There is no Context, reducer, or external store. Every mutation is expressed as a `setState` callback producing a new object; handlers are passed down as props. Group statistics are recomputed on every render via `getGroupStats(state)` without memoisation.

### 12.3 Module layout

```
src/
  App.jsx              Root: state, all mutation handlers, tab routing, auth gate
  main.jsx             React entry point
  index.css            Design tokens and global styles
  App.css              Shell layout
  utils/
    storage.js         Persistence, calendar generation, member/group statistics
    supabaseClient.js  Optional cloud backup
  components/
    Navbar.jsx             Header, tab bar, mobile bottom bar
    Login.jsx              Authentication gate
    Dashboard.jsx          Home / KPIs / defaulter chasing
    SundayContributions.jsx  Weekly contribution collection
    LoanCollections.jsx    Loan servicing and origination
    SundayLedger.jsx       Loan-first transaction ledger
    MemberRoster.jsx       Member directory and per-member ledger
    AnnualSettlement.jsx   Year-end payout calculator
    Settings.jsx           Configuration, member CRUD, backup
```

### 12.4 Persistence

| Concern | Detail |
|---|---|
| Primary store | `localStorage`, key `ISTHOOI_APP_STATE_V2` |
| Session | `localStorage`, key `ISTHOOI_LOGGED_IN_MEMBER` |
| Write trigger | `useEffect` on the state object — fires on mount and after every mutation, undebounced |
| Read | Lazy initialiser on first render; falls back to seeded demo state on absence or parse failure |
| Migration | None. Despite the `_V2` key suffix there is no version field or migration path |

### 12.5 Cloud backup (optional)

Enabled only when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are both set and the URL is HTTPS.

Schema: a single table `public.isthooi_app_state` holding exactly one row, `id = 'primary_state'`, with `state_data JSONB` and `updated_at`. Row-level security is enabled with fully open public policies — appropriate only for a trusted-network demo, not for production.

Behaviour: `saveState` upserts the whole state object after each local write, without awaiting. Concurrent writes are **dropped**, not queued. A read path (`fetchSupabaseState`) exists but is never invoked, so cloud state is effectively **write-only** — a fresh browser will seed demo data rather than pull the cloud row.

### 12.6 Dead code

Three components remain in the tree but are imported by nothing and are unreachable: `DefaultersWatchdog.jsx`, `ExportBackup.jsx`, and `LoanManager.jsx`. Their functionality was re-implemented inline in `Dashboard.jsx`, `Settings.jsx`, and `LoanCollections.jsx` respectively. Two capabilities were lost in that migration and exist only in the dead files: CSV export of the ledger, and the treasury-solvency check at loan origination. `App.handleRepayLoanExtra` is likewise defined but never wired to a rendered component.

---

## 13. Known Defects & Inconsistencies

These are discrepancies found in the current implementation. They are recorded here so the PRD is not mistaken for a description of correct behaviour.

| ID | Severity | Description |
|---|---|---|
| D-01 | High | `totalWeeks` is configurable to 104, but Contributions, Loan Collections, Navbar, Dashboard, and Annual Settlement all hardcode 52. Only the Settings finalisation grid honours the setting. |
| D-02 | High | No authorisation model. Every authenticated member can open Settings, delete other members, lock edits, originate loans, import a backup, and reset all data. |
| D-03 | Low | The Loan Ledger has no navigation entry; it is reachable only from a Dashboard button. |
| D-04 | Medium | Two controls route to a `defaulters` tab that `App.jsx` does not render, producing a blank screen. |
| D-05 | High | The collection record holds one `loanInstallmentPaid` flag per member per week, not one per loan. A member with two concurrent loans cannot have their installments tracked independently. |
| D-06 | Medium | A partial dues payment marks the covered week fully paid; the actual amount received is not persisted. The preview is honest, the stored record is not. |
| D-07 | High | The treasury-solvency check at loan origination exists only in the orphaned `LoanManager.jsx`. The live path can disburse more cash than the group holds. |
| D-08 | Low | The ₹1,000 loan minimum is an HTML `min` attribute only; the submit handler checks `> 0`. |
| D-09 | Medium | The Loan Ledger is not passed `editLocked` and does not check `ceased`, so its week tiles can mutate locked or finalised weeks. |
| D-10 | Low | Week tiles in the Members ledger Loans tab render as clickable but their handler is an empty stub. |
| D-11 | Medium | Week finalisation is irreversible and has no confirmation dialog in Settings. |
| D-12 | Medium | First names are not enforced unique, yet the first name is the login username. Two members named "Rajesh" collide. |
| D-13 | High | Reducing `totalWeeks` silently deletes all payment history for the discarded weeks. |
| D-14 | Medium | The edit lock does not apply to Settings, contradicting its own copy ("No changes can be made to payments, loans, or members"). |
| D-15 | High | Backup import performs no schema validation and replaces state wholesale. A malformed file corrupts the application. |
| D-16 | Low | CSV export of the ledger was lost when `ExportBackup.jsx` was superseded. |
| D-17 | Medium | Phone numbers are not normalised to E.164; `wa.me` links can fail for locally-formatted numbers. |
| D-18 | Medium | Overpayment clamping is inconsistent. Toggling an installment clamps only the floor and can push `repaidAmount` above `requestedAmount`; the advance and extra-repayment paths clamp the ceiling. |
| D-19 | Medium | `handleMarkAllPaid` hardcodes `amount: 1000`, ignoring `weeklyAmount`. Any group with a different contribution records wrong amounts on bulk marking. |
| D-20 | Low | Hardcoded rupee literals in UI copy ignore `weeklyAmount`: "Target Pool: ₹10,000", "MARK ₹1k PAID", "Target Annual Base: ₹520,000", "₹52,000 max". |
| D-21 | Low | The default UPI fallback differs by screen — `sundayfund@upi` on Dashboard versus `isthooi@upi` on Contributions. |
| D-22 | Medium | `forceSync` sets the in-flight guard before delegating, so it can never write and permanently blocks all subsequent syncs for the page session. |
| D-23 | Medium | Supabase is write-only in practice; the fetch path is never called, so cloud state can never be restored by the app. |
| D-24 | Medium | Date stamps use `toISOString()` (UTC), which can record the previous day for IST users after 05:30 local time. |
| D-25 | Low | `getGroupStats` runs unmemoised on every render and is O(members × weeks). |
| D-26 | Low | `CLAUDE.md` is stale: it documents three unreachable components as live tabs, misstates the blocked threshold as "3+", and names the Supabase key `VITE_SUPABASE_KEY` instead of `VITE_SUPABASE_ANON_KEY`. |
| D-27 | Medium | `handleUpdateSettings` mutates the existing collections object in place rather than copying it, breaking the immutability assumption the rest of the state layer relies on. |
| D-28 | Low | Loan installment rounding differs between the two origination paths — `ceil` in the live path, `round` in the orphaned one. |

---

## 14. Roadmap

### 14.1 Release 1.1 — Correctness

Resolve the defects that produce wrong numbers or lose data: D-01, D-05, D-07, D-13, D-15, D-18, D-19, D-24, D-27.

### 14.2 Release 1.2 — Trust and safety

- Two-role permission model (FR-AUTH-10) and real per-member credentials (FR-AUTH-11).
- Confirmation on irreversible actions (FR-SETT-09).
- Edit lock applied uniformly, including Settings and the Loan Ledger (FR-SETT-12, FR-LEDG-10).
- Schema-validated, versioned backup import (FR-DATA-05).

### 14.3 Release 1.3 — Completeness

- Restore CSV export (FR-DATA-06) and add settlement export/print (FR-SETL-06).
- True partial payment amounts per week (FR-CONT-15).
- Loan Ledger promoted to primary navigation (FR-NAV-06); Defaulters route resolved (FR-NAV-07).
- Remove the three orphaned components and the dead handler.

### 14.4 Beyond

- Bidirectional cloud sync with conflict resolution, replacing the current write-only path.
- Configurable loan policy — fee percentage and term length per loan rather than fixed at 10% / 10 weeks.
- Automatic week advancement based on the calendar.
- Audit log of every mutation with actor and timestamp.
- Multi-group support.
- Localisation beyond English / `en-IN`.

---

## 15. Open Questions

1. **Fee model.** Is the flat 10% upfront fee fixed policy, or should it be configurable per group or per loan? The current hardcoding appears in four places.
2. **Term length.** Should the 10-week term be configurable? `termWeeks` is stored per loan but never set to anything other than 10.
3. **Profit distribution basis.** Should the dividend remain an equal 1/Nth split, or be weighted by contribution completeness? Equal split currently rewards members who missed weeks equally with those who did not.
4. **Current week advancement.** Should `currentWeekNum` advance automatically from the system date, or remain a manual value? There is currently no UI to change it at all.
5. **Arrears definition.** UI copy says "consecutive" weeks; the code counts total missed weeks. Which is the group's actual rule?
6. **Blocked threshold.** Loan eligibility is revoked at 3 unpaid weeks but the BLOCKED badge requires 4. Is the intended cliff 3 or 4?
7. **Multi-loan support.** Is holding two concurrent loans a supported scenario? The ledger supports it; the collection record does not.
8. **Deleted members at settlement.** A deleted member's contributions remain in the treasury but they receive no payout. Is that the intended treatment?

---

## Appendix A — Seeded Demo Data

`getInitialState()` produces a deterministic demo group used on first run and on reset.

- **Group:** Isthooi Savings Group, ₹1,000/week, 52 weeks, start date 4 January 2026, UPI `isthooi@upi`, current week 3.
- **Members (10):** Rajesh Kumar, Amit Sharma, Priya Patel, Suresh Raina, Vikram Singh, Ananya Roy, Deepak Verma, Neha Gupta, Rohan Mehta, Kavita Reddy — ids `m1`..`m10`, phones `+91 98765 4321{0-9}`, UPI ids `{firstname}@upi`, each with a distinct avatar colour.
- **Loan (1):** `loan-1` for Amit Sharma (`m2`) — "Festival Advance", requested ₹10,000, disbursed ₹9,000, fee ₹1,000, start week 1, term 10 weeks, installment ₹1,000, repaid ₹2,000, ACTIVE.
- **Collections:** weeks 1 and 2 marked paid for all members, with Amit's loan installment paid in both. **Priya Patel's weeks 1 and 2 are then deliberately reset to unpaid** to demonstrate the arrears flow. Week 3 is unpaid for everyone.
- **Resulting state:** Priya has 3 unpaid weeks → CRITICAL_3, loan-ineligible, not blocked. Every other member has 1 unpaid week (week 3) → PENDING_1. Treasury cash = 18,000 + 1,000 + 2,000 − 9,000 = **₹12,000**.

## Appendix B — Environment Configuration

Optional `.env` at the project root:

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Both must be present and the URL must be HTTPS for cloud backup to activate. Absent or malformed configuration leaves the app in local-only mode with no user-visible change. The schema is in `supabase_schema.sql`.
