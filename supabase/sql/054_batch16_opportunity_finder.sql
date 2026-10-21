-- =====================================================================
-- 054_batch16_opportunity_finder.sql  (Batch 16: Opportunity Finder) — additive only
-- PREREQUISITES: 023 (api_providers; its kind check already allows 'search'), 038 (projects), 042 (usage charges).
-- Creates: opportunities, opportunity_runs, search_cache.
-- Safe to run twice. Sends nothing, calls nothing. Does NOT touch any existing table or row.
--
-- PRE-CHECK (expect a = true, b..d = NULL):
--   select to_regclass('public.projects') is not null as a, to_regclass('public.opportunities') b,
--          to_regclass('public.opportunity_runs') c, to_regclass('public.search_cache') d;
--
-- ORDER: run this file FIRST, then 055_batch16_verify.sql, then deploy the batch16 code.
--
-- ROLLBACK (found opportunities and notes are lost; projects, wallet and everything else are NOT touched):
--   drop table if exists public.opportunities;
--   drop table if exists public.opportunity_runs;
--   drop table if exists public.search_cache;
--   drop function if exists public.opportunities_check_project_owner();
-- =====================================================================

-- ---------- one row per place worth asking for a link ----------
create table if not exists public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  opp_type    text not null,
  url         text not null,
  domain      text not null,
  title       text not null default '',
  snippet     text not null default '',
  query       text not null default '',
  provider    text not null default '',
  score       smallint not null default 0,
  confidence  text not null default 'unknown',
  breakdown   jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  status      text not null default 'new',
  note        text,
  found_at    timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint opportunities_type   check (opp_type in ('guest_post','directory','profile','resource_page','comment')),
  constraint opportunities_status check (status in ('new','saved','contacted','done','ignored')),
  constraint opportunities_conf   check (confidence in ('likely','possible','unknown')),
  constraint opportunities_score  check (score between 0 and 100),
  constraint opportunities_url    check (char_length(url) between 8 and 2048),
  constraint opportunities_domain check (domain = lower(domain) and char_length(domain) between 3 and 253),
  constraint opportunities_note   check (note is null or char_length(note) <= 1000),
  constraint opportunities_title  check (char_length(title) <= 300 and char_length(snippet) <= 600 and char_length(query) <= 300 and char_length(provider) <= 120)
);
-- One row per website and kind of opportunity inside a project (the best page wins; see the server code).
create unique index if not exists opportunities_dedupe_uidx on public.opportunities (project_id, domain, opp_type);
create index if not exists opportunities_user_list_idx on public.opportunities (user_id, project_id, score desc, found_at desc);
create index if not exists opportunities_status_idx on public.opportunities (project_id, status);

-- An opportunity may only belong to a project of the SAME user (defence in depth; the server checks too).
create or replace function public.opportunities_check_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'project does not belong to the opportunity owner' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists opportunities_check_project_owner_trg on public.opportunities;
create trigger opportunities_check_project_owner_trg before insert or update of project_id, user_id on public.opportunities
  for each row execute function public.opportunities_check_project_owner();

-- ---------- one row per "Find opportunities" run: history and the hourly limit ----------
create table if not exists public.opportunity_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  types       text[] not null default '{}',
  queries     integer not null default 0,
  hits        integer not null default 0,
  added       integer not null default 0,
  updated     integer not null default 0,
  from_cache  integer not null default 0,
  ok          boolean not null default true,
  error       text,
  created_at  timestamptz not null default now(),
  constraint opportunity_runs_counts check (queries >= 0 and hits >= 0 and added >= 0 and updated >= 0 and from_cache >= 0),
  constraint opportunity_runs_error  check (error is null or char_length(error) <= 300)
);
create index if not exists opportunity_runs_user_idx on public.opportunity_runs (user_id, created_at desc);
create index if not exists opportunity_runs_project_idx on public.opportunity_runs (project_id, created_at desc) where project_id is not null;

-- ---------- saved search answers, so the same phrase does not use the free quota twice ----------
create table if not exists public.search_cache (
  cache_key  text primary key,
  results    jsonb not null,
  provider   text not null default '',
  created_at timestamptz not null default now(),
  constraint search_cache_key check (char_length(cache_key) between 16 and 128)
);
create index if not exists search_cache_created_idx on public.search_cache (created_at);

-- ---------- Row Level Security ----------
alter table public.opportunities     enable row level security;
alter table public.opportunity_runs  enable row level security;
alter table public.search_cache      enable row level security;

drop policy if exists opportunities_select on public.opportunities;
create policy opportunities_select on public.opportunities for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists opportunity_runs_select on public.opportunity_runs;
create policy opportunity_runs_select on public.opportunity_runs for select to authenticated using (user_id = auth.uid() or public.is_admin());
-- search_cache: no policy at all = nobody but the server (service role) can read or write it.

-- All writes go through the server routes (service role) after the user is identified.
revoke all on public.opportunities, public.opportunity_runs, public.search_cache from anon, authenticated;
grant select on public.opportunities, public.opportunity_runs to authenticated;
