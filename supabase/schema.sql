-- =============================================================================
-- Isthooi — live schema for Supabase / Postgres
-- =============================================================================
-- Replaces the single-JSON-blob table (public.isthooi_app_state) with normalized
-- tables, so two people recording payments at the same time no longer overwrite
-- each other, and so the role/grant model can be enforced in the database rather
-- than only in the browser.
--
-- Run this whole file once in the Supabase SQL Editor. It is idempotent: safe to
-- re-run. See SUPABASE_SETUP.md for the surrounding steps (SMS provider, keys,
-- bootstrapping the first super admin).
--
-- SECURITY NOTE. The anon key ships inside the client bundle and is public. Every
-- rule that actually protects this data is an RLS policy below; nothing in the
-- React app is a security control. Policies are written so that an attacker
-- holding the anon key but no valid session can read and write nothing at all.
-- =============================================================================

-- Extensions ------------------------------------------------------------------
-- Supabase ships pgcrypto already, installed into the `extensions` schema rather
-- than `public`. That matters: any security definer function calling crypt() or
-- gen_salt() must carry `extensions` on its search_path, or it fails at runtime
-- with "function crypt(text, text) does not exist". Every such function below
-- uses `set search_path = public, extensions`.
create extension if not exists pgcrypto with schema extensions;

-- =============================================================================
-- 1. Types
-- =============================================================================
-- Declaration order matters: Postgres orders enum values as declared, so
-- 'none' < 'view' < 'edit' and max() picks the most permissive level.
do $$ begin
  create type public.access_level as enum ('none', 'view', 'edit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.member_role as enum ('member', 'collector', 'superadmin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('UPI', 'Cash', 'Bank');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.loan_status as enum ('ACTIVE', 'REPAID');
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2. Tables
-- =============================================================================

-- Members -------------------------------------------------------------------
-- `id` stays TEXT to match the ids the app already uses ('m1', 'm2', ...), so an
-- existing localStorage state migrates without rewriting every foreign key.
-- `phone` is the login identity: it is matched against the verified phone on the
-- JWT, so it must be stored in E.164 form (+919876543210) and be unique.
create table if not exists public.members (
  id            text primary key,
  name          text not null,
  phone         text unique,
  upi_id        text,
  avatar_color  text default '#6366f1',
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

comment on column public.members.phone is
  'Contact number for reminders and UPI. Not used for authentication — sign-in is by a code the super admin issues (see access_codes).';

-- Group settings ------------------------------------------------------------
-- Single row, pinned to id = 1 by a check constraint.
create table if not exists public.group_settings (
  id                     smallint primary key default 1 check (id = 1),
  group_name             text not null default 'Isthooi Savings Group',
  weekly_amount          numeric(12,2) not null default 1000,
  current_week_num       integer not null default 1,
  start_date             date not null default '2026-01-04',
  total_weeks            integer not null default 52,
  group_upi_vpa          text,
  group_notes            text,
  edit_locked            boolean not null default false,
  super_admin_member_id  text references public.members(id) on delete set null,
  updated_at             timestamptz not null default now()
);

-- Weeks ---------------------------------------------------------------------
create table if not exists public.weeks (
  week_num      integer primary key check (week_num between 1 and 520),
  week_date     date not null,
  display_date  text,
  ceased        boolean not null default false,
  cease_date    date
);

-- Contributions -------------------------------------------------------------
-- The weekly Sunday payment. One row per member per week.
create table if not exists public.contributions (
  week_num        integer not null references public.weeks(week_num) on delete cascade,
  member_id       text    not null references public.members(id) on delete cascade,
  paid            boolean not null default false,
  amount          numeric(12,2) not null default 0,
  method          public.payment_method not null default 'UPI',
  paid_at         date,
  updated_at      timestamptz not null default now(),
  updated_by      text references public.members(id) on delete set null,
  primary key (week_num, member_id)
);

create index if not exists contributions_member_idx on public.contributions (member_id);

-- Loans ---------------------------------------------------------------------
create table if not exists public.loans (
  id                 text primary key,
  member_id          text not null references public.members(id) on delete cascade,
  nickname           text,
  requested_amount   numeric(12,2) not null,
  disbursed_amount   numeric(12,2) not null,
  upfront_fee        numeric(12,2) not null default 0,
  start_week_num     integer not null,
  term_weeks         integer not null default 10,
  weekly_installment numeric(12,2) not null,
  repaid_amount      numeric(12,2) not null default 0,
  status             public.loan_status not null default 'ACTIVE',
  created_at         date not null default current_date,
  created_by         text references public.members(id) on delete set null,
  -- Repayment is clamped in the app; enforce it here too so no client can
  -- push a loan past fully-repaid or into negative territory.
  constraint loans_repaid_within_bounds
    check (repaid_amount >= 0 and repaid_amount <= requested_amount)
);

create index if not exists loans_member_idx on public.loans (member_id);
create index if not exists loans_status_idx on public.loans (status);

-- Loan installments ---------------------------------------------------------
-- Split out from contributions, and keyed by loan, because the old shape kept a
-- single loan-installment flag per member per week and so could not represent a
-- member repaying two loans in the same week.
create table if not exists public.loan_installments (
  week_num    integer not null references public.weeks(week_num) on delete cascade,
  member_id   text    not null references public.members(id) on delete cascade,
  loan_id     text    not null references public.loans(id) on delete cascade,
  paid        boolean not null default false,
  amount      numeric(12,2) not null default 0,
  paid_at     date,
  updated_at  timestamptz not null default now(),
  updated_by  text references public.members(id) on delete set null,
  primary key (week_num, member_id, loan_id)
);

create index if not exists loan_installments_loan_idx on public.loan_installments (loan_id);

-- Expenses ------------------------------------------------------------------
create table if not exists public.expenses (
  id           text primary key,
  description  text not null default 'Miscellaneous expense',
  amount       numeric(12,2) not null default 0,
  week_num     integer not null,
  spent_on     date not null default current_date,
  method       public.payment_method not null default 'Cash',
  created_at   date not null default current_date,
  created_by   text references public.members(id) on delete set null
);

create index if not exists expenses_week_idx on public.expenses (week_num);

-- Access control ------------------------------------------------------------
-- Mirrors src/utils/permissions.js: role → standing override → timed grant.
create table if not exists public.access_roles (
  member_id  text primary key references public.members(id) on delete cascade,
  role       public.member_role not null default 'member',
  updated_at timestamptz not null default now()
);

create table if not exists public.access_overrides (
  member_id  text not null references public.members(id) on delete cascade,
  feature    text not null,
  level      public.access_level not null,
  updated_at timestamptz not null default now(),
  primary key (member_id, feature)
);

create table if not exists public.access_grants (
  id           text primary key,
  member_id    text not null references public.members(id) on delete cascade,
  feature      text not null,
  level        public.access_level not null,
  valid_from   date,
  valid_until  date,
  note         text,
  granted_by   text references public.members(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- A grant only ever elevates; storing 'none' would make expiry ambiguous.
  constraint access_grants_elevate_only check (level in ('view', 'edit')),
  constraint access_grants_window_ordered
    check (valid_from is null or valid_until is null or valid_until >= valid_from)
);

create index if not exists access_grants_member_idx on public.access_grants (member_id);

-- Audit ---------------------------------------------------------------------
-- Money changing hands should leave a trail. Append-only: nobody can update or
-- delete rows here (no such policies exist below).
create table if not exists public.audit_log (
  id          bigserial primary key,
  actor_id    text references public.members(id) on delete set null,
  action      text not null,
  entity      text not null,
  entity_id   text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- =============================================================================
-- 3. Permission functions
-- =============================================================================
-- These mirror src/utils/permissions.js exactly. If you change the rules in one
-- place, change them in the other — the app uses its copy to decide what to show,
-- the database uses this copy to decide what is allowed.

-- Which features accept an 'edit' level at all. Everything else clamps to 'view'.
create or replace function public.is_feature_editable(p_feature text)
returns boolean
language sql immutable
as $$
  select p_feature in ('contributions', 'loan-collections', 'settings');
$$;

-- Baseline level granted by a role, before overrides and grants.
create or replace function public.role_default_level(p_role public.member_role, p_feature text)
returns public.access_level
language sql immutable
as $$
  select case
    when p_role = 'superadmin' then 'edit'::public.access_level
    when p_feature = 'settings' then 'none'::public.access_level
    when p_role = 'collector' and p_feature in ('contributions', 'loan-collections')
      then 'edit'::public.access_level
    else 'view'::public.access_level
  end;
$$;

-- The member row belonging to the caller's session, or NULL when the caller has
-- no session or is not an active member.
create or replace function public.current_member_id()
returns text
language sql stable security definer set search_path = public
as $$
  select id from public.members
  where auth_user_id = auth.uid() and is_active
  limit 1;
$$;

-- Full three-layer resolution: role default, then standing override, then any
-- active timed grant (which may only raise the level), then the editable clamp.
create or replace function public.effective_level(p_member_id text, p_feature text)
returns public.access_level
language plpgsql stable security definer set search_path = public
as $$
declare
  v_super_admin text;
  v_role   public.member_role;
  v_level  public.access_level;
  v_over   public.access_level;
  v_grant  public.access_level;
begin
  if p_member_id is null then
    return 'none';
  end if;

  select super_admin_member_id into v_super_admin from public.group_settings where id = 1;
  if p_member_id = v_super_admin then
    return 'edit';
  end if;

  select role into v_role from public.access_roles where member_id = p_member_id;
  v_level := public.role_default_level(coalesce(v_role, 'member'), p_feature);

  select level into v_over
  from public.access_overrides
  where member_id = p_member_id and feature = p_feature;

  if v_over is not null then
    v_level := v_over;
  end if;

  -- Inclusive window on both ends, matching describeWindow() in the app.
  select max(level) into v_grant
  from public.access_grants
  where member_id = p_member_id
    and feature = p_feature
    and (valid_from  is null or valid_from  <= current_date)
    and (valid_until is null or valid_until >= current_date);

  if v_grant is not null and v_grant > v_level then
    v_level := v_grant;
  end if;

  if not public.is_feature_editable(p_feature) and v_level = 'edit' then
    v_level := 'view';
  end if;

  return v_level;
end;
$$;

create or replace function public.can_view(p_feature text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.effective_level(public.current_member_id(), p_feature)
         in ('view', 'edit');
$$;

create or replace function public.can_edit(p_feature text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.effective_level(public.current_member_id(), p_feature) = 'edit';
$$;

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.group_settings
    where id = 1 and super_admin_member_id = public.current_member_id()
  );
$$;

-- Is the caller an active member with a session at all? Used as the floor for
-- every read policy: no session, no data.
create or replace function public.is_active_member()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_member_id() is not null;
$$;

-- A ceased week, or the global edit lock, stops writes for everyone except the
-- super admin — the same rule the UI applies, enforced where it counts.
create or replace function public.week_is_writable(p_week_num integer)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_super_admin() or (
    not coalesce((select edit_locked from public.group_settings where id = 1), false)
    and not coalesce((select ceased from public.weeks where week_num = p_week_num), false)
  );
$$;

-- =============================================================================
-- 4. Sign-in: super-admin-issued OTPs
-- =============================================================================
-- No SMS or email provider is involved. The super admin generates a 6-digit OTP
-- for a member and hands it over however suits them — at the Sunday collection,
-- over WhatsApp, on a call. The member signs in with their first name or phone
-- number plus that OTP.
--
-- How a real session exists without a provider: the browser calls
-- signInAnonymously(), which yields a valid JWT carrying no identity. Until an
-- OTP is redeemed, current_member_id() is NULL and every policy above denies, so
-- an anonymous session by itself is worth nothing. Redeeming binds that auth user
-- to the member row, and RLS resolves normally from then on.

create table if not exists public.access_codes (
  id           text primary key,
  member_id    text not null references public.members(id) on delete cascade,
  -- Only a bcrypt hash is stored. The plaintext is shown to the super admin once,
  -- at issue time, and is not recoverable — so a copy of the database does not
  -- hand anyone a working login.
  code_hash    text not null,
  expires_at   timestamptz not null,
  redeemed_at  timestamptz,
  redeemed_by  uuid references auth.users(id) on delete set null,
  issued_by    text references public.members(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists access_codes_open_idx
  on public.access_codes (member_id) where redeemed_at is null;

-- Brute-force guard. Six digits is only a million combinations, so throttling is
-- what actually protects it: without this an anonymous session could grind
-- attempts for free.
create table if not exists public.access_code_attempts (
  auth_user_id  uuid primary key references auth.users(id) on delete cascade,
  attempts      integer not null default 0,
  last_attempt  timestamptz not null default now()
);

alter table public.access_codes         enable row level security;
alter table public.access_code_attempts enable row level security;

-- Issue an OTP for a member. Super admin only. Returns the plaintext exactly
-- once — the UI must display it immediately, as it cannot be read back later.
create or replace function public.issue_access_code(
  p_member_id   text,
  p_valid_hours integer default 24
)
returns text
-- `extensions` is on the path for gen_salt()/crypt(); see the note at the top.
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_code text;
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can issue an OTP';
  end if;

  if not exists (select 1 from public.members where id = p_member_id and is_active) then
    raise exception 'No such active member';
  end if;

  v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');

  -- Any earlier unredeemed OTP for this member stops working, so only the code
  -- most recently handed over is live.
  delete from public.access_codes
  where member_id = p_member_id and redeemed_at is null;

  insert into public.access_codes (id, member_id, code_hash, expires_at, issued_by)
  values (
    'ac-' || replace(gen_random_uuid()::text, '-', ''),
    p_member_id,
    crypt(v_code, gen_salt('bf')),
    now() + make_interval(hours => greatest(1, p_valid_hours)),
    public.current_member_id()
  );

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (public.current_member_id(), 'auth.otp_issued', 'members', p_member_id);

  return v_code;
end;
$$;

-- Redeem an OTP and bind the calling (anonymous) session to a member.
--
-- p_identifier is the member's first name or their phone number — whichever they
-- find easier. Matching is deliberately broad: several members could share a
-- first name, so every candidate is collected and the OTP itself decides which
-- one it belongs to. That also avoids an "ambiguous name" error, which would leak
-- who is on the roster.
create or replace function public.redeem_access_code(
  p_identifier text,
  p_code       text
)
returns text
-- `extensions` is on the path for crypt(); see the note at the top.
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_member_id text;
  v_code_row  public.access_codes%rowtype;
  v_attempts  integer;
  v_last      timestamptz;
  v_ident     text := lower(trim(coalesce(p_identifier, '')));
  v_digits    text := regexp_replace(coalesce(p_identifier, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- A device already bound to a member just signs straight back in.
  select id into v_member_id from public.members where auth_user_id = auth.uid();
  if v_member_id is not null then
    return v_member_id;
  end if;

  if v_ident = '' or coalesce(trim(p_code), '') = '' then
    raise exception 'Enter your name or phone number, and the OTP.';
  end if;

  -- Throttle: 5 failures, then a 15 minute cool-off.
  select attempts, last_attempt into v_attempts, v_last
  from public.access_code_attempts where auth_user_id = auth.uid();

  if v_attempts >= 5 and v_last > now() - interval '15 minutes' then
    raise exception 'Too many attempts. Wait 15 minutes, then ask for a new OTP.';
  end if;

  if v_last is not null and v_last <= now() - interval '15 minutes' then
    v_attempts := 0;  -- cool-off served
  end if;

  -- crypt() re-hashes the candidate using the stored salt, so this compares at
  -- bcrypt cost rather than looking up a plaintext.
  select ac.* into v_code_row
  from public.access_codes ac
  join public.members m on m.id = ac.member_id
  where ac.redeemed_at is null
    and ac.expires_at > now()
    and m.is_active
    and (
      lower(split_part(trim(m.name), ' ', 1)) = v_ident
      or (v_digits <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_digits)
    )
    and ac.code_hash = crypt(trim(p_code), ac.code_hash)
  limit 1;

  if v_code_row.id is null then
    insert into public.access_code_attempts (auth_user_id, attempts, last_attempt)
    values (auth.uid(), coalesce(v_attempts, 0) + 1, now())
    on conflict (auth_user_id) do update
      set attempts = coalesce(v_attempts, 0) + 1, last_attempt = now();
    -- One message for a wrong name and a wrong OTP alike: distinct errors would
    -- let someone confirm who is on the roster by guessing names.
    raise exception 'That name or OTP is not valid, or the OTP has expired.';
  end if;

  -- Binding moves to the newest device. A member switching from phone to laptop
  -- just asks for another OTP; the old device silently stops working, which is
  -- also how a lost handset is dealt with.
  update public.members set auth_user_id = auth.uid() where id = v_code_row.member_id;

  update public.access_codes
  set redeemed_at = now(), redeemed_by = auth.uid()
  where id = v_code_row.id;

  delete from public.access_code_attempts where auth_user_id = auth.uid();

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (v_code_row.member_id, 'auth.otp_redeemed', 'members', v_code_row.member_id);

  return v_code_row.member_id;
end;
$$;

-- =============================================================================
-- 4b. Super admin password
-- =============================================================================
-- The super admin cannot issue themselves an OTP — issue_access_code() requires
-- already being signed in — so logging out, clearing the browser, or replacing the
-- phone would otherwise lock them out permanently. Their way in is a password.
--
-- This is the one standing credential in the system, on its most privileged
-- account, so it is handled accordingly:
--
--   * Stored only as a bcrypt hash at cost 10. The plaintext never reaches the
--     database and cannot be recovered from it.
--   * The table carries RLS with NO POLICIES AT ALL, so no client can read it —
--     not even the super admin. Only the definer functions below touch it.
--   * Sign-in is throttled: 5 wrong tries, then a 15 minute lock-out. Without
--     that, a password is only as good as the attacker's patience.
--   * Every attempt, successful or not, lands in audit_log.

create table if not exists public.admin_credentials (
  member_id      text primary key references public.members(id) on delete cascade,
  password_hash  text not null,
  updated_at     timestamptz not null default now(),
  updated_by     text references public.members(id) on delete set null
);

create table if not exists public.admin_signin_attempts (
  member_id     text primary key references public.members(id) on delete cascade,
  attempts      integer not null default 0,
  last_attempt  timestamptz not null default now()
);

alter table public.admin_credentials    enable row level security;
alter table public.admin_signin_attempts enable row level security;
-- Intentionally no policies on either table.

-- Set or rotate the super admin's password.
--
-- Two ways in: an already-signed-in super admin rotating their own (the normal
-- case, from Settings → Access Control), or a direct SQL call during setup when
-- nobody is signed in yet — which is how the first password gets there.
create or replace function public.set_admin_password(p_new_password text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_super  text;
  v_caller text := public.current_member_id();
begin
  select super_admin_member_id into v_super from public.group_settings where id = 1;

  if v_super is null then
    raise exception 'This group has no super admin';
  end if;

  -- auth.uid() is null when this is being run straight from the SQL editor during
  -- setup. Through the API a session always exists, so this cannot be used by an
  -- anonymous caller to seize the account.
  if auth.uid() is not null and v_caller is distinct from v_super then
    raise exception 'Only the super admin can change the super admin password';
  end if;

  if p_new_password is null or length(p_new_password) < 12 then
    raise exception 'The password must be at least 12 characters';
  end if;

  -- Cheap but worthwhile: refuse the handful of things people actually type.
  if lower(p_new_password) in ('password1234', 'adminadmin12', '123456789012') then
    raise exception 'Choose a less predictable password';
  end if;

  insert into public.admin_credentials (member_id, password_hash, updated_by)
  values (v_super, crypt(p_new_password, gen_salt('bf', 10)), v_caller)
  on conflict (member_id) do update
    set password_hash = excluded.password_hash,
        updated_at    = now(),
        updated_by    = excluded.updated_by;

  -- A rotation clears any lock-out, so a forgotten-then-reset password does not
  -- leave the admin waiting out a cool-off they caused themselves.
  delete from public.admin_signin_attempts where member_id = v_super;

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (v_caller, 'auth.admin_password_set', 'members', v_super);
end;
$$;

-- Sign the calling (anonymous) session in as the super admin.
--
-- p_identifier is their first name or phone, exactly as for a member OTP, so the
-- login screen behaves consistently.
create or replace function public.sign_in_super_admin(
  p_identifier text,
  p_password   text
)
returns text
language plpgsql security definer set search_path = public, extensions
as $$
declare
  v_super     text;
  v_member_id text;
  v_hash      text;
  v_attempts  integer;
  v_last      timestamptz;
  v_ident     text := lower(trim(coalesce(p_identifier, '')));
  v_digits    text := regexp_replace(coalesce(p_identifier, ''), '[^0-9]', '', 'g');
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select super_admin_member_id into v_super from public.group_settings where id = 1;

  -- Confirm the typed identifier really is the super admin's.
  select m.id into v_member_id
  from public.members m
  where m.is_active
    and m.id = v_super
    and (
      lower(split_part(trim(m.name), ' ', 1)) = v_ident
      or (v_digits <> '' and regexp_replace(coalesce(m.phone, ''), '[^0-9]', '', 'g') = v_digits)
    )
  limit 1;

  -- Throttle before touching the hash, so a wrong name costs an attempt too and
  -- cannot be used as a free oracle for which name is the admin's.
  select attempts, last_attempt into v_attempts, v_last
  from public.admin_signin_attempts where member_id = coalesce(v_member_id, v_super);

  if v_attempts >= 5 and v_last > now() - interval '15 minutes' then
    raise exception 'Too many attempts. Wait 15 minutes before trying again.';
  end if;

  if v_last is not null and v_last <= now() - interval '15 minutes' then
    v_attempts := 0;  -- cool-off served
  end if;

  if v_member_id is not null then
    select password_hash into v_hash
    from public.admin_credentials where member_id = v_member_id;
  end if;

  -- crypt() re-hashes the candidate with the stored salt, so this costs bcrypt
  -- work per guess rather than a plaintext comparison.
  if v_member_id is null
     or v_hash is null
     or v_hash <> crypt(coalesce(p_password, ''), v_hash)
  then
    insert into public.admin_signin_attempts (member_id, attempts, last_attempt)
    values (coalesce(v_member_id, v_super), coalesce(v_attempts, 0) + 1, now())
    on conflict (member_id) do update
      set attempts = coalesce(v_attempts, 0) + 1, last_attempt = now();

    insert into public.audit_log (actor_id, action, entity, entity_id)
    values (null, 'auth.admin_signin_failed', 'members', v_super);

    -- One message for a wrong name, a wrong password, and no password having been
    -- set at all: any difference would say something useful to a guesser.
    raise exception 'That name or password is not valid.';
  end if;

  -- Binding moves to this session, which is the point: the previous device may be
  -- lost, wiped, or simply signed out.
  update public.members set auth_user_id = auth.uid() where id = v_member_id;
  delete from public.admin_signin_attempts where member_id = v_member_id;

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (v_member_id, 'auth.admin_signin', 'members', v_member_id);

  return v_member_id;
end;
$$;

-- Does the super admin have a password yet? Lets the UI prompt for one on first
-- run instead of leaving the account unreachable. Reveals nothing but a boolean.
create or replace function public.admin_password_is_set()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.admin_credentials ac
    join public.group_settings gs on gs.super_admin_member_id = ac.member_id
    where gs.id = 1
  );
$$;

revoke all on function public.set_admin_password(text)          from public, anon;
revoke all on function public.sign_in_super_admin(text, text)   from public, anon;
revoke all on function public.admin_password_is_set()           from public, anon;
grant execute on function public.set_admin_password(text)        to authenticated;
grant execute on function public.sign_in_super_admin(text, text) to authenticated;
grant execute on function public.admin_password_is_set()         to authenticated;

-- Unbind a member's device without issuing a new OTP — for a lost or handed-on
-- phone. Super admin only.
create or replace function public.reset_member_device(p_member_id text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'Only the super admin can reset a device';
  end if;

  update public.members set auth_user_id = null where id = p_member_id;
  delete from public.access_codes where member_id = p_member_id and redeemed_at is null;

  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (public.current_member_id(), 'auth.device_reset', 'members', p_member_id);
end;
$$;

-- Only the super admin sees the OTP table, and only its metadata — who has one
-- outstanding and when it lapses. The hash itself is of no use to anyone.
drop policy if exists access_codes_select on public.access_codes;
create policy access_codes_select on public.access_codes
  for select to authenticated
  using (public.is_super_admin());

-- No insert/update/delete policies exist: OTPs are created and consumed solely
-- through the security definer functions above, never by direct table writes.
-- access_code_attempts likewise gets no policies — only redeem_access_code()
-- touches it, and that runs as definer.

revoke all on function public.issue_access_code(text, integer)  from public, anon;
revoke all on function public.redeem_access_code(text, text)    from public, anon;
revoke all on function public.reset_member_device(text)         from public, anon;
grant execute on function public.issue_access_code(text, integer) to authenticated;
grant execute on function public.redeem_access_code(text, text)   to authenticated;
grant execute on function public.reset_member_device(text)        to authenticated;

-- Lets the client read its own resolved permissions in one call, rather than
-- trusting the copy it computed in the browser.
create or replace function public.my_access()
returns table (feature text, level public.access_level)
language sql stable security definer set search_path = public
as $$
  select f.feature, public.effective_level(public.current_member_id(), f.feature)
  from unnest(array[
    'dashboard', 'contributions', 'loan-collections',
    'defaulters', 'settlement', 'members', 'settings'
  ]) as f(feature);
$$;

grant execute on function public.my_access() to authenticated;

-- =============================================================================
-- 5. Row Level Security
-- =============================================================================
-- Every table is deny-by-default; the policies below are the only way in. The
-- anon role is granted nothing, so an unauthenticated caller holding the public
-- anon key sees an empty database.

alter table public.members           enable row level security;
alter table public.group_settings    enable row level security;
alter table public.weeks             enable row level security;
alter table public.contributions     enable row level security;
alter table public.loans             enable row level security;
alter table public.loan_installments enable row level security;
alter table public.expenses          enable row level security;
alter table public.access_roles      enable row level security;
alter table public.access_overrides  enable row level security;
alter table public.access_grants     enable row level security;
alter table public.audit_log         enable row level security;

-- Drop-then-create so the file can be re-run after a policy edit.
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('members','group_settings','weeks','contributions','loans',
                        'loan_installments','expenses','access_roles',
                        'access_overrides','access_grants','audit_log')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Members -------------------------------------------------------------------
-- Readable by any signed-in member regardless of the 'members' feature level:
-- names and avatar colours are needed on every screen, so hiding the Members tab
-- must not blank out the rest of the app. The feature level governs that tab.
create policy members_select on public.members
  for select to authenticated
  using (public.is_active_member());

create policy members_write on public.members
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Group settings ------------------------------------------------------------
create policy group_settings_select on public.group_settings
  for select to authenticated
  using (public.is_active_member());

create policy group_settings_write on public.group_settings
  for all to authenticated
  using (public.can_edit('settings'))
  with check (public.can_edit('settings'));

-- Weeks ---------------------------------------------------------------------
create policy weeks_select on public.weeks
  for select to authenticated
  using (public.is_active_member());

create policy weeks_write on public.weeks
  for all to authenticated
  using (public.can_edit('settings') or public.can_edit('contributions'))
  with check (public.can_edit('settings') or public.can_edit('contributions'));

-- Contributions -------------------------------------------------------------
create policy contributions_select on public.contributions
  for select to authenticated
  using (public.can_view('contributions'));

create policy contributions_insert on public.contributions
  for insert to authenticated
  with check (public.can_edit('contributions') and public.week_is_writable(week_num));

create policy contributions_update on public.contributions
  for update to authenticated
  using (public.can_edit('contributions') and public.week_is_writable(week_num))
  with check (public.can_edit('contributions') and public.week_is_writable(week_num));

create policy contributions_delete on public.contributions
  for delete to authenticated
  using (public.is_super_admin());

-- Loans ---------------------------------------------------------------------
create policy loans_select on public.loans
  for select to authenticated
  using (public.can_view('loan-collections'));

create policy loans_insert on public.loans
  for insert to authenticated
  with check (public.can_edit('loan-collections'));

create policy loans_update on public.loans
  for update to authenticated
  using (public.can_edit('loan-collections'))
  with check (public.can_edit('loan-collections'));

create policy loans_delete on public.loans
  for delete to authenticated
  using (public.is_super_admin());

-- Loan installments ---------------------------------------------------------
create policy loan_installments_select on public.loan_installments
  for select to authenticated
  using (public.can_view('loan-collections'));

create policy loan_installments_insert on public.loan_installments
  for insert to authenticated
  with check (public.can_edit('loan-collections') and public.week_is_writable(week_num));

create policy loan_installments_update on public.loan_installments
  for update to authenticated
  using (public.can_edit('loan-collections') and public.week_is_writable(week_num))
  with check (public.can_edit('loan-collections') and public.week_is_writable(week_num));

create policy loan_installments_delete on public.loan_installments
  for delete to authenticated
  using (public.is_super_admin());

-- Expenses ------------------------------------------------------------------
-- Expenses come off the profit pool, so every member may see them; only someone
-- with Settings edit may book them.
create policy expenses_select on public.expenses
  for select to authenticated
  using (public.is_active_member());

create policy expenses_write on public.expenses
  for all to authenticated
  using (public.can_edit('settings'))
  with check (public.can_edit('settings'));

-- Access control ------------------------------------------------------------
-- Readable by all members: everyone can see who holds which role, which is what
-- makes the arrangement accountable. Writable by the super admin alone.
create policy access_roles_select on public.access_roles
  for select to authenticated using (public.is_active_member());
create policy access_roles_write on public.access_roles
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy access_overrides_select on public.access_overrides
  for select to authenticated using (public.is_active_member());
create policy access_overrides_write on public.access_overrides
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy access_grants_select on public.access_grants
  for select to authenticated using (public.is_active_member());
create policy access_grants_write on public.access_grants
  for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- Audit log -----------------------------------------------------------------
-- Insert-and-read only. No update or delete policy exists, so the trail cannot be
-- rewritten through the API by anyone, super admin included.
create policy audit_log_select on public.audit_log
  for select to authenticated
  using (public.is_active_member());

create policy audit_log_insert on public.audit_log
  for insert to authenticated
  with check (actor_id = public.current_member_id());

-- =============================================================================
-- 6. Guard rails
-- =============================================================================

-- Exactly one super admin, and never zero: the role lives in group_settings, and
-- access_roles is kept consistent with it.
create or replace function public.sync_super_admin_role()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.super_admin_member_id is null then
    raise exception 'The group must always have a super admin';
  end if;

  -- Demote whoever held it before, promote the new holder.
  update public.access_roles set role = 'collector', updated_at = now()
  where role = 'superadmin' and member_id <> new.super_admin_member_id;

  insert into public.access_roles (member_id, role)
  values (new.super_admin_member_id, 'superadmin')
  on conflict (member_id) do update set role = 'superadmin', updated_at = now();

  return new;
end;
$$;

drop trigger if exists group_settings_super_admin on public.group_settings;
create trigger group_settings_super_admin
  after insert or update of super_admin_member_id on public.group_settings
  for each row execute function public.sync_super_admin_role();

-- Keep loans.status in step with repaid_amount, so a client cannot mark a loan
-- repaid without the money, or leave a fully repaid loan showing ACTIVE.
create or replace function public.sync_loan_status()
returns trigger
language plpgsql
as $$
begin
  new.status := case
    when new.repaid_amount >= new.requested_amount then 'REPAID'::public.loan_status
    else 'ACTIVE'::public.loan_status
  end;
  return new;
end;
$$;

drop trigger if exists loans_status_sync on public.loans;
create trigger loans_status_sync
  before insert or update of repaid_amount, requested_amount on public.loans
  for each row execute function public.sync_loan_status();

-- A loan's repaid_amount is derived, never sent by a client. Two collectors
-- recording installments at the same moment would otherwise both read the old
-- balance and write back the same new one, losing a payment. Recomputing from the
-- installment rows makes the balance a consequence of the ledger instead.
create or replace function public.recompute_loan_repaid()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_loan_id text := coalesce(new.loan_id, old.loan_id);
begin
  update public.loans l
  set repaid_amount = least(
        l.requested_amount,
        coalesce((
          select sum(li.amount)
          from public.loan_installments li
          where li.loan_id = v_loan_id and li.paid
        ), 0)
      )
  where l.id = v_loan_id;

  return null;
end;
$$;

drop trigger if exists loan_installments_recompute on public.loan_installments;
create trigger loan_installments_recompute
  after insert or update or delete on public.loan_installments
  for each row execute function public.recompute_loan_repaid();

-- Stamp writer and time on money rows without trusting the client to do it.
create or replace function public.stamp_row()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := public.current_member_id();
  return new;
end;
$$;

drop trigger if exists contributions_stamp on public.contributions;
create trigger contributions_stamp
  before insert or update on public.contributions
  for each row execute function public.stamp_row();

drop trigger if exists loan_installments_stamp on public.loan_installments;
create trigger loan_installments_stamp
  before insert or update on public.loan_installments
  for each row execute function public.stamp_row();

-- =============================================================================
-- 7. Realtime
-- =============================================================================
-- So a payment recorded on one phone appears on another without a refresh.
-- Realtime respects RLS, so subscribers only receive rows they could have read.
do $$
begin
  alter publication supabase_realtime add table public.contributions;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.loan_installments;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.loans;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.expenses;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.group_settings;
exception when duplicate_object then null; end $$;
do $$
begin
  alter publication supabase_realtime add table public.access_grants;
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 8. Privileges
-- =============================================================================
-- RLS decides row visibility, but table privileges decide whether the role may
-- attempt the statement at all. anon gets nothing.
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- =============================================================================
-- Done. Next: SUPABASE_SETUP.md, section "Bootstrapping the first super admin".
-- =============================================================================
