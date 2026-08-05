# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Isthooi** is a React-based savings group fund manager application. It tracks weekly contributions from 10 members, manages peer-to-peer loans with interest fees, and provides financial settlement tracking. The app targets small informal savings groups (common in India) and works entirely in-browser with optional cloud backup via Supabase.

## Tech Stack & Build Commands

- **Framework**: React 19.2.8 with Vite 8.2.0 (no TypeScript)
- **Build**: `npm run build` (outputs to `dist/`)
- **Dev server**: `npm run dev` (runs on http://localhost:5173 with HMR)
- **Linting**: `npm run lint` (oxlint)
- **Preview**: `npm run preview` (serve production build locally)

## Architecture

### State Structure
The app uses a flat React state persisted to localStorage (key: `ISTHOOI_APP_STATE_V2`). Optional Supabase sync is available if credentials are configured.

```
{
  groupName: string
  weeklyAmount: number (default 1000)
  currentWeekNum: number (1-52)
  startDate: YYYY-MM-DD (start of 52-week cycle)
  groupUpiVpa: string
  groupNotes: string
  
  members: Array<{
    id: string (m1..m10)
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

- **Primary**: `localStorage` (synchronous, always available)
- **Optional**: Supabase (see `src/utils/supabaseClient.js`)
  - Configured via `.env` file (keys: `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`)
  - Syncs state asynchronously after save; does not block UI
  - If missing/misconfigured, app runs normally in localStorage-only mode

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
- Check localStorage in DevTools (`Application → Local Storage → ISTHOOI_APP_STATE_V2`)

### Debugging
- Use browser DevTools → React DevTools extension to inspect component state/props
- Log state via `console.log(state)` in handlers
- Clear localStorage if corrupted: `localStorage.removeItem('ISTHOOI_APP_STATE_V2')`

## Database Schema (Supabase)
Schema available in `supabase_schema.sql`. The app does NOT enforce schema validation—Supabase sync is best-effort and optional. Focus on localStorage correctness.

## Notes for Future Changes
- Member count is hardcoded to 10 in initial state; changing requires updating seeded demo loans and calculations
- Weekly amount defaults to 1000; logic doesn't validate/enforce this—allow flexible amounts in `collections[memberId].amount`
- Loan repayment logic clamps to prevent overpayment; a fully repaid loan transitions status from ACTIVE → REPAID
- "Blocked" members (3+ missed weeks) are ineligible for new loans; this is enforced in UI, not in state logic
