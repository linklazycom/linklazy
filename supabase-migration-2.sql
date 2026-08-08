-- =========================================================
-- LINKLAZY — MIGRATION 2 (Sprint 5-6)
-- Payments (bKash), platform settings (nav/footer/verification
-- meta tags), self-hosted traffic analytics.
-- Run this in Supabase SQL Editor AFTER schema.sql.
-- =========================================================

-- =========================================================
-- 1. SITE SETTINGS (admin-editable platform config: nav, footer,
--    search-engine/analytics verification codes, social links)
-- =========================================================
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;

create policy "site_settings_select_all" on public.site_settings for select using (true);
create policy "site_settings_write_admin" on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- Seed sensible defaults so the header/footer/verification tags never break
-- before an admin configures them.
insert into public.site_settings (key, value, description) values
  ('nav_links', '[{"label":"Browse Sites","href":"/dashboard/browse"},{"label":"Pricing","href":"/pricing"},{"label":"Blog","href":"/blog"}]', 'Primary header navigation'),
  ('footer_links', '{"Company":[{"label":"About","href":"/about"},{"label":"Contact","href":"/contact"}],"Legal":[{"label":"Privacy Policy","href":"/privacy"},{"label":"Terms & Conditions","href":"/terms"}],"Resources":[{"label":"Blog","href":"/blog"},{"label":"How it works","href":"/how-it-works"}]}', 'Footer link columns'),
  ('social_links', '{"facebook":"","twitter":"","linkedin":""}', 'Footer social icons'),
  ('contact_email', '"support@linklazy.com"', 'Public contact email'),
  ('ga_measurement_id', '""', 'Google Analytics 4 Measurement ID, e.g. G-XXXXXXX'),
  ('gsc_verification_code', '""', 'Google Search Console HTML tag verification content value'),
  ('bing_verification_code', '""', 'Bing Webmaster Tools verification content value'),
  ('pinterest_verification_code', '""', 'Pinterest domain verification meta tag content value'),
  ('yandex_verification_code', '""', 'Yandex Webmaster verification content value (optional)')
on conflict (key) do nothing;

create trigger trg_site_settings_updated before update on public.site_settings
  for each row execute procedure public.set_updated_at();

-- =========================================================
-- 2. SELF-HOSTED TRAFFIC ANALYTICS
-- =========================================================
create table if not exists public.page_views (
  id uuid primary key default uuid_generate_v4(),
  path text not null,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  user_id uuid references public.profiles(id),
  session_id text,
  country text,
  device text,
  created_at timestamptz not null default now()
);

create index if not exists idx_page_views_created on public.page_views(created_at);
create index if not exists idx_page_views_path on public.page_views(path);
create index if not exists idx_page_views_referrer on public.page_views(referrer);

alter table public.page_views enable row level security;

-- Anyone (including anonymous visitors) can insert their own pageview beacon;
-- only admins can read the aggregated data back.
create policy "page_views_insert_any" on public.page_views for insert with check (true);
create policy "page_views_select_admin" on public.page_views for select using (public.is_admin());

-- =========================================================
-- 3. ARTICLE FIELDS NEEDED FOR SEO (if not already present)
-- =========================================================
alter table public.articles add column if not exists reading_minutes int;
alter table public.articles add column if not exists og_image_url text;

-- =========================================================
-- 4. CONTACT FORM SUBMISSIONS
-- =========================================================
create table if not exists public.contact_messages (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new', -- new | read | resolved
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

create policy "contact_messages_insert_any" on public.contact_messages for insert with check (true);
create policy "contact_messages_select_admin" on public.contact_messages for select using (public.is_admin());
create policy "contact_messages_update_admin" on public.contact_messages for update using (public.is_admin());

-- =========================================================
-- END OF MIGRATION 2
-- =========================================================
