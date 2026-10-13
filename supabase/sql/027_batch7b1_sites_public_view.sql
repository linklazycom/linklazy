-- =====================================================================
-- 027_batch7b1_sites_public_view.sql  (Batch 7B-১)
--
-- ⚠️ ক্রম: এই SQL আগে চালান (এটি শুধু নতুন জিনিস যোগ করে, কিছু বদলায় না/বন্ধ করে না),
--    তারপর Batch 7B-১-এর কোড GitHub → Vercel-এ আপলোড করুন।
--    (কোড আগে গেলে সাইট পেজগুলো নতুন ভিউ খুঁজে না পেয়ে ভাঙবে।)
--
-- কী যোগ করে (additive; ডাটা/পলিসি/টেবিল অক্ষুণ্ণ):
--   1) mask_domain(text)           — lib/mask-domain.ts-এর SQL সংস্করণ ("example.com" -> "ex*****.com")
--   2) can_see_site_identity(...)  — মালিক / অ্যাডমিন / বৈধ PPV-আনলক (ওয়ালেট বা পুরোনো কোটা) / অর্ডারের পক্ষ হলে true
--   3) sites_public ভিউ            — `sites`-এর সব কলাম, একই নাম, একই ক্রম; তবে
--        url, guidelines       -> শুধু উপরের "দেখার অধিকার" থাকলে, নইলে NULL
--        domain                -> অধিকার থাকলে আসল, নইলে মাস্কড
--        admin_notes           -> শুধু অ্যাডমিন
--        rejection_reason      -> শুধু মালিক ও অ্যাডমিন
--      সারি-দৃশ্যমানতা আগের পলিসির মতোই (approved অথবা নিজের অথবা অ্যাডমিন)।
--
-- এই ধাপে কোনো বিধিনিষেধ আসে না: `sites` টেবিল এখনো আগের মতোই সবার পাঠযোগ্য।
-- আসল তালা লাগবে পরের ধাপে (Batch 7B-২), কোড পুরোপুরি ভিউতে যাওয়া যাচাই হওয়ার পর।
--
-- PRE-CHECK (NULL আসতে হবে): select to_regclass('public.sites_public');
-- ROLLBACK (শুধু এই ফাইলের জিনিস মোছে):
--   drop view if exists public.sites_public;
--   drop function if exists public.can_see_site_identity(uuid, uuid);
--   drop function if exists public.mask_domain(text);
-- =====================================================================

begin;

create or replace function public.mask_domain(p_domain text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case
    when p_domain is null then null
    when position('.' in p_domain) = 0 then '****'
    else left(regexp_replace(p_domain, '\.[^.]*$', ''), 2)
         || repeat('*', greatest(4, length(regexp_replace(p_domain, '\.[^.]*$', ''))
                                     - length(left(regexp_replace(p_domain, '\.[^.]*$', ''), 2))))
         || '.' || substring(p_domain from '[^.]*$')
  end
$$;

create or replace function public.can_see_site_identity(p_site_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
     and (
       p_owner_id = auth.uid()
       or public.is_admin()
       or exists (
            select 1 from public.site_unlocks su
             where su.site_id = p_site_id
               and su.buyer_id = auth.uid()
               and (su.expires_at is null or su.expires_at > now())
               and su.earning_status <> 'reversed'
          )
       or exists (
            -- আগের "প্ল্যান-কোটা" আনলক (credits_ledger) — পুরোনো আনলকও যেন মাস্কড না হয়ে যায়
            select 1 from public.credits_ledger cl
             where cl.user_id = auth.uid()
               and cl.type = 'unlock_spend'
               and cl.related_site_id = p_site_id
          )
       or exists (
            select 1 from public.orders o
             where o.site_id = p_site_id
               and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())
          )
     )
$$;

create or replace view public.sites_public as
select
       s.id,
       s.owner_id,
       case when public.can_see_site_identity(s.id, s.owner_id) then s.url else null end as url,
       case when public.can_see_site_identity(s.id, s.owner_id) then s.domain else public.mask_domain(s.domain) end as domain,
       s.niche,
       s.language,
       s.status,
       s.da,
       s.pa,
       s.dr,
       s.organic_traffic,
       s.referring_domains,
       s.total_backlinks,
       s.indexed_pages,
       s.post_count,
       s.spam_score,
       s.metrics_source,
       s.metrics_updated_at,
       s.accepts_exchange,
       s.accepts_paid,
       s.price_amount,
       s.price_currency,
       s.link_type,
       s.placement,
       s.turnaround_hours,
       case when public.can_see_site_identity(s.id, s.owner_id) then s.guidelines else null end as guidelines,
       case when s.owner_id = auth.uid() or public.is_admin() then s.rejection_reason else null end as rejection_reason,
       case when public.is_admin() then s.admin_notes else null end as admin_notes,
       s.created_at,
       s.updated_at,
       s.pay_per_view_enabled,
       s.view_price,
       s.access_duration_days,
       s.dr_verified,
       s.dr_verified_at,
       s.dr_check_status,
       s.is_featured
  from public.sites s
 where s.status = 'approved'
    or s.owner_id = auth.uid()
    or public.is_admin();

alter view public.sites_public set (security_invoker = off);
grant select on public.sites_public to anon, authenticated;
grant execute on function public.mask_domain(text) to anon, authenticated;
grant execute on function public.can_see_site_identity(uuid, uuid) to anon, authenticated;

commit;

-- =====================================================================
-- যাচাই (শুধু পড়া; আলাদা আলাদা Run; ফল পাঠান)
-- =====================================================================
-- V1: মাস্কিং JS-এর সাথে মেলে (প্রত্যাশিত: ex****.com | ab****.com | ****  | my*********.co.uk)
-- select public.mask_domain('example.com'), public.mask_domain('abc.com'), public.mask_domain('localhost'), public.mask_domain('mysite-name.co.uk');
--
-- V2: anon হিসেবে — domain সব মাস্কড (* থাকবে), url ও guidelines সব NULL আসবে
-- begin; set local role anon;
--   select count(*) as rows, count(url) as url_visible, count(guidelines) as guidelines_visible,
--          count(*) filter (where domain like '%*%') as masked_domains from public.sites_public;
-- rollback;
--
-- V3: কলাম-সংখ্যা ও ক্রম `sites`-এর সাথে একই (দুটোর সংখ্যা সমান হতে হবে)
-- select (select count(*) from information_schema.columns where table_schema='public' and table_name='sites') as sites_cols,
--        (select count(*) from information_schema.columns where table_schema='public' and table_name='sites_public') as view_cols;
