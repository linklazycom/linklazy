-- =====================================================================
-- 034_batch10_analytics_bio.sql  (Batch 10)  — additive only
-- Creates: link_clicks, link_click_rollups, bio_pages, bio_links
--          functions: record_link_click, rollup_link_clicks,
--                     link_analytics_data, link_analytics, link_usage_stats,
--                     bump_bio_view, bump_bio_link_click,
--                     bio_pages_on_profile_status (+ trigger on profiles)
-- Does NOT change or delete any existing table, column, policy or data.
-- (The click counter used by Batch 9 stays; the redirect route now calls
--  record_link_click, which also keeps short_links.click_count correct.)
--
-- PRE-CHECK (run first; every value must be NULL):
--   select to_regclass('public.link_clicks'),
--          to_regclass('public.link_click_rollups'),
--          to_regclass('public.bio_pages'),
--          to_regclass('public.bio_links'),
--          to_regprocedure('public.record_link_click(uuid,text,text,text,text,text,text)');
-- If anything is NOT null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch10 code.
--   (If you deploy the code first, link redirects keep working but click
--    counting silently stops until this file is run.)
--
-- ROLLBACK (no existing data is affected):
--   drop trigger  if exists bio_pages_profile_status on public.profiles;
--   drop function if exists public.bio_pages_on_profile_status();
--   drop function if exists public.bump_bio_link_click(uuid);
--   drop function if exists public.bump_bio_view(uuid);
--   drop function if exists public.link_usage_stats();
--   drop function if exists public.link_analytics(uuid, integer);
--   drop function if exists public.link_analytics_data(uuid, integer);
--   drop function if exists public.rollup_link_clicks(integer);
--   drop function if exists public.record_link_click(uuid,text,text,text,text,text,text);
--   drop table    if exists public.bio_links;
--   drop table    if exists public.bio_pages;
--   drop table    if exists public.link_click_rollups;
--   drop table    if exists public.link_clicks;
-- =====================================================================

-- ---------- link_clicks (raw, kept for the retention window) ----------
create table if not exists public.link_clicks (
  id            bigint generated always as identity primary key,
  link_id       uuid not null references public.short_links(id) on delete cascade,
  clicked_at    timestamptz not null default now(),
  source        text not null default 'direct' check (source in ('direct','qr')),
  country       text check (country is null or country ~ '^[A-Z]{2}$'),
  device        text not null default 'other' check (device in ('desktop','mobile','tablet','other')),
  browser       text not null default 'other' check (browser in ('chrome','safari','firefox','edge','opera','samsung','other')),
  referrer_host text check (referrer_host is null or char_length(referrer_host) <= 100),
  -- Hash of (daily-rotating secret + IP + user agent). The raw IP is never stored.
  visitor_hash  text check (visitor_hash is null or char_length(visitor_hash) <= 64)
);
create index if not exists link_clicks_link_time_idx   on public.link_clicks (link_id, clicked_at desc);
create index if not exists link_clicks_dedupe_idx      on public.link_clicks (link_id, visitor_hash, clicked_at desc) where visitor_hash is not null;
create index if not exists link_clicks_time_idx        on public.link_clicks (clicked_at);

-- ---------- link_click_rollups (old days summarised, raw rows deleted) ----------
create table if not exists public.link_click_rollups (
  link_id  uuid not null references public.short_links(id) on delete cascade,
  day      date not null,
  dim      text not null check (dim in ('total','source','country','device','browser','referrer')),
  key      text not null,
  clicks   integer not null default 0,
  uniques  integer not null default 0,
  primary key (link_id, day, dim, key)
);

-- ---------- bio_pages / bio_links ----------
create table if not exists public.bio_pages (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  slug            text not null,
  display_name    text not null,
  bio             text,
  avatar_url      text,
  theme           text not null default 'light',
  is_published    boolean not null default false,
  view_count      integer not null default 0,
  disabled_reason text,
  disabled_at     timestamptz,
  disabled_note   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint bio_pages_slug_format  check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9_-]{1,38}[a-z0-9]$'),
  constraint bio_pages_theme        check (theme in ('light','dark','violet','sunset','ocean','forest')),
  constraint bio_pages_name_len     check (char_length(display_name) between 1 and 60),
  constraint bio_pages_bio_len      check (bio is null or char_length(bio) <= 300),
  constraint bio_pages_avatar_len   check (avatar_url is null or char_length(avatar_url) <= 500),
  constraint bio_pages_disabled     check (disabled_reason is null or disabled_reason in ('admin_takedown','owner_banned'))
);
create unique index if not exists bio_pages_slug_uidx on public.bio_pages (slug);
create index        if not exists bio_pages_user_idx  on public.bio_pages (user_id, created_at desc);

create table if not exists public.bio_links (
  id          uuid primary key default gen_random_uuid(),
  bio_id      uuid not null references public.bio_pages(id) on delete cascade,
  title       text not null,
  url         text not null,
  position    integer not null default 0,
  is_active   boolean not null default true,
  click_count integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint bio_links_title_len check (char_length(title) between 1 and 80),
  constraint bio_links_url_len   check (char_length(url) <= 2048)
);
create index if not exists bio_links_bio_idx on public.bio_links (bio_id, position);

-- ---------- Row Level Security ----------
alter table public.link_clicks        enable row level security;
alter table public.link_click_rollups enable row level security;
alter table public.bio_pages          enable row level security;
alter table public.bio_links          enable row level security;

-- Click tables: NO policies at all. They are only reachable through the
-- security-definer functions below (which check ownership) or the server.
revoke all on public.link_clicks        from anon, authenticated;
revoke all on public.link_click_rollups from anon, authenticated;

-- Bio: owners/admins may READ. All writes go through our server routes.
drop policy if exists bio_pages_select on public.bio_pages;
create policy bio_pages_select on public.bio_pages
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists bio_links_select on public.bio_links;
create policy bio_links_select on public.bio_links
  for select to authenticated
  using (exists (
    select 1 from public.bio_pages p
    where p.id = bio_links.bio_id and (p.user_id = auth.uid() or public.is_admin())
  ));

revoke all on public.bio_pages from anon;
revoke all on public.bio_links from anon;
revoke insert, update, delete, truncate on public.bio_pages from authenticated;
revoke insert, update, delete, truncate on public.bio_links from authenticated;

-- ---------- record_link_click: count + log in ONE atomic step ----------
-- Returns false only when the link's click limit is already used up.
-- A second click by the same visitor within 10 seconds (double-click, refresh)
-- is treated as the same click: nothing is counted or logged again.
create or replace function public.record_link_click(
  p_link_id  uuid,
  p_source   text,
  p_country  text,
  p_device   text,
  p_browser  text,
  p_referrer text,
  p_visitor  text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_visitor is not null and exists (
    select 1 from public.link_clicks
     where link_id = p_link_id
       and visitor_hash = p_visitor
       and clicked_at > now() - interval '10 seconds'
  ) then
    return true;
  end if;

  update public.short_links
     set click_count     = click_count + 1,
         last_clicked_at = now()
   where id = p_link_id
     and (max_clicks is null or click_count < max_clicks)
  returning id into v_id;

  if v_id is null then
    return false;
  end if;

  insert into public.link_clicks (link_id, source, country, device, browser, referrer_host, visitor_hash)
  values (p_link_id, p_source, p_country, p_device, p_browser, p_referrer, p_visitor);
  return true;
end;
$$;
revoke all on function public.record_link_click(uuid,text,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.record_link_click(uuid,text,text,text,text,text,text) to service_role;

-- ---------- rollup: summarise whole old days, then delete the raw rows ----------
create or replace function public.rollup_link_clicks(p_keep_days integer default 90)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff  timestamptz;
  v_deleted bigint;
begin
  -- Start of the UTC day (p_keep_days ago). Only whole days are ever rolled up.
  v_cutoff := (date_trunc('day', now() at time zone 'utc') - make_interval(days => greatest(p_keep_days, 7))) at time zone 'utc';

  insert into public.link_click_rollups (link_id, day, dim, key, clicks, uniques)
  select c.link_id,
         (c.clicked_at at time zone 'utc')::date,
         d.dim,
         d.key,
         count(*)::integer,
         count(distinct c.visitor_hash)::integer
    from public.link_clicks c
   cross join lateral (values
          ('total'::text,    'all'::text),
          ('source'::text,   c.source),
          ('country'::text,  coalesce(c.country, '??')),
          ('device'::text,   c.device),
          ('browser'::text,  c.browser),
          ('referrer'::text, coalesce(c.referrer_host, '(direct)'))
        ) as d(dim, key)
   where c.clicked_at < v_cutoff
   group by 1, 2, 3, 4
  on conflict (link_id, day, dim, key) do update
     set clicks  = public.link_click_rollups.clicks  + excluded.clicks,
         uniques = public.link_click_rollups.uniques + excluded.uniques;

  with del as (
    delete from public.link_clicks where clicked_at < v_cutoff returning 1
  )
  select count(*) into v_deleted from del;

  return coalesce(v_deleted, 0);
end;
$$;
revoke all on function public.rollup_link_clicks(integer) from public, anon, authenticated;
grant execute on function public.rollup_link_clicks(integer) to service_role;

-- ---------- analytics: raw (recent) + rollups (old), one JSON result ----------
create or replace function public.link_analytics_data(p_link_id uuid, p_days integer)
returns jsonb
language sql
stable
set search_path = public
as $$
  with params as (
    select greatest(1, least(coalesce(p_days, 30), 365)) as n
  ),
  win as (
    select ((now() at time zone 'utc')::date - ((select n from params) - 1)) as from_day
  ),
  facts as (
    select r.day, r.dim, r.key, r.clicks::bigint as clicks, r.uniques::bigint as uniques
      from public.link_click_rollups r, win
     where r.link_id = p_link_id and r.day >= win.from_day
    union all
    select (c.clicked_at at time zone 'utc')::date as day, d.dim, d.key,
           count(*)::bigint as clicks, count(distinct c.visitor_hash)::bigint as uniques
      from public.link_clicks c
      cross join win
      cross join lateral (values
             ('total'::text,    'all'::text),
             ('source'::text,   c.source),
             ('country'::text,  coalesce(c.country, '??')),
             ('device'::text,   c.device),
             ('browser'::text,  c.browser),
             ('referrer'::text, coalesce(c.referrer_host, '(direct)'))
           ) as d(dim, key)
     where c.link_id = p_link_id
       and c.clicked_at >= (win.from_day::timestamp at time zone 'utc')
     group by 1, 2, 3
  )
  select jsonb_build_object(
    'days', (select n from params),
    'from', (select from_day from win),
    'totals', jsonb_build_object(
      'clicks',  coalesce((select sum(clicks)  from facts where dim = 'total'), 0),
      'uniques', coalesce((select sum(uniques) from facts where dim = 'total'), 0),
      'qr',      coalesce((select sum(clicks)  from facts where dim = 'source' and key = 'qr'), 0)
    ),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', x.day, 'clicks', x.clicks, 'uniques', x.uniques) order by x.day)
        from (select day, sum(clicks) as clicks, sum(uniques) as uniques from facts where dim = 'total' group by day) x
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.key, 'clicks', x.clicks) order by x.clicks desc)
        from (select key, sum(clicks) as clicks from facts where dim = 'country' group by key order by 2 desc limit 10) x
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.key, 'clicks', x.clicks) order by x.clicks desc)
        from (select key, sum(clicks) as clicks from facts where dim = 'device' group by key order by 2 desc limit 10) x
    ), '[]'::jsonb),
    'browsers', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.key, 'clicks', x.clicks) order by x.clicks desc)
        from (select key, sum(clicks) as clicks from facts where dim = 'browser' group by key order by 2 desc limit 10) x
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.key, 'clicks', x.clicks) order by x.clicks desc)
        from (select key, sum(clicks) as clicks from facts where dim = 'referrer' group by key order by 2 desc limit 10) x
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object('key', x.key, 'clicks', x.clicks) order by x.clicks desc)
        from (select key, sum(clicks) as clicks from facts where dim = 'source' group by key order by 2 desc) x
    ), '[]'::jsonb)
  );
$$;
revoke all on function public.link_analytics_data(uuid, integer) from public, anon, authenticated;
grant execute on function public.link_analytics_data(uuid, integer) to service_role;

-- Public entry point: only the link's owner (or an admin) gets data; everyone else gets NULL.
create or replace function public.link_analytics(p_link_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.short_links
     where id = p_link_id and (user_id = auth.uid() or public.is_admin())
  ) then
    return null;
  end if;
  return public.link_analytics_data(p_link_id, p_days);
end;
$$;
revoke all on function public.link_analytics(uuid, integer) from public, anon;
grant execute on function public.link_analytics(uuid, integer) to authenticated, service_role;

-- ---------- admin usage numbers ----------
create or replace function public.link_usage_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return null;
  end if;
  return jsonb_build_object(
    'links',           (select count(*) from public.short_links),
    'clicks_total',    (select coalesce(sum(click_count), 0) from public.short_links),
    'clicks_24h',      (select count(*) from public.link_clicks where clicked_at > now() - interval '24 hours'),
    'clicks_7d',       (select count(*) from public.link_clicks where clicked_at > now() - interval '7 days'),
    'bio_pages',       (select count(*) from public.bio_pages),
    'bio_published',   (select count(*) from public.bio_pages where is_published and disabled_reason is null),
    'bio_views',       (select coalesce(sum(view_count), 0) from public.bio_pages),
    'bio_link_clicks', (select coalesce(sum(click_count), 0) from public.bio_links)
  );
end;
$$;
revoke all on function public.link_usage_stats() from public, anon;
grant execute on function public.link_usage_stats() to authenticated, service_role;

-- ---------- bio counters ----------
create or replace function public.bump_bio_view(p_bio_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bio_pages set view_count = view_count + 1 where id = p_bio_id;
$$;
revoke all on function public.bump_bio_view(uuid) from public, anon, authenticated;
grant execute on function public.bump_bio_view(uuid) to service_role;

create or replace function public.bump_bio_link_click(p_link_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bio_links set click_count = click_count + 1 where id = p_link_id;
$$;
revoke all on function public.bump_bio_link_click(uuid) from public, anon, authenticated;
grant execute on function public.bump_bio_link_click(uuid) to service_role;

-- ---------- banned / suspended owners lose their bio pages (and get them back) ----------
create or replace function public.bio_pages_on_profile_status()
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
    update public.bio_pages
       set disabled_reason = 'owner_banned', disabled_at = now()
     where user_id = new.id and disabled_reason is null;
  elsif v_was_off and not v_now_off then
    update public.bio_pages
       set disabled_reason = null, disabled_at = null
     where user_id = new.id and disabled_reason = 'owner_banned';
  end if;
  return new;
end;
$$;

drop trigger if exists bio_pages_profile_status on public.profiles;
create trigger bio_pages_profile_status
  after update of is_banned, is_suspended on public.profiles
  for each row execute function public.bio_pages_on_profile_status();
