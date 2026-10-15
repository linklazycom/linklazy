-- =====================================================================
-- 032_batch9_link_management.sql  (Batch 9)  — additive only
-- Creates: short_links, short_link_secrets, link_blocklist, link_reports,
--          function consume_link_click(uuid),
--          function + trigger short_links_on_profile_status (on profiles)
-- Does NOT change any existing table, column, policy or data.
-- (The only touch on an existing table is ONE new AFTER trigger on profiles
--  that switches a banned/suspended user's links off and back on.)
--
-- PRE-CHECK (run first; every value must be NULL):
--   select to_regclass('public.short_links'),
--          to_regclass('public.short_link_secrets'),
--          to_regclass('public.link_blocklist'),
--          to_regclass('public.link_reports'),
--          to_regprocedure('public.consume_link_click(uuid)');
-- If anything is NOT null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch9 code (the code expects
-- these tables). The site keeps working if you run it before deploying.
--
-- ROLLBACK (no existing data is affected):
--   drop trigger  if exists short_links_profile_status on public.profiles;
--   drop function if exists public.short_links_on_profile_status();
--   drop function if exists public.consume_link_click(uuid);
--   drop table    if exists public.link_reports;
--   drop table    if exists public.link_blocklist;
--   drop table    if exists public.short_link_secrets;
--   drop table    if exists public.short_links;
-- =====================================================================

-- ---------- short_links ----------
create table if not exists public.short_links (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  slug             text not null,
  destination_url  text not null,
  title            text,
  folder           text,
  tags             text[] not null default '{}',
  is_active        boolean not null default true,
  has_password     boolean not null default false,
  expires_at       timestamptz,
  max_clicks       integer,
  click_count      integer not null default 0,
  last_clicked_at  timestamptz,
  -- Set only by the server: admin takedown, or the owner being banned/suspended.
  disabled_reason  text,
  disabled_at      timestamptz,
  disabled_note    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint short_links_slug_format check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$'),
  constraint short_links_dest_len    check (char_length(destination_url) <= 2048),
  constraint short_links_max_clicks  check (max_clicks is null or max_clicks > 0),
  constraint short_links_disabled_reason check (disabled_reason is null or disabled_reason in ('admin_takedown','owner_banned'))
);

create unique index if not exists short_links_slug_uidx   on public.short_links (slug);
create index        if not exists short_links_user_idx    on public.short_links (user_id, created_at desc);
create index        if not exists short_links_folder_idx  on public.short_links (user_id, folder);
create index        if not exists short_links_tags_gin    on public.short_links using gin (tags);

-- Password hashes live in their own table: no policy at all = only the server can read them.
create table if not exists public.short_link_secrets (
  link_id        uuid primary key references public.short_links(id) on delete cascade,
  password_hash  text not null,
  updated_at     timestamptz not null default now()
);

-- ---------- link_blocklist ----------
create table if not exists public.link_blocklist (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('domain','slug')),
  value       text not null check (value = lower(value) and char_length(value) between 1 and 253),
  reason      text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (kind, value)
);

-- ---------- link_reports ----------
create table if not exists public.link_reports (
  id              uuid primary key default gen_random_uuid(),
  link_id         uuid references public.short_links(id) on delete set null,
  slug            text not null,
  reason          text not null check (reason in ('phishing','malware','spam','illegal','other')),
  details         text,
  reporter_email  text,
  status          text not null default 'open' check (status in ('open','actioned','dismissed')),
  handled_by      uuid references auth.users(id) on delete set null,
  handled_at      timestamptz,
  admin_note      text,
  created_at      timestamptz not null default now()
);
create index if not exists link_reports_status_idx on public.link_reports (status, created_at desc);
create index if not exists link_reports_link_idx   on public.link_reports (link_id);

-- ---------- Row Level Security ----------
alter table public.short_links        enable row level security;
alter table public.short_link_secrets enable row level security;
alter table public.link_blocklist     enable row level security;
alter table public.link_reports       enable row level security;

-- Owners (and admins) may READ their links. Nobody can write through the public API:
-- every insert/update/delete goes through our server routes, which validate the URL,
-- blocklist, limits and rate limits first (same rule as Batch 7A).
drop policy if exists short_links_select on public.short_links;
create policy short_links_select on public.short_links
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists link_blocklist_select_admin on public.link_blocklist;
create policy link_blocklist_select_admin on public.link_blocklist
  for select to authenticated using (public.is_admin());

drop policy if exists link_reports_select_admin on public.link_reports;
create policy link_reports_select_admin on public.link_reports
  for select to authenticated using (public.is_admin());

-- Belt and braces: even if a write policy were added by mistake later, these
-- roles still could not write (service_role is unaffected).
revoke all on public.short_links        from anon;
revoke all on public.short_link_secrets from anon, authenticated;
revoke all on public.link_blocklist     from anon;
revoke all on public.link_reports       from anon;
revoke insert, update, delete, truncate on public.short_links    from authenticated;
revoke insert, update, delete, truncate on public.link_blocklist from authenticated;
revoke insert, update, delete, truncate on public.link_reports   from authenticated;

-- ---------- atomic click counter ----------
-- Increments the counter and enforces max_clicks in ONE statement, so two
-- simultaneous visitors can never both take the last click.
create or replace function public.consume_link_click(p_link_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.short_links
     set click_count     = click_count + 1,
         last_clicked_at = now()
   where id = p_link_id
     and (max_clicks is null or click_count < max_clicks)
  returning id into v_id;
  return v_id is not null;
end;
$$;

revoke all on function public.consume_link_click(uuid) from public, anon, authenticated;
grant execute on function public.consume_link_click(uuid) to service_role;

-- ---------- banned / suspended owners lose their links (and get them back) ----------
create or replace function public.short_links_on_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now_off boolean := coalesce(new.is_banned, false) or coalesce(new.is_suspended, false);
  v_was_off boolean := coalesce(old.is_banned, false) or coalesce(old.is_suspended, false);
begin
  if v_now_off and not v_was_off then
    update public.short_links
       set disabled_reason = 'owner_banned', disabled_at = now()
     where user_id = new.id and disabled_reason is null;
  elsif v_was_off and not v_now_off then
    update public.short_links
       set disabled_reason = null, disabled_at = null
     where user_id = new.id and disabled_reason = 'owner_banned';
  end if;
  return new;
end;
$$;

drop trigger if exists short_links_profile_status on public.profiles;
create trigger short_links_profile_status
  after update of is_banned, is_suspended on public.profiles
  for each row execute function public.short_links_on_profile_status();
