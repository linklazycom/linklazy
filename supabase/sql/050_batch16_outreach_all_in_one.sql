-- =====================================================================
-- 050_batch16_outreach_all_in_one.sql  (Batch 16B-1 + 16B-2 together)  — additive only
-- Run THIS ONE FILE. It contains 046 and then 048, in the right order, and it is safe in ANY state:
--   * nothing from Batch 16B run yet            -> creates everything
--   * only 046 (16B-1) was run before           -> adds the rest
--   * 046 and 048 were both run before          -> changes nothing
-- Every statement is "create if not exists" / "drop if exists + create", so running it twice is harmless.
-- Creates: outreach_imports, outreach_contacts, outreach_suppressions (+2 triggers), outreach_connection,
-- outreach_campaigns, outreach_sends, outreach_events and the function outreach_next_contacts().
-- Admin-only. Sends nothing. Does NOT change any existing table, policy or data.
--
-- ORDER: run this file, then run 051_batch16_outreach_all_in_one_verify.sql, then upload the code.
--
-- ROLLBACK (all imported contacts and campaign history are lost; nothing else is touched):
--   drop function if exists public.outreach_next_contacts(uuid, integer);
--   drop table if exists public.outreach_events;
--   drop table if exists public.outreach_sends;
--   drop table if exists public.outreach_campaigns;
--   drop table if exists public.outreach_connection;
--   drop trigger  if exists outreach_suppression_apply on public.outreach_suppressions;
--   drop trigger  if exists outreach_contacts_enforce_suppression on public.outreach_contacts;
--   drop function if exists public.outreach_suppression_apply();
--   drop function if exists public.outreach_contacts_enforce_suppression();
--   drop function if exists public.outreach_suppression_status(text);
--   drop table if exists public.outreach_contacts;
--   drop table if exists public.outreach_suppressions;
--   drop table if exists public.outreach_imports;
-- =====================================================================

-- ############ PART 1 of 2 (was 046_batch16b1_outreach_contacts.sql) ############
-- =====================================================================
-- 046_batch16b1_outreach_contacts.sql  (Batch 16B-1)  — additive only
-- Creates: outreach_imports, outreach_contacts, outreach_suppressions (+ 2 triggers that make the
-- do-not-email list binding at database level). Admin-only: no customer can read or write these tables.
-- Nothing here sends email. Does NOT change any existing table, policy or data.
--
-- PRE-CHECK (run first; expect all three NULL):
--   select to_regclass('public.outreach_imports') a, to_regclass('public.outreach_contacts') b, to_regclass('public.outreach_suppressions') c;
-- If any is NOT null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch16b1 code (the site keeps working if you run it before deploying).
--
-- ROLLBACK (the imported contacts are lost; nothing else is touched):
--   drop trigger  if exists outreach_suppression_apply on public.outreach_suppressions;
--   drop trigger  if exists outreach_contacts_enforce_suppression on public.outreach_contacts;
--   drop function if exists public.outreach_suppression_apply();
--   drop function if exists public.outreach_contacts_enforce_suppression();
--   drop function if exists public.outreach_suppression_status(text);
--   drop table if exists public.outreach_contacts;
--   drop table if exists public.outreach_suppressions;
--   drop table if exists public.outreach_imports;
-- =====================================================================

create table if not exists public.outreach_imports (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references auth.users(id) on delete set null,
  file_name   text,
  source      text not null,
  total_rows  integer not null default 0,
  added       integer not null default 0,
  held        integer not null default 0,
  invalid     integer not null default 0,
  duplicates  integer not null default 0,
  suppressed  integer not null default 0,
  tags        text[] not null default '{}',
  created_at  timestamptz not null default now(),
  constraint outreach_imports_file_name check (file_name is null or char_length(file_name) <= 200)
);

create table if not exists public.outreach_suppressions (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  reason      text not null,
  note        text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint outreach_suppressions_email  check (email = lower(email) and char_length(email) between 3 and 254),
  constraint outreach_suppressions_reason check (reason in ('unsubscribe','bounce','complaint','manual')),
  constraint outreach_suppressions_note   check (note is null or char_length(note) <= 300)
);

create table if not exists public.outreach_contacts (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  email_domain      text not null,
  full_name         text,
  company           text,
  website           text,
  country           text,
  country_source    text,
  source            text not null,
  status            text not null default 'active',
  hold_reason       text,
  is_role           boolean not null default false,
  tags              text[] not null default '{}',
  notes             text,
  import_id         uuid references public.outreach_imports(id) on delete set null,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  constraint outreach_contacts_email    check (email = lower(email) and char_length(email) between 3 and 254 and email ~ '^[^@[:space:]]+@[^@[:space:]]+$'),
  constraint outreach_contacts_source   check (source in ('past_customers','opted_in','public_business','purchased_or_scraped','other')),
  constraint outreach_contacts_status   check (status in ('active','held','unsubscribed','bounced','complained','blocked')),
  -- NULL-safe: a held contact MUST have a reason; any reason must be a known one.
  constraint outreach_contacts_hold     check ((status <> 'held' or hold_reason is not null) and (hold_reason is null or hold_reason in ('restricted_region','source_review','manual'))),
  constraint outreach_contacts_country  check (country is null or country ~ '^[A-Z]{2}$'),
  constraint outreach_contacts_cs       check (country_source is null or country_source in ('file','default','tld')),
  constraint outreach_contacts_tags     check (cardinality(tags) <= 10),
  constraint outreach_contacts_name     check (full_name is null or char_length(full_name) <= 100),
  constraint outreach_contacts_company  check (company is null or char_length(company) <= 120),
  constraint outreach_contacts_website  check (website is null or char_length(website) <= 300),
  constraint outreach_contacts_notes    check (notes is null or char_length(notes) <= 1000)
);

create index if not exists outreach_contacts_status_idx  on public.outreach_contacts (status, created_at desc);
create index if not exists outreach_contacts_hold_idx    on public.outreach_contacts (hold_reason) where status = 'held';
create index if not exists outreach_contacts_country_idx on public.outreach_contacts (country) where country is not null;
create index if not exists outreach_contacts_tags_idx    on public.outreach_contacts using gin (tags);
create index if not exists outreach_contacts_import_idx  on public.outreach_contacts (import_id) where import_id is not null;

-- ---------- the do-not-email list is binding at database level ----------
create or replace function public.outreach_suppression_status(p_reason text)
returns text language sql immutable
as $$ select case p_reason when 'unsubscribe' then 'unsubscribed' when 'bounce' then 'bounced' when 'complaint' then 'complained' else 'blocked' end $$;

-- A contact whose address is on the list can never be active or held, whoever inserts or edits it.
create or replace function public.outreach_contacts_enforce_suppression()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r text;
begin
  if new.status in ('active','held') then
    select s.reason into r from public.outreach_suppressions s where s.email = new.email;
    if r is not null then
      new.status := public.outreach_suppression_status(r);
      new.hold_reason := null;
      new.status_changed_at := now();
    end if;
  end if;
  return new;
end $$;

-- Adding an address to the list immediately moves any existing contact out of active/held.
create or replace function public.outreach_suppression_apply()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.outreach_contacts
     set status = public.outreach_suppression_status(new.reason), hold_reason = null, status_changed_at = now(), updated_at = now()
   where email = new.email and status in ('active','held');
  return new;
end $$;

revoke all on function public.outreach_contacts_enforce_suppression() from public, anon, authenticated;
revoke all on function public.outreach_suppression_apply() from public, anon, authenticated;

drop trigger if exists outreach_contacts_enforce_suppression on public.outreach_contacts;
create trigger outreach_contacts_enforce_suppression
  before insert or update of status, email on public.outreach_contacts
  for each row execute function public.outreach_contacts_enforce_suppression();

drop trigger if exists outreach_suppression_apply on public.outreach_suppressions;
create trigger outreach_suppression_apply
  after insert on public.outreach_suppressions
  for each row execute function public.outreach_suppression_apply();

-- ---------- Row Level Security: admins only ----------
alter table public.outreach_imports      enable row level security;
alter table public.outreach_contacts     enable row level security;
alter table public.outreach_suppressions enable row level security;

drop policy if exists outreach_imports_select on public.outreach_imports;
create policy outreach_imports_select on public.outreach_imports for select to authenticated using (public.is_admin());
drop policy if exists outreach_contacts_select on public.outreach_contacts;
create policy outreach_contacts_select on public.outreach_contacts for select to authenticated using (public.is_admin());
drop policy if exists outreach_suppressions_select on public.outreach_suppressions;
create policy outreach_suppressions_select on public.outreach_suppressions for select to authenticated using (public.is_admin());

-- All writes go through our admin-only server routes (service role); the browser role can only read, and only as an admin.
revoke all on public.outreach_imports, public.outreach_contacts, public.outreach_suppressions from anon, authenticated;
grant select on public.outreach_imports, public.outreach_contacts, public.outreach_suppressions to authenticated;


-- ############ PART 2 of 2 (was 048_batch16b2_saleshandy_campaigns.sql) ############
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
