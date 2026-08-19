# Going live with Supabase

This turns Isthooi from a single-device app into a shared one: the group's ledger
lives in Postgres, several people can record payments at the same time without
overwriting each other, and who may see or edit what is enforced by the database
rather than by the browser.

No SMS provider, no email provider, no paid features. Members sign in with their
name or phone number plus a 6-digit OTP that the super admin generates in the app
and hands over directly. The super admin signs in with a password held as a bcrypt
hash in the database.

---

## 1. Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a project. The free
   tier is enough for a group of this size.
2. Pick the region closest to you (Mumbai / Singapore for India).
3. Save the database password somewhere safe. **You will not need it for this
   setup, and it should never go into the app or a chat.**

## 2. Enable anonymous sign-in

The app creates an anonymous session first, then binds it to a member when the OTP
is redeemed. Until it is bound, that session can read nothing at all.

**Authentication → Sign In / Providers → Anonymous sign-ins → Enable.**

That is the **only** auth setting to change, and it is on the free tier.

Nothing in this setup needs a paid feature, an email provider, an SMS provider, or
a custom email template:

- Members sign in with an OTP the super admin generates in the app and hands over
  in person, on a call, or over WhatsApp.
- The super admin signs in with a password, held as a bcrypt hash in the
  `admin_credentials` table.

Both are verified inside Postgres. Supabase never sends a message.

## 3. Create the tables

1. Open **SQL Editor → New query**.
2. Paste the whole of `supabase/schema.sql` and run it.
3. Open `supabase/seed.sql` and edit three things before running it:
   - the **member list** (names and phone numbers)
   - the **start date** of your 52-week cycle
   - the **super admin password** on the last line

   Then paste and run it.

The schema is idempotent — re-running it is safe. The seed uses
`ON CONFLICT DO NOTHING`, so it will not overwrite a group that is already live.

## 4. Point the app at the project

Copy `.env.example` to `.env` and fill in the two values from
**Project Settings → API**:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

Both are public by design — the anon key ships inside the browser bundle and is
meant to be visible. Everything that actually protects the data is an RLS policy.
**The `service_role` key must never appear in `.env` or anywhere in this app.**

Restart the dev server; `.env` is only read at startup.

## 5. First sign-in

1. Open the app. You should see "Your name or phone number" and an OTP box — that
   confirms it is in live mode. If it still says "Username / Password", the
   credentials were not picked up.
2. Press **"Group admin? Sign in with password"**.
3. Enter **Rajeesh** and the password from the last line of `seed.sql`.
4. Go to **Settings → Access Control** and generate an OTP for each member, then
   pass each one on however suits you.

The super admin gets in by password; everyone else gets in by an OTP the super
admin issues.

---

## How sign-in works

Ordinary member:

```
   → signInAnonymously()          real JWT, no identity, RLS denies everything
   → enters "Rajan" + 483920      the OTP Rajeesh handed over
   → redeem_access_code()         verifies the code, binds the session to m3
   → RLS now resolves: auth.uid() → member → role → allow/deny
```

Super admin (the only one who can use this route):

```
   → signInAnonymously()          same as above: a JWT bound to nobody
   → enters "Rajeesh" + password
   → sign_in_super_admin()        checks the name is the super admin's, compares
                                  the password against the bcrypt hash in
                                  admin_credentials, then binds the session
   → 5 wrong tries → 15 minute lock-out
```

Why the super admin needs a separate route at all: `issue_access_code()` requires
`is_super_admin()`, which requires already being signed in. Without a password,
logging out or replacing the phone would lock them out permanently, recoverable
only by hand-writing SQL.

The password is compared **inside Postgres**. It is never returned to the browser,
never held in `localStorage`, and exists in the database only as a bcrypt hash —
so it cannot be read back from the dashboard either. A forgotten password is
replaced, not recovered.

- **The roster is the allowlist.** There is no self-signup.
- **OTPs are stored only as bcrypt hashes.** The plaintext is shown to the super
  admin once and cannot be read back — a copy of the database hands nobody a
  working login.
- **Five wrong attempts triggers a 15-minute cool-off**, which is what actually
  protects a six-digit code.
- **One device at a time.** Redeeming a new OTP moves the binding to the new
  device and the old one stops working — which is also how a lost phone is dealt
  with. "Reset device" in Access Control does the same without issuing a code.
- **Logging out requires a new OTP to get back in.** Ordinary use does not: the
  session persists across refreshes and restarts, so members should simply close
  the tab rather than log out. The super admin is the exception — their password
  always works.
- **Changing the admin password**: either from **Settings → Access Control** while
  signed in, or from the SQL Editor at any time:
  ```sql
  select public.set_admin_password('a new password of 12+ characters');
  ```
  Clear the SQL editor afterwards — Supabase keeps recent queries, and that one
  contains the password in plaintext.
- **If the super admin role moves to someone else**, set a password for the new
  holder. `set_admin_password()` always writes against whoever
  `group_settings.super_admin_member_id` currently points at, so run it *after*
  the transfer.

## How permissions are enforced

The three-layer model — role, standing override, timed grant — exists twice, on
purpose:

| Where | File | Job |
| --- | --- | --- |
| Browser | `src/utils/permissions.js` | Decide what to show and enable |
| Database | `schema.sql` §3 | Decide what is actually allowed |

The browser copy is a convenience so the UI does not offer buttons that will fail.
The database copy is the one that matters. **If you change the rules, change both**
— they are written to mirror each other function for function.

## What the database guarantees

- `anon` has no privileges at all; an unauthenticated caller sees an empty database.
- Loan balances are **derived by trigger** from the installment rows, never sent by
  a client, so two collectors recording payments at once cannot lose a payment.
- Loan status is recomputed from the balance, so no client can mark a loan repaid
  without the money.
- A ceased week and the global edit lock are enforced in policy, not just in the UI.
- `audit_log` has insert and select policies but **no update or delete policy**, so
  the trail cannot be rewritten through the API by anyone, super admin included.
- Members are deactivated rather than deleted, so their contribution history
  survives them leaving.

## Backups

Supabase takes daily backups on paid plans. On the free tier, take your own:
**Database → Backups**, or periodically run

```sql
select * from public.contributions;  -- etc., export as CSV
```

The app's JSON export/import is **disabled in live mode** — importing would
overwrite shared group data with one member's snapshot.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Login shows "Username / Password" | `.env` not picked up — check the values and restart the dev server |
| "Could not start a session" | Anonymous sign-ins not enabled (step 2) |
| "No admin password has been set yet" | The `set_admin_password()` line at the end of `seed.sql` was not run |
| "That name or password is not valid" | Wrong name or wrong password. Deliberately the same message for both, and for "no password set", so nothing can be learned by guessing |
| "Too many attempts. Wait 15 minutes" | The 5-try throttle on admin sign-in. Running `set_admin_password()` again clears it immediately |
| `function crypt(text, text) does not exist` | `pgcrypto` is not on the function's search_path. The schema handles this; if you see it, re-run `schema.sql` in full |
| "That name or OTP is not valid" | Wrong code, expired code, or the name is not on the roster. The message is deliberately the same for all three so nobody can discover who is a member by guessing |
| Everything loads empty | Signed in but not bound to a member — the OTP redemption failed |
| "You do not have permission to…" | RLS refused the write. Correct behaviour if the member's access was changed or a grant lapsed |

## Local development without Supabase

Leave `.env` out entirely. The app falls back to localStorage with the original
demo login (first name + `abcd`), so nothing about the cloud setup is needed to
work on the UI.
