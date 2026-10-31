-- 067_batch21_cron_runs.sql (Batch 21) — additive only, safe to run twice.
-- One row per scheduled job: when it last finished / last succeeded. Shown in Admin > Operations.
-- Server-only table: RLS on and NO policy, so nobody can read or write it from a browser; only the server key can.
-- Run BEFORE deploying the batch21 code (the jobs keep working without it; they just cannot record).
-- ROLLBACK: drop table if exists public.cron_runs;
create table if not exists public.cron_runs (
  name             text primary key,
  last_started_at  timestamptz,
  last_finished_at timestamptz,
  last_ok_at       timestamptz,
  last_status      text check (last_status in ('ok','failed')),
  last_http        integer,
  last_duration_ms integer
);
alter table public.cron_runs enable row level security;
revoke all on public.cron_runs from anon, authenticated;
