-- =====================================================================
-- 028_batch7b2_sites_lockdown.sql  (Batch 7B-২) — আসল তালা
--
-- ⚠️ ক্রম: আগে Batch 7B-২-এর কোড GitHub → Vercel-এ ডিপ্লয় (ওয়াচলিস্ট ও ইনকোয়ারি পেজ
--    বদলেছে), ডিপ্লয় শেষ হলে এই SQL। উল্টো করলে ওয়াচলিস্ট/ইনকোয়ারিতে সাইটের নাম ফাঁকা দেখাবে।
--
-- আগে: যেকোনো অনুমোদিত সাইটের সব কলাম (url, domain, guidelines, **admin_notes**) সবার জন্য
--      REST API দিয়ে পাঠযোগ্য ছিল।
-- এখন: `sites` টেবিলের সারি দেখতে পাবে শুধু —
--        • মালিক,  • অ্যাডমিন,
--        • যার "দেখার অধিকার" আছে (বৈধ আনলক বা সেই সাইটের অর্ডারের পক্ষ)
--      বাকি সবাই (anon সহ) সরাসরি টেবিলে ০ সারি পাবে; পাবলিক তালিকা/মাস্কড ডোমেইন
--      পাবে `sites_public` ভিউ থেকে (যা 027-এ তৈরি, কোডও সেটাই ব্যবহার করে)।
--
-- এক ট্রানজ্যাকশন; কোনো ডাটা বদলায় না/মোছে না; শুধু পলিসি ও একটি সাহায্যকারী ফাংশন।
-- ROLLBACK: ফাইলের একদম নিচে।
-- =====================================================================

begin;

-- 1) বায়ার অন্যের স্লট দেখতে পায় কিনা — আগে এটি `sites`-এর RLS-এর উপর নির্ভর করত;
--    টেবিল সংকীর্ণ হলে ভেঙে যেত। এখন সাইট অনুমোদিত কিনা সেটা নিরাপদ ফাংশনে যাচাই।
create or replace function public.site_is_approved(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.sites where id = p_site_id and status = 'approved')
$$;
grant execute on function public.site_is_approved(uuid) to anon, authenticated;

drop policy if exists link_slots_select on public.site_link_slots;
create policy link_slots_select on public.site_link_slots
  for select
  using (
    public.site_is_approved(site_id)
    or exists (select 1 from public.sites s where s.id = site_link_slots.site_id and s.owner_id = auth.uid())
    or public.is_admin()
  );

-- 2) `sites` টেবিলের পাঠ-নিয়ম সংকীর্ণ
drop policy if exists sites_select_approved_or_own on public.sites;
create policy sites_select_entitled on public.sites
  for select to authenticated
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or public.can_see_site_identity(id, owner_id)
  );

commit;

-- =====================================================================
-- যাচাই (শুধু পড়া; আলাদা আলাদা Run; সংখ্যাগুলো পাঠান)
-- =====================================================================
-- V1: anon হিসেবে সরাসরি টেবিল — ০ আসা উচিত (এরর নয়)
-- begin; set local role anon; select count(*) as anon_rows_in_sites_table from public.sites; rollback;
--
-- V2: anon হিসেবে ভিউ — সারি আসা উচিত (আগের মতো ১৪ বা বর্তমান অনুমোদিত সংখ্যা)
-- begin; set local role anon; select count(*) as anon_rows_in_view from public.sites_public; rollback;
--
-- V3: anon হিসেবে স্লট দেখা যায় (অনুমোদিত সাইটের) — সংখ্যা > ০ হওয়ার কথা (যদি স্লট থাকে)
-- begin; set local role anon; select count(*) as anon_visible_slots from public.site_link_slots; rollback;
--
-- V4: পলিসি তালিকা
-- select policyname, cmd, roles from pg_policies where schemaname='public' and tablename in ('sites','site_link_slots') order by 1;

-- =====================================================================
-- ROLLBACK (সমস্যা হলে — আগের অবস্থায় ফিরিয়ে দেয়)
-- =====================================================================
-- begin;
-- drop policy if exists sites_select_entitled on public.sites;
-- create policy sites_select_approved_or_own on public.sites for select to public
--   using ((status = 'approved'::site_status) or (owner_id = auth.uid()) or is_admin());
-- drop policy if exists link_slots_select on public.site_link_slots;
-- create policy link_slots_select on public.site_link_slots for select to public
--   using (exists (select 1 from public.sites s where s.id = site_link_slots.site_id
--                    and ((s.status = 'approved'::site_status) or (s.owner_id = auth.uid()) or is_admin())));
-- drop function if exists public.site_is_approved(uuid);
-- commit;
