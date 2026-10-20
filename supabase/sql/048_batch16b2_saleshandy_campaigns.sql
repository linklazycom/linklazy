-- =====================================================================
-- 048_batch16b2_saleshandy_campaigns.sql  (Batch 16B-2)  — additive only
-- Creates: outreach_connection (Saleshandy API key, encrypted), outreach_campaigns, outreach_sends,
-- outreach_events and the function outreach_next_contacts() that picks who is mailed next.
-- Admin-only. Nothing here sends email by itself. Does NOT change any existing table, policy or data.
-- Requires 046 (outreach_contacts / outreach_suppressions) to be installed.
--
-- PRE-CHECK (run first; expect: 1 row with all four NULL, and "contacts_table" = outreach_contacts):
--   select to_regclass('public.outreach_connection') a, to_regclass('public.outreach_campaigns') b,
--          to_regclass('public.outreach_sends') c, to_regclass('public.outreach_events') d,
--          to_regclass('public.outreach_contacts') contacts_table;
-- If a-d are NOT all null, or contacts_table is null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch16b2 code.
--
-- ROLLBACK (campaign history is lost; contacts and the do-not-email list are NOT touched):
--   drop function if exists public.outreach_next_contacts(uuid, integer);
--   drop table if exists public.outreach_events;
--   drop table if exists public.outreach_sends;
--   drop table if exists public.outreach_campaigns;
--   drop table if exists public.outreach_connection;
-- =====================================================================

-- One row only: the Saleshandy connection.
create table if not exists public.outreach_connection (
  id                 smallint primary key default 1,
  provider           text not null default 'saleshandy',
  api_key_encrypted  text,
  api_key_hint       text,
  webhook_secret     text not null,
  field_map          jsonb not null default '{}'::jsonb,
  last_test_at       timestamptz,
  last_test_ok       boolean,
  last_test_message  text,
  updated_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint outreach_connection_single   check (id = 1),
  constraint outreach_connection_provider check (provider in ('saleshandy')),
  constraint outreach_connection_secret   check (char_length(webhook_secret) between 24 and 100)
);

create table if not exists public.outreach_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  sequence_id        text not null,
  sequence_name      text,
  step_id            text not null,
  daily_cap          integer not null,
  status             text not null default 'paused',
  filter_tag         text,
  filter_country     text,
  filter_source      text,
  site_ids           uuid[] not null default '{}',
  next_site_index    integer not null default 0,
  pause_reason       text,
  last_push_at       timestamptz,
  last_push_summary  jsonb,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint outreach_campaigns_name    check (char_length(name) between 1 and 80),
  constraint outreach_campaigns_seq     check (sequence_id ~ '^[A-Za-z0-9_-]{1,60}$'),
  constraint outreach_campaigns_step    check (step_id ~ '^[A-Za-z0-9_-]{1,60}$'),
  constraint outreach_campaigns_cap     check (daily_cap between 1 and 200),
  constraint outreach_campaigns_status  check (status in ('active','paused')),
  constraint outreach_campaigns_country check (filter_country is null or filter_country ~ '^[A-Z]{2}$'),
  constraint outreach_campaigns_source  check (filter_source is null or filter_source in ('past_customers','opted_in','public_business','purchased_or_scraped','other')),
  constraint outreach_campaigns_sites   check (cardinality(site_ids) <= 20),
  constraint outreach_campaigns_index   check (next_site_index >= 0)
);

create table if not exists public.outreach_sends (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references public.outreach_campaigns(id) on delete cascade,
  contact_id    uuid not null references public.outreach_contacts(id) on delete cascade,
  site_id       uuid,
  status        text not null default 'queued',
  attempts      integer not null default 0,
  request_ref   text,
  error         text,
  pushed_at     timestamptz,
  last_event    text,
  last_event_at timestamptz,
  created_at    timestamptz not null default now(),
  constraint outreach_sends_unique unique (campaign_id, contact_id),
  constraint outreach_sends_status check (status in ('queued','pushed','push_failed','sent','finished','replied','unsubscribed','bounced')),
  constraint outreach_sends_error  check (error is null or char_length(error) <= 500)
);
create index if not exists outreach_sends_campaign_idx on public.outreach_sends (campaign_id, status);
create index if not exists outreach_sends_contact_idx  on public.outreach_sends (contact_id);
create index if not exists outreach_sends_pushed_idx   on public.outreach_sends (pushed_at desc) where pushed_at is not null;

create table if not exists public.outreach_events (
  id           uuid primary key default gen_random_uuid(),
  dedupe_key   text not null unique,
  event        text not null,
  email        text not null,
  contact_id   uuid references public.outreach_contacts(id) on delete set null,
  send_id      uuid references public.outreach_sends(id) on delete set null,
  sequence_id  text,
  occurred_at  timestamptz,
  detail       jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  constraint outreach_events_event check (event in ('email-sent','email-opened','email-link-clicked','reply-received','email-bounced','prospect-unsubscribed','prospect-finished','prospect-outcome-updated')),
  constraint outreach_events_key   check (char_length(dedupe_key) <= 400)
);
create index if not exists outreach_events_email_idx   on public.outreach_events (email, created_at desc);
create index if not exists outreach_events_contact_idx on public.outreach_events (contact_id) where contact_id is not null;
create index if not exists outreach_events_event_idx   on public.outreach_events (event, created_at desc);

-- ---------- who is mailed next ----------
-- Only ACTIVE contacts that match the campaign filter, are not on the do-not-email list (checked again here),
-- and were never given to this campaign before. Oldest first, so the order is predictable.
create or replace function public.outreach_next_contacts(p_campaign uuid, p_limit integer)
returns table (id uuid, email text, full_name text, company text, website text, country text, tags text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.email, c.full_name, c.company, c.website, c.country, c.tags
  from public.outreach_campaigns k
  join public.outreach_contacts c on c.status = 'active'
  where k.id = p_campaign
    and (k.filter_tag is null or k.filter_tag = any (c.tags))
    and (k.filter_country is null or c.country = k.filter_country)
    and (k.filter_source is null or c.source = k.filter_source)
    and not exists (select 1 from public.outreach_suppressions s where s.email = c.email)
    and not exists (select 1 from public.outreach_sends x where x.campaign_id = k.id and x.contact_id = c.id)
  order by c.created_at asc, c.id asc
  limit greatest(0, least(coalesce(p_limit, 0), 500))
$$;
revoke all on function public.outreach_next_contacts(uuid, integer) from public, anon, authenticated;
grant execute on function public.outreach_next_contacts(uuid, integer) to service_role;

-- ---------- Row Level Security: admins only ----------
alter table public.outreach_connection enable row level security;
alter table public.outreach_campaigns  enable row level security;
alter table public.outreach_sends      enable row level security;
alter table public.outreach_events     enable row level security;

drop policy if exists outreach_connection_select on public.outreach_connection;
create policy outreach_connection_select on public.outreach_connection for select to authenticated using (public.is_admin());
drop policy if exists outreach_campaigns_select on public.outreach_campaigns;
create policy outreach_campaigns_select on public.outreach_campaigns for select to authenticated using (public.is_admin());
drop policy if exists outreach_sends_select on public.outreach_sends;
create policy outreach_sends_select on public.outreach_sends for select to authenticated using (public.is_admin());
drop policy if exists outreach_events_select on public.outreach_events;
create policy outreach_events_select on public.outreach_events for select to authenticated using (public.is_admin());

-- All writes go through our admin-only server routes (service role). The browser role can read, as an admin only,
-- and on the connection table it can NOT read the encrypted key or the webhook secret (column-level grant).
revoke all on public.outreach_connection, public.outreach_campaigns, public.outreach_sends, public.outreach_events from anon, authenticated;
grant select (id, provider, api_key_hint, field_map, last_test_at, last_test_ok, last_test_message, updated_at, created_at) on public.outreach_connection to authenticated;
grant select on public.outreach_campaigns, public.outreach_sends, public.outreach_events to authenticated;
