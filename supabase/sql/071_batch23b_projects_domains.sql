-- 071_batch23b_projects_domains.sql (Batch 23B) — additive only, safe to run twice. Changes no existing data.
-- Adds: (1) a "paused by admin" mark on projects, (2) the counters for the daily custom-domain ownership re-check.
-- Run BEFORE or AFTER deploying the batch23b code: the code works without it (project pause and domain re-check simply do nothing until it exists).
-- ROLLBACK (loses only the new marks):
--   alter table public.projects drop column if exists suspended_at, drop column if exists suspended_reason, drop column if exists suspended_by;
--   alter table public.custom_domains drop column if exists recheck_failures, drop column if exists last_recheck_at;

alter table public.projects
  add column if not exists suspended_at     timestamptz,
  add column if not exists suspended_reason text,
  add column if not exists suspended_by     uuid references auth.users(id) on delete set null;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'projects_suspended_reason_len') then
    alter table public.projects add constraint projects_suspended_reason_len
      check (suspended_reason is null or char_length(suspended_reason) <= 500);
  end if;
end $$;

create index if not exists projects_suspended_idx on public.projects (suspended_at) where suspended_at is not null;

alter table public.custom_domains
  add column if not exists recheck_failures integer not null default 0,
  add column if not exists last_recheck_at  timestamptz;

create index if not exists custom_domains_recheck_idx on public.custom_domains (last_recheck_at nulls first) where status in ('verified','active');
