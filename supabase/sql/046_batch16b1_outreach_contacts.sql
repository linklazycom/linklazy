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
