-- =====================================================================
-- 036_batch11_domains_api.sql  (Batch 11)  — additive only
-- Creates: custom_domains, api_keys
-- Does NOT change any existing table, column, policy, trigger or data.
--
-- PRE-CHECK (run first; both values must be NULL):
--   select to_regclass('public.custom_domains'), to_regclass('public.api_keys');
-- If anything is NOT null, STOP and send me the result.
--
-- ORDER: run this file FIRST, then deploy the batch11 code.
-- The site keeps working if you run it before deploying.
--
-- ROLLBACK (no existing data is affected; custom domains and API keys are lost):
--   drop table if exists public.api_keys;
--   drop table if exists public.custom_domains;
-- =====================================================================

-- ---------- custom_domains ----------
create table if not exists public.custom_domains (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  hostname          text not null,
  -- pending  = claimed, DNS ownership not proven yet
  -- verified = ownership proven, waiting for the platform connection
  -- active   = serving redirects
  -- disabled = switched off by an admin
  status            text not null default 'pending',
  verify_token      text not null,
  root_redirect_url text,
  verified_at       timestamptz,
  connected_at      timestamptz,
  last_checked_at   timestamptz,
  last_error        text,
  vercel_added      boolean not null default false,
  disabled_note     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint custom_domains_host_format check (hostname = lower(hostname) and char_length(hostname) between 4 and 253),
  constraint custom_domains_status check (status in ('pending','verified','active','disabled')),
  constraint custom_domains_root_len check (root_redirect_url is null or char_length(root_redirect_url) <= 2048)
);

-- One user cannot claim the same hostname twice.
create unique index if not exists custom_domains_user_host_uidx on public.custom_domains (user_id, hostname);

-- Several users may CLAIM the same hostname (pending), but only ONE can own it:
-- the first to prove DNS control wins, so nobody can squat on someone else's domain.
create unique index if not exists custom_domains_owner_uidx
  on public.custom_domains (hostname) where status <> 'pending';

create index if not exists custom_domains_user_idx   on public.custom_domains (user_id, created_at desc);
create index if not exists custom_domains_status_idx on public.custom_domains (status, created_at desc);

-- ---------- api_keys ----------
-- Only a SHA-256 hash of the key is stored (the key itself is shown once, at creation).
create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  key_prefix    text not null,
  key_hash      text not null,
  scopes        text[] not null default '{links:read}',
  last_used_at  timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint api_keys_name_len check (char_length(name) between 1 and 60),
  constraint api_keys_hash_len check (char_length(key_hash) = 64),
  constraint api_keys_scopes   check (scopes <@ array['links:read','links:write']::text[] and cardinality(scopes) >= 1)
);
create unique index if not exists api_keys_hash_uidx on public.api_keys (key_hash);
create index        if not exists api_keys_user_idx  on public.api_keys (user_id, created_at desc);

-- ---------- Row Level Security ----------
alter table public.custom_domains enable row level security;
alter table public.api_keys       enable row level security;

-- Owners (and admins) may READ their domains. All writes go through our server routes.
drop policy if exists custom_domains_select on public.custom_domains;
create policy custom_domains_select on public.custom_domains
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- api_keys: NO policy at all = only the server (service role) can read or write,
-- so even the key hashes never reach a browser.
revoke all on public.custom_domains from anon;
revoke insert, update, delete, truncate on public.custom_domains from authenticated;
grant select on public.custom_domains to authenticated; -- explicit, so the policy above works whatever the project's default privileges are
revoke all on public.api_keys from anon, authenticated;
