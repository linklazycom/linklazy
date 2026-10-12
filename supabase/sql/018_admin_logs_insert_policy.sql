-- 018_admin_logs_insert_policy.sql
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Problem: admin_logs only has a SELECT policy. Admin actions that write the audit log
-- with the admin's own session (suspend, flag, site approve/reject, ...) were silently
-- rejected, so those actions left NO audit trail.
-- Fix: let a logged-in admin insert log rows that carry their own id.

drop policy if exists admin_logs_admin_insert on public.admin_logs;

create policy admin_logs_admin_insert on public.admin_logs
  for insert
  with check (public.is_admin() and admin_id = auth.uid());
