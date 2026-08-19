# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Isthooi** is a React-based savings group fund manager application. It tracks weekly contributions from a flexible number of members, manages peer-to-peer loans with interest fees, and provides financial settlement tracking. The app targets small informal savings groups (common in India) and works entirely in-browser with optional cloud backup via Supabase.

## Tech Stack & Build Commands

- **Framework**: React 19.2.8 with Vite 8.2.0 (no TypeScript)
- **Build**: `npm run build` (outputs to `dist/`)
- **Dev server**: `npm run dev` (runs on http://localhost:5173 with HMR)
- **Linting**: `npm run lint` (oxlint)
- **Preview**: `npm run preview` (serve production build locally)

## Architecture

### State Structure
The app uses a flat React state persisted to localStorage (key: `ISTHOOI_APP_STATE_V3`). Optional Supabase sync is available if credentials are configured.

```
{
  groupName: string
  weeklyAmount: number (default 1000)
  currentWeekNum: number (1-52)
  startDate: YYYY-MM-DD (start of 52-week cycle)
  groupUpiVpa: string
  groupNotes: string
  
  members: Array<{
    id: string (auto-generated UUID or mX pattern)
    name: string
    phone: string
    upiId: string
    avatarColor: hex color for UI
  }>
  
  weeks: Object<weekNum, {
    weekNum: number
    date: YYYY-MM-DD
    displayDate: formatted date string
    collections: Object<memberId, {
      paid: boolean
      amount: number
      paymentMethod: 'UPI' | 'Cash' | 'Bank'
      paidAt: YYYY-MM-DD or null
      loanInstallmentPaid: boolean
      loanInstallmentAmount: number
    }>
  }>
  
  loans: Array<{
    id: string (loan-{timestamp})
    memberId: string
    nickname: string
    requestedAmount: number
    disbursedAmount: number (requestedAmount - upfrontFee)
    upfrontFee: number (profit to group, ~10%)
    startWeekNum: number
    termWeeks: number
    weeklyInstallment: number
    repaidAmount: number
    status: 'ACTIVE' | 'REPAID'
    createdAt: YYYY-MM-DD
  }>
}
```

### State Management
- **App.jsx** is the root component holding all state via `useState` + `useEffect` to persist to localStorage
- State mutations are atomic—each handler wraps state updates in `setState` callbacks to maintain immutability
- No Context API or Redux; props are passed down to 8 tab components

### Data Validation & Calculations
- `src/utils/storage.js` exports:
  - `getMemberStats(state, memberId)`: Computes member payment history, loan eligibility, blocked status
  - `getGroupStats(state)`: Computes group-wide metrics (treasury, collected, profits, overdue counts)
  - `getInitialState()`: Generates 52 Sundays + seeded demo loans
  - `generate52Sundays(startDate)`: Utility to create weekly calendar

## Component Organization

### Tab-Based Navigation
- **Navbar.jsx**: Renders 8 tabs and displays group stats header
- **Dashboard.jsx**: Overview—current week collection, member list, quick stats
- **SundayLedger.jsx**: Weekly collection tracker; mark paid/unpaid, toggle payment methods
- **LoanManager.jsx**: Create loans, track repayments, view loan details
- **DefaultersWatchdog.jsx**: Show members with overdue payments
- **AnnualSettlement.jsx**: Year-end accounting (profit distribution, member payouts)
- **MemberRoster.jsx**: Edit member details (name, phone, UPI)
- **ExportBackup.jsx**: Import/export JSON state, reset to demo state

### Key Prop Patterns
- Handlers passed down: `onTogglePayment`, `onCreateLoan`, `onRepayLoanExtra`, `onUpdateMember`
- Read-only: `state`, `groupStats`

## Cloud & Storage

The app runs in one of two modes, decided at startup by whether Supabase
credentials are present (`LIVE` in `App.jsx`).

**Demo mode** (no `.env`): everything lives in `localStorage`. Login is first name
+ `abcd`. This is the mode to use for UI work.

**Live mode** (`.env` present): Postgres is the source of truth.
- `.env` keys: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
  (`VITE_SUPABASE_KEY` is also accepted — the two names had drifted apart).
- `src/utils/db.js` reads the normalized tables and reassembles the same flat
  `state` object the components expect, so no component knows which mode it is in.
- Every mutation writes **one row**, not the whole state. The previous design
  upserted the entire state as a JSON blob on each change, which meant two people
  recording payments at the same time lost one of them.
- `localStorage` remains only as a startup cache.
- Realtime subscriptions refresh other members' screens automatically.
- Import/export and Reset are disabled in live mode — both would overwrite shared
  group data.

See `SUPABASE_SETUP.md` for the full setup walkthrough.

## Styling
- **src/index.css**: Global styles, CSS variables for colors
- **src/App.css**: Main layout (flexbox, tab nav)
- **Per-component**: No scoped CSS; component styles inline or via top-level classes

## Common Development Tasks

### Running the App
```bash
npm install
npm run dev
```
Navigate to http://localhost:5173. Changes auto-reload.

### Adding a New Feature
1. Create handler in `App.jsx` (e.g., `handleNewFeature`)
2. Implement state mutation logic
3. Pass handler + relevant state to target component via props
4. Update `MEMORY.md` and commit with clear message

### Testing a Change
- Manual testing in browser: Use the dev server and interact with UI
- No automated test suite; verify via manual clicks, week toggles, loan creation
- Check localStorage in DevTools (`Application → Local Storage → ISTHOOI_APP_STATE_V3`)

### Debugging
- Use browser DevTools → React DevTools extension to inspect component state/props
- Log state via `console.log(state)` in handlers
- Clear localStorage if corrupted: `localStorage.removeItem('ISTHOOI_APP_STATE_V3')`

## Database Schema (Supabase)

`supabase/schema.sql` (tables, functions, RLS) and `supabase/seed.sql` (initial
roster and calendar). The old single-blob `supabase_schema.sql` has been removed —
its policies were `USING (true)`, which made the whole ledger publicly writable to
anyone holding the anon key.

### Authentication
No SMS provider, no email provider, no paid Supabase features. Two routes, both
resolved inside Postgres:

- **Members** — the super admin generates a 6-digit OTP in Settings → Access
  Control and passes it on directly; the member signs in with their first name or
  phone plus that code (`redeem_access_code`).
- **Super admin** — signs in with a password (`sign_in_super_admin`). They need a
  separate route because `issue_access_code()` requires `is_super_admin()`, which
  requires already being signed in; without it, logging out would lock them out
  permanently.

Mechanically both start with `signInAnonymously()`, which yields a JWT bound to
nobody: `current_member_id()` returns NULL and every policy denies. The OTP or
password then binds that session to a member row.

OTPs and the admin password are stored as bcrypt hashes only, in tables whose RLS
has **no policies at all**, so nothing reachable through the anon/authenticated API
can read them. Change the password with
`select public.set_admin_password('…')` or from Access Control.

### Permissions exist in two places, deliberately
| Where | File | Job |
| --- | --- | --- |
| Browser | `src/utils/permissions.js` | What to show and enable |
| Database | `supabase/schema.sql` §3 | What is actually allowed |

The browser copy is a convenience; the database copy is the security boundary.
**Changing the rules means changing both** — they mirror each other function for
function (`role_default_level`, `effective_level`, `can_view`, `can_edit`).

### Invariants the database owns, not the client
- `loans.repaid_amount` is recomputed by trigger from `loan_installments`, so
  concurrent collectors cannot lose a payment to a read-modify-write race.
- `loans.status` is derived from the balance.
- Ceased weeks and the global edit lock are enforced in policy.
- `audit_log` has no update or delete policy — the trail is append-only for
  everyone, super admin included.
- Members are deactivated, never deleted, so contribution history survives.

## Notes for Future Changes
- Members can be added/removed via Settings → Members Management; displays dynamically in Navbar, Dashboard, and AnnualSettlement
- Weekly amount defaults to 1000 and is configurable via Settings; all calculations use `state.weeklyAmount` dynamically
- Loan repayment logic clamps to prevent overpayment; a fully repaid loan transitions status from ACTIVE → REPAID
- "Blocked" members (3+ missed weeks) are ineligible for new loans; this is enforced in UI, not in state logic
