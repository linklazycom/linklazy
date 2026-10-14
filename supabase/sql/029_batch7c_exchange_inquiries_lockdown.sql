-- =====================================================================
-- 029_batch7c_exchange_inquiries_lockdown.sql  (Batch 7C)
-- আগে কোড (batch7c.zip) GitHub-এ আপলোড + Vercel ডিপ্লয় শেষ হতে দিন, তারপর এই SQL।
--
-- কী করে:
--  1) exchange_matches: দুই সাইটের মালিক যেকোনো কলাম (status সহ) সরাসরি লিখতে পারতেন
--     (policy exchange_matches_write, ALL) — সেটি সরায়। এখন লেখা শুধু সার্ভার API দিয়ে।
--     পড়া: শুধু দুই সাইটের মালিক (ও অ্যাডমিন)।
--  2) inquiries: ব্রাউজার থেকে সরাসরি ইনসার্ট (policy inquiries_buyer_insert) সরায় —
--     নইলে যে কেউ নকল seller_id দিয়ে থ্রেড খুলতে পারত। ইনসার্ট এখন শুধু /api/inquiries দিয়ে।
--
-- PRE-CHECK (আলাদা Run; ফল আমাকে পাঠান — না পাঠালেও চলবে):
--   select tablename, policyname, cmd from pg_policies
--    where schemaname='public' and tablename in ('exchange_matches','inquiries') order by 1,2;
--
-- ROLLBACK (শুধু কিছু ভাঙলে; নিচে কমেন্টে)
-- =====================================================================

begin;

create or replace function public.is_match_participant(p_site_a uuid, p_site_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and exists (
       select 1 from public.sites s
        where s.id in (p_site_a, p_site_b)
          and s.owner_id = auth.uid()
     )
$$;
grant execute on function public.is_match_participant(uuid, uuid) to authenticated;

-- (1) exchange_matches: আগে পড়ার নিয়ম, তারপর খোলা লেখার নিয়ম সরানো
drop policy if exists exchange_matches_select_participants on public.exchange_matches;
create policy exchange_matches_select_participants on public.exchange_matches
  for select to authenticated
  using (public.is_match_participant(site_a_id, site_b_id) or public.is_admin());

drop policy if exists exchange_matches_write on public.exchange_matches;

-- (2) inquiries: ব্রাউজার থেকে ইনসার্ট বন্ধ
drop policy if exists inquiries_buyer_insert on public.inquiries;

commit;

-- =====================================================================
-- যাচাই (কমেন্ট খুলে আলাদা আলাদা Run; ফল পাঠান)
-- V1: exchange_matches-এ আর কোনো ALL/INSERT/UPDATE/DELETE policy নেই —
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='exchange_matches' order by 2,1;
--   আশা: শুধু SELECT policy (exchange_matches_select_participants এবং আগে থেকে থাকা অন্য SELECT policy)
-- V2: inquiries-এ INSERT policy নেই —
--   select policyname, cmd from pg_policies
--    where schemaname='public' and tablename='inquiries' order by 2,1;
--   আশা: কোনো INSERT সারি নয়
-- V3: RLS চালু —
--   select relname, relrowsecurity from pg_class
--    where oid in ('public.exchange_matches'::regclass,'public.inquiries'::regclass);
--   আশা: দুটোতেই true
--
-- ROLLBACK:
--   create policy exchange_matches_write on public.exchange_matches for all to authenticated
--     using (exists (select 1 from public.sites s where s.id in (site_a_id, site_b_id) and s.owner_id = auth.uid()))
--     with check (exists (select 1 from public.sites s where s.id in (site_a_id, site_b_id) and s.owner_id = auth.uid()));
--   create policy inquiries_buyer_insert on public.inquiries for insert to authenticated
--     with check (buyer_id = auth.uid());
-- =====================================================================
