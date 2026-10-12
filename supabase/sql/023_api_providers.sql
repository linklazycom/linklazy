-- =====================================================================
-- 023_api_providers.sql  (Batch 6)  — admin-managed API providers + usage log
-- Creates: public.api_providers, public.api_usage_log (additive only).
-- Safe to run more than once. Does NOT touch any existing table.
--
-- PRE-CHECK (run first, must return NULL for both):
--   select to_regclass('public.api_providers'), to_regclass('public.api_usage_log');
-- If either is NOT null, STOP and send me the result.
--
-- ROLLBACK (only if you need to undo; no existing data is affected):
--   drop table if exists public.api_usage_log;
--   drop table if exists public.api_providers;
-- =====================================================================

create table if not exists public.api_providers (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  kind              text not null default 'ai' check (kind in ('ai','search','image')),
  adapter           text not null,
  base_url          text,
  model             text,
  api_key_encrypted text,            -- AES-256-GCM ciphertext; never plaintext
  priority          int  not null default 100,   -- lower number = tried first
  enabled           boolean not null default false,
  daily_limit       int check (daily_limit   is null or daily_limit   >= 0),
  monthly_limit     int check (monthly_limit is null or monthly_limit >= 0),
  notes             text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists api_providers_name_uidx on public.api_providers (lower(name));
create index if not exists api_providers_pick_idx on public.api_providers (kind, enabled, priority);

create table if not exists public.api_usage_log (
  id            bigserial primary key,
  provider_id   uuid references public.api_providers(id) on delete set null,
  provider_name text,
  feature       text not null,
  user_id       uuid references auth.users(id) on delete set null,
  ok            boolean not null,
  http_status   int,
  input_tokens  int,
  output_tokens int,
  error         text,                -- sanitized, truncated; never prompts or keys
  duration_ms   int,
  created_at    timestamptz not null default now()
);

create index if not exists api_usage_log_provider_idx on public.api_usage_log (provider_id, created_at desc);
create index if not exists api_usage_log_created_idx  on public.api_usage_log (created_at desc);

-- RLS ON with NO policies: only the server (service role) can read/write.
-- The browser can never read these tables — so keys cannot leak through
-- the public REST API even if some other code has a bug.
alter table public.api_providers enable row level security;
alter table public.api_usage_log enable row level security;
