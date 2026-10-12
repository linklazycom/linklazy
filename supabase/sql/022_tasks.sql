-- =====================================================================
-- 022_tasks.sql  (Batch 6)  — background task queue (additive only)
-- Creates: public.tasks, public.task_logs, function claim_next_task()
-- Safe to run more than once. Does NOT touch any existing table.
--
-- PRE-CHECK (run first, must return NULL for both):
--   select to_regclass('public.tasks'), to_regclass('public.task_logs');
-- If either is NOT null, a table with that name already exists — STOP and
-- send me the result instead of running this file.
--
-- ROLLBACK (only if you need to undo; no existing data is affected):
--   drop function if exists public.claim_next_task(text[], int);
--   drop table if exists public.task_logs;
--   drop table if exists public.tasks;
-- =====================================================================

create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  type             text not null,
  status           text not null default 'queued'
                   check (status in ('queued','running','succeeded','failed','cancelled')),
  user_id          uuid references auth.users(id) on delete set null,
  project_id       uuid,
  payload          jsonb not null default '{}'::jsonb,
  result           jsonb,
  attempts         int  not null default 0,
  max_attempts     int  not null default 3,
  run_at           timestamptz not null default now(),
  locked_at        timestamptz,
  started_at       timestamptz,
  finished_at      timestamptz,
  idempotency_key  text,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists tasks_idempotency_key_uidx
  on public.tasks (idempotency_key) where idempotency_key is not null;
create index if not exists tasks_due_idx  on public.tasks (status, run_at);
create index if not exists tasks_user_idx on public.tasks (user_id, created_at desc);

create table if not exists public.task_logs (
  id         bigserial primary key,
  task_id    uuid not null references public.tasks(id) on delete cascade,
  level      text not null default 'info',
  message    text not null,
  created_at timestamptz not null default now()
);
create index if not exists task_logs_task_idx on public.task_logs (task_id, created_at);

-- Row Level Security: ON with NO policies = only the server (service role)
-- can read or write these tables. Users get access later through API routes.
alter table public.tasks     enable row level security;
alter table public.task_logs enable row level security;

-- Atomically claims the next due task. FOR UPDATE SKIP LOCKED means two
-- runners can never take the same task. Tasks stuck in "running" (a runner
-- that crashed) are re-queued — or failed if they are out of attempts.
create or replace function public.claim_next_task(
  p_types text[] default null,
  p_stale_after_minutes int default 10
)
returns setof public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.tasks
     set status      = case when attempts >= max_attempts then 'failed' else 'queued' end,
         finished_at = case when attempts >= max_attempts then now() else finished_at end,
         locked_at   = null,
         last_error  = 'Runner stopped before finishing',
         updated_at  = now()
   where status = 'running'
     and locked_at < now() - make_interval(mins => p_stale_after_minutes);

  select id into v_id
    from public.tasks
   where status = 'queued'
     and run_at <= now()
     and (p_types is null or type = any(p_types))
   order by run_at asc
   limit 1
   for update skip locked;

  if v_id is null then
    return;
  end if;

  return query
    with u as (
      update public.tasks
         set status     = 'running',
             attempts   = attempts + 1,
             locked_at  = now(),
             started_at = coalesce(started_at, now()),
             updated_at = now()
       where id = v_id
      returning *
    )
    select * from u;
end;
$$;

-- Only the server may call it.
revoke all on function public.claim_next_task(text[], int) from public, anon, authenticated;
grant execute on function public.claim_next_task(text[], int) to service_role;
