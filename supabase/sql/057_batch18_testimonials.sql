-- =====================================================================
-- 057_batch18_testimonials.sql  (Batch 18: testimonials with proof of consent) — additive only
-- PREREQUISITE: 050 or any earlier file that defines public.is_admin() (it exists since the early batches).
-- Creates: public.testimonials. Safe to run twice. Does NOT touch any existing table or row.
-- A testimonial can only be PUBLISHED when the admin has confirmed the person gave permission (a database rule, not just a form).
--
-- PRE-CHECK (expect NULL): select to_regclass('public.testimonials');
-- ORDER: run this file FIRST, then 058_batch18_verify.sql, then deploy the batch18 code.
--
-- ROLLBACK (only the testimonials are lost):
--   drop table if exists public.testimonials;
-- =====================================================================

create table if not exists public.testimonials (
  id                 uuid primary key default gen_random_uuid(),
  author_name        text not null,
  author_role        text,
  author_site        text,
  quote              text not null,
  source_note        text,
  consent_confirmed  boolean not null default false,
  is_published       boolean not null default false,
  sort_order         integer not null default 0,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint testimonials_name  check (char_length(btrim(author_name)) between 1 and 80),
  constraint testimonials_role  check (author_role is null or char_length(author_role) <= 120),
  constraint testimonials_site  check (author_site is null or char_length(author_site) <= 200),
  constraint testimonials_quote check (char_length(btrim(quote)) between 10 and 600),
  constraint testimonials_note  check (source_note is null or char_length(source_note) <= 300),
  constraint testimonials_sort  check (sort_order between -1000 and 100000),
  -- no permission, no publishing
  constraint testimonials_consent_before_publish check (not is_published or consent_confirmed)
);
create index if not exists testimonials_public_idx on public.testimonials (sort_order, created_at desc) where is_published;

alter table public.testimonials enable row level security;

-- Visitors (and logged-in users) may read ONLY published ones. Writes: admin routes with the service role only.
drop policy if exists testimonials_public_select on public.testimonials;
create policy testimonials_public_select on public.testimonials for select to anon, authenticated using (is_published and consent_confirmed);
drop policy if exists testimonials_admin_select on public.testimonials;
create policy testimonials_admin_select on public.testimonials for select to authenticated using (public.is_admin());

revoke all on public.testimonials from anon, authenticated;
grant select on public.testimonials to anon, authenticated;
