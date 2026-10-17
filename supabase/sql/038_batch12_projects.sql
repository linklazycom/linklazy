-- =====================================================================
-- 038_batch12_projects.sql  (Batch 12)  — additive only
-- Creates: projects, project_keywords
-- Adds:    short_links.project_id (nullable) + one BEFORE trigger on short_links
--          that stops a link from pointing at someone else's project
-- Does NOT change any existing policy, existing column or existing data.
--
-- PRE-CHECK (run first; expect: both NULL, and column_exists = false):
--   select to_regclass('public.projects') as projects,
--          to_regclass('public.project_keywords') as project_keywords,
--          exists (select 1 from information_schema.columns
--                  where table_schema='public' and table_name='short_links' and column_name='project_id') as column_exists;
-- If anything is different, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch12 code.
-- The site keeps working if you run it before deploying.
--
-- ROLLBACK (links stay; projects and keywords are lost):
--   drop trigger  if exists short_links_project_owner on public.short_links;
--   drop function if exists public.short_links_check_project_owner();
--   alter table public.short_links drop column if exists project_id;
--   drop table if exists public.project_keywords;
--   drop table if exists public.projects;
-- =====================================================================

-- ---------- projects ----------
create table if not exists public.projects (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  canonical_url text not null,
  domain        text not null,            -- host without "www.", lowercase; one project per domain per user
  description   text,
  niche         text,
  country       text,                     -- ISO 3166-1 alpha-2, e.g. 'US'
  language      text,                     -- e.g. 'en' or 'pt-BR'
  competitors   text[] not null default '{}',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint projects_name_len     check (char_length(name) between 1 and 80),
  constraint projects_url_len      check (char_length(canonical_url) between 8 and 2048),
  constraint projects_domain_fmt   check (domain = lower(domain) and char_length(domain) between 3 and 253),
  constraint projects_desc_len     check (description is null or char_length(description) <= 1000),
  constraint projects_niche_len    check (niche is null or char_length(niche) <= 60),
  constraint projects_country_fmt  check (country is null or country ~ '^[A-Z]{2}$'),
  constraint projects_language_fmt check (language is null or language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  constraint projects_comp_count   check (cardinality(competitors) <= 10),
  constraint projects_notes_len    check (notes is null or char_length(notes) <= 2000)
);

create unique index if not exists projects_user_domain_uidx on public.projects (user_id, domain);
create index        if not exists projects_user_idx          on public.projects (user_id, created_at desc);

-- ---------- project_keywords ----------
create table if not exists public.project_keywords (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  keyword     text not null,
  created_at  timestamptz not null default now(),
  constraint project_keywords_len check (char_length(keyword) between 2 and 80)
);
create unique index if not exists project_keywords_uidx on public.project_keywords (project_id, lower(keyword));
create index        if not exists project_keywords_project_idx on public.project_keywords (project_id, created_at);

-- ---------- short_links: optional project link ----------
alter table public.short_links
  add column if not exists project_id uuid references public.projects(id) on delete set null;
create index if not exists short_links_project_idx on public.short_links (project_id) where project_id is not null;

-- A link may only point at a project owned by the SAME user (defence in depth; the server checks too).
create or replace function public.short_links_check_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.project_id is not null
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'project does not belong to the link owner' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.short_links_check_project_owner() from public, anon, authenticated;

drop trigger if exists short_links_project_owner on public.short_links;
create trigger short_links_project_owner
  before insert or update of project_id, user_id on public.short_links
  for each row execute function public.short_links_check_project_owner();

-- ---------- Row Level Security ----------
alter table public.projects         enable row level security;
alter table public.project_keywords enable row level security;

-- Owners (and admins) may READ. All writes go through our server routes (service role).
drop policy if exists projects_select on public.projects;
create policy projects_select on public.projects
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists project_keywords_select on public.project_keywords;
create policy project_keywords_select on public.project_keywords
  for select to authenticated
  using (exists (
    select 1 from public.projects p
    where p.id = project_keywords.project_id and (p.user_id = auth.uid() or public.is_admin())
  ));

revoke all on public.projects         from anon;
revoke all on public.project_keywords from anon;
revoke insert, update, delete, truncate on public.projects         from authenticated;
revoke insert, update, delete, truncate on public.project_keywords from authenticated;
grant select on public.projects         to authenticated;  -- explicit, so the policies work whatever the project's default privileges are
grant select on public.project_keywords to authenticated;
