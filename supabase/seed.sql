-- =============================================================================
-- Isthooi — seed a fresh group
-- =============================================================================
-- Run AFTER schema.sql, once. Creates the roster, the 52-week calendar and the
-- group settings, and appoints Rajeesh as super admin.
--
-- The roster, numbers and start date below are the real ones for this group:
-- 9 members, ₹1000 a Sunday, cycle starting 23 Aug 2026, Rajeesh as super admin.
-- The ONE thing to edit before running is the password on the last line.
--
-- Safe to re-run: every insert is ON CONFLICT DO NOTHING, so it will not clobber
-- a group that is already live. Note that means editing a name or number here and
-- re-running will NOT update an existing row — use an UPDATE for that.
-- =============================================================================

begin;

-- 1. Members ------------------------------------------------------------------
-- Numbers are stored in E.164 (+91…). redeem_access_code() strips non-digits before
-- comparing, so a member may type 9747686029, +91 97476 86029, or 097476-86029 and
-- all three match. The same numbers drive the WhatsApp reminder buttons.
insert into public.members (id, name, phone, upi_id, avatar_color) values
  ('m1', 'Krishnadas',     '+919747686029', 'krishnadas@upi',     '#10b981'),
  ('m2', 'Murali',         '+919037964605', 'murali@upi',         '#6366f1'),
  ('m3', 'Rajan',          '+917907800755', 'rajan@upi',          '#ec4899'),
  ('m4', 'Rajeesh',        '+918089763400', 'rajeesh@upi',        '#f59e0b'),
  ('m5', 'Sajeev',         '+919744824294', 'sajeev@upi',         '#3b82f6'),
  ('m6', 'Sathyaprakasan', '+919744792882', 'sathyaprakasan@upi', '#8b5cf6'),
  ('m7', 'Udayan',         '+919544323571', 'udayan@upi',         '#14b8a6'),
  ('m8', 'Ullas',          '+919544008784', 'ullas@upi',          '#f43f5e'),
  ('m9', 'Vidyadas',       '+919961102489', 'vidyadas@upi',       '#84cc16')
on conflict (id) do nothing;

-- 2. Weeks --------------------------------------------------------------------
-- 52 consecutive Sundays from the group's first collection Sunday.
-- Week 1  = 23 Aug 2026
-- Week 52 = 15 Aug 2027
insert into public.weeks (week_num, week_date, display_date)
select
  n,
  d,
  to_char(d, 'DD Mon YYYY')
from (
  select
    n,
    (date '2026-08-23' + ((n - 1) * 7))::date as d
  from generate_series(1, 52) as n
) weeks_calc
on conflict (week_num) do nothing;

-- 3. Group settings -----------------------------------------------------------
-- Inserting super_admin_member_id fires the trigger that writes the matching
-- 'superadmin' row into access_roles, so the two can never disagree.
insert into public.group_settings (
  id, group_name, weekly_amount, current_week_num,
  start_date, total_weeks, group_upi_vpa, group_notes, super_admin_member_id
) values (
  1, 'Isthooi Savings Group', 1000, 1,
  date '2026-08-23', 52, 'isthooi@upi',
  'Collection every Sunday around 8:00 PM.',
  'm4'   -- Rajeesh
)
on conflict (id) do nothing;

-- current_week_num stays 1 because the cycle starts on 23 Aug 2026. Advance it each
-- Sunday from Settings, or with:
--   update public.group_settings set current_week_num = 2 where id = 1;

-- 4. Roles --------------------------------------------------------------------
-- Everyone starts read-only. The super admin is exempt: the trigger on
-- group_settings above already wrote Rajeesh's 'superadmin' row, and the
-- ON CONFLICT DO NOTHING here leaves it alone.
--
-- Assign collectors from Settings → Access Control once signed in.
insert into public.access_roles (member_id, role)
select id, 'member'::public.member_role from public.members
on conflict (member_id) do nothing;

commit;

-- =============================================================================
-- 5. The super admin's password
-- =============================================================================
-- This is the one thing you must edit before running, and the last step of setup.
--
-- The super admin cannot be issued an OTP — they are the only one who can issue
-- them — so a password is their way in. It has to be set here because nobody is
-- signed in yet to set it from the app.
--
-- Replace the placeholder below with a real password. At least 12 characters; a
-- few unrelated words is both stronger and easier to remember than a short
-- scramble. Only a bcrypt hash is stored, so nobody can read it back out of the
-- database afterwards — including you.

select public.set_admin_password('CHANGE-THIS-Isthooi-2026');

-- IMPORTANT: after running this, clear the SQL editor. Supabase keeps recent
-- queries, and this one has your password in plaintext.
--
-- Then sign in: open the app, press "Group admin? Sign in with password", and
-- enter "Rajeesh" plus that password. Change it from Settings → Access Control
-- whenever you like; the value above is never needed again.
--
-- Everyone else gets in with an OTP you generate for them in Access Control.
--
-- Confirm it took:
--   select public.admin_password_is_set();   -- expect: true
