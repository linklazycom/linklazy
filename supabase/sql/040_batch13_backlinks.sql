-- =====================================================================
-- 040_batch13_backlinks.sql  (Batch 13)  — additive only
-- Creates: backlinks, backlink_checks (+ one BEFORE trigger on backlinks
--          that stops a backlink from pointing at someone else's project)
-- Does NOT change any existing table, column, policy, trigger or data.
--
-- PRE-CHECK (run first; both values must be NULL):
--   select to_regclass('public.backlinks') as backlinks, to_regclass('public.backlink_checks') as backlink_checks;
-- If anything is NOT null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch13 code.
-- The site keeps working if you run it before deploying.
--
-- ROLLBACK (no existing data is affected; tracked backlinks and check history are lost):
--   drop trigger  if exists backlinks_project_owner on public.backlinks;
--   drop function if exists public.backlinks_check_project_owner();
--   drop table if exists public.backlink_checks;
--   drop table if exists public.backlinks;
-- =====================================================================

-- ---------- backlinks ----------
create table if not exists public.backlinks (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  project_id            uuid references public.projects(id) on delete set null,
  source_url            text not null,          -- the page that should contain the link
  source_domain         text not null,          -- host of source_url, lowercase, without "www."
  target_url            text not null,          -- the page on the user's site the link should point to
  anchor_text           text,                   -- anchor text the user EXPECTS (optional)
  note                  text,
  origin                text not null default 'manual',
  -- unchecked | active | not_found | unavailable | check_failed | needs_review
  status                text not null default 'unchecked',
  reason                text,                   -- machine code of the last check, e.g. 'http_404'
  rel                   text,                   -- last seen link-type tokens (nofollow / sponsored / ugc), space separated
  is_follow             boolean,                -- null until a link has been seen
  found_href            text,
  found_anchor          text,
  page_robots           text,                   -- e.g. 'noindex,nofollow' from the source page, when present
  match_count           integer not null default 0,
  monitoring            boolean not null default true,
  consecutive_failures  integer not null default 0,
  first_found_at        timestamptz,
  last_found_at         timestamptz,
  last_checked_at       timestamptz,
  last_status_change_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint backlinks_status check (status in ('unchecked','active','not_found','unavailable','check_failed','needs_review')),
  constraint backlinks_origin check (origin in ('manual','csv')),
  constraint backlinks_source_len check (char_length(source_url) between 8 and 2048),
  constraint backlinks_target_len check (char_length(target_url) between 8 and 2048),
  constraint backlinks_domain_fmt check (source_domain = lower(source_domain) and char_length(source_domain) between 3 and 253),
  constraint backlinks_anchor_len check (anchor_text is null or char_length(anchor_text) <= 150),
  constraint backlinks_note_len check (note is null or char_length(note) <= 500),
  constraint backlinks_found_len check (
    (found_href is null or char_length(found_href) <= 2048) and (found_anchor is null or char_length(found_anchor) <= 300)
  ),
  constraint backlinks_failures check (consecutive_failures >= 0)
);

-- The same source page + target page pair can only be tracked once per user.
create unique index if not exists backlinks_user_pair_uidx on public.backlinks (user_id, source_url, target_url);
create index        if not exists backlinks_user_idx       on public.backlinks (user_id, created_at desc);
create index        if not exists backlinks_user_status_idx on public.backlinks (user_id, status);
create index        if not exists backlinks_project_idx    on public.backlinks (project_id) where project_id is not null;
create index        if not exists backlinks_due_idx        on public.backlinks (last_checked_at nulls first) where monitoring;

-- A backlink may only point at a project owned by the SAME user (defence in depth; the server checks too).
create or replace function public.backlinks_check_project_owner()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.project_id is not null
     and not exists (select 1 from public.projects p where p.id = new.project_id and p.user_id = new.user_id) then
    raise exception 'project does not belong to the backlink owner' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.backlinks_check_project_owner() from public, anon, authenticated;

drop trigger if exists backlinks_project_owner on public.backlinks;
create trigger backlinks_project_owner
  before insert or update of project_id, user_id on public.backlinks
  for each row execute function public.backlinks_check_project_owner();

-- ---------- backlink_checks (history; the server keeps the newest 30 per backlink) ----------
create table if not exists public.backlink_checks (
  id            uuid primary key default gen_random_uuid(),
  backlink_id   uuid not null references public.backlinks(id) on delete cascade,
  checked_at    timestamptz not null default now(),
  trigger       text not null default 'manual',
  status        text not null,
  reason        text,
  http_status   integer,
  final_url     text,
  rel           text,
  is_follow     boolean,
  found_href    text,
  found_anchor  text,
  page_robots   text,
  match_count   integer not null default 0,
  duration_ms   integer,
  evidence      text,                          -- the <a ...> tag as seen in the page HTML (stored and shown as plain text)
  constraint backlink_checks_trigger check (trigger in ('manual','scheduled')),
  constraint backlink_checks_status check (status in ('active','not_found','unavailable','check_failed','needs_review')),
  constraint backlink_checks_evidence_len check (evidence is null or char_length(evidence) <= 600)
);
create index if not exists backlink_checks_backlink_idx on public.backlink_checks (backlink_id, checked_at desc);

-- ---------- Row Level Security ----------
alter table public.backlinks       enable row level security;
alter table public.backlink_checks enable row level security;

-- Owners (and admins) may READ. All writes go through our server routes (service role).
drop policy if exists backlinks_select on public.backlinks;
create policy backlinks_select on public.backlinks
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists backlink_checks_select on public.backlink_checks;
create policy backlink_checks_select on public.backlink_checks
  for select to authenticated
  using (exists (
    select 1 from public.backlinks b
    where b.id = backlink_checks.backlink_id and (b.user_id = auth.uid() or public.is_admin())
  ));

revoke all on public.backlinks       from anon;
revoke all on public.backlink_checks from anon;
revoke insert, update, delete, truncate on public.backlinks       from authenticated;
revoke insert, update, delete, truncate on public.backlink_checks from authenticated;
grant select on public.backlinks       to authenticated;  -- explicit, so the policies work whatever the project's default privileges are
grant select on public.backlink_checks to authenticated;
