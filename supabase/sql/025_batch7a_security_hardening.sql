-- =====================================================================
-- 025_batch7a_security_hardening.sql  (Batch 7A)
--
-- ⚠️ চালানোর আগে: Batch 7A-এর কোড GitHub → Vercel-এ ডিপ্লয় হয়ে শেষ হতে হবে।
--    (কোড আগে না গেলে ফর্ম/অর্ডার/উইথড্রয়াল সাময়িকভাবে কাজ না করতে পারে।)
--
-- কী করে (সব এক ট্রানজ্যাকশনে — কোনো একটি ব্যর্থ হলে সব বাতিল):
--   A. enforce_signup_open: "অ্যাডমিন-তৈরি" পতাকা এখন raw_app_meta_data থেকে
--      (raw_user_meta_data ইউজার নিজে সেট করতে পারত → সাইনআপ বন্ধ থাকলেও ঢোকা যেত)
--   B. profiles: সবার জন্য পাঠযোগ্য ছিল (wallet_balance, referral_code, ban/flag তথ্যসহ)
--      → এখন শুধু নিজের সারি বা অ্যাডমিন। অন্যের পাবলিক তথ্য public_profile_cards ভিউ থেকে
--   C. ব্রাউজার থেকে সরাসরি ইনসার্ট বন্ধ (এখন সার্ভার-কোড দিয়ে হয়):
--      orders (দাম জাল করা যেত), withdrawal_requests, press_release_orders/items,
--      page_views, contact_messages, support_tickets, support_ticket_messages
--      (সাপোর্টে অ্যাডমিন-রিপ্লাইয়ের জন্য আলাদা অ্যাডমিন-পলিসি যোগ হয়)
--   D. admin_settings: সবার পাঠযোগ্য ছিল → শুধু অ্যাডমিন
--   E. নতুন টেবিলে (tasks, api_providers…) anon/authenticated-এর সরাসরি অনুমতি তুলে নেওয়া
--
-- কোনো ডাটা মোছে না/বদলায় না। শুধু নিয়ম (policy/function/view) বদলায়।
-- ROLLBACK: ফাইলের একদম নিচে।
-- =====================================================================

begin;

-- ---------------------------------------------------------------- A
create or replace function public.enforce_signup_open()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  is_open_raw text;
  created_by_admin boolean;
begin
  -- SECURITY: only app metadata (settable by the server/service role alone) is trusted.
  created_by_admin := coalesce((new.raw_app_meta_data->>'created_by_admin')::boolean, false);

  if created_by_admin then
    return new;
  end if;

  select value::text into is_open_raw from public.site_settings where key = 'signup_open';

  if is_open_raw in ('off', '"off"') then
    raise exception 'Signups are currently closed.' using errcode = 'P0001';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------- B
-- Public, non-sensitive profile fields live in this view. It runs with the
-- view owner's rights (security_invoker off) so it keeps working after the
-- profiles table is locked down. response_rate is appended as the LAST column.
create or replace view public.public_profile_cards as
  select id,
         coalesce(nullif(display_name, ''::text), full_name) as display_name,
         avatar_url,
         bio,
         country,
         role,
         seller_tier,
         completion_rate,
         avg_response_hours,
         dispute_rate,
         completed_order_count,
         response_rate
    from public.profiles;

alter view public.public_profile_cards set (security_invoker = off);
grant select on public.public_profile_cards to anon, authenticated;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------- C
drop policy if exists orders_insert_buyer on public.orders;
drop policy if exists "users can create their own withdrawal requests" on public.withdrawal_requests;
drop policy if exists "Users create own press orders" on public.press_release_orders;
drop policy if exists "Users add items to own press orders" on public.press_release_order_items;
drop policy if exists page_views_insert_any on public.page_views;
drop policy if exists contact_messages_insert_any on public.contact_messages;
drop policy if exists "anyone can create a ticket" on public.support_tickets;
drop policy if exists "anyone can create ticket messages" on public.support_ticket_messages;

-- Admin replies in the support inbox are inserted with the admin's own session,
-- so they need their own policy now that the open one is gone. (Users keep
-- "users can reply on their own tickets"; guests go through the server API.)
drop policy if exists support_ticket_messages_admin_insert on public.support_ticket_messages;
create policy support_ticket_messages_admin_insert on public.support_ticket_messages
  for insert to authenticated
  with check (public.is_admin());

-- ---------------------------------------------------------------- D
-- (admin_settings_write_admin, an ALL policy for is_admin(), already lets admins read.)
drop policy if exists admin_settings_select_all on public.admin_settings;

-- ---------------------------------------------------------------- E
revoke all on public.tasks          from anon, authenticated;
revoke all on public.task_logs      from anon, authenticated;
revoke all on public.api_providers  from anon, authenticated;
revoke all on public.api_usage_log  from anon, authenticated;
revoke all on sequence public.task_logs_id_seq     from anon, authenticated;
revoke all on sequence public.api_usage_log_id_seq from anon, authenticated;

commit;

-- =====================================================================
-- যাচাই (শুধু পড়া; আলাদা আলাদা Run করুন, ফল আমাকে জানান)
-- =====================================================================

-- V1: এই টেবিলগুলোর পলিসি — insert-এর "true"/অপ্রয়োজনীয় পলিসি আর থাকার কথা নয়
-- select tablename, policyname, cmd, roles from pg_policies
--  where schemaname='public' and tablename in
--   ('orders','withdrawal_requests','press_release_orders','press_release_order_items',
--    'page_views','contact_messages','support_tickets','support_ticket_messages','profiles','admin_settings')
--  order by tablename, policyname;

-- V2: anon হিসেবে profiles পড়া — ০ সারি আসা উচিত (এরর নয়)
-- begin; set local role anon; select count(*) as anon_visible_profiles from public.profiles; rollback;

-- V3: anon হিসেবে পাবলিক ভিউ — সারি আসা উচিত
-- begin; set local role anon; select count(*) as public_cards from public.public_profile_cards; rollback;

-- V4: ভিউ এখন security_invoker=off (options খালি বা false)
-- select relname, coalesce(reloptions::text,'') as options from pg_class where relname='public_profile_cards';

-- =====================================================================
-- ROLLBACK (শুধু সমস্যা হলে; আগের অবস্থায় ফিরিয়ে দেয়)
-- =====================================================================
-- begin;
-- -- A
-- create or replace function public.enforce_signup_open() returns trigger language plpgsql security definer set search_path to 'public' as $f$
-- declare is_open_raw text; created_by_admin boolean;
-- begin
--   created_by_admin := coalesce((new.raw_user_meta_data->>'created_by_admin')::boolean, false);
--   if created_by_admin then return new; end if;
--   select value::text into is_open_raw from public.site_settings where key = 'signup_open';
--   if is_open_raw in ('off', '"off"') then raise exception 'Signups are currently closed.' using errcode = 'P0001'; end if;
--   return new;
-- end; $f$;
-- -- B
-- drop policy if exists profiles_select_own_or_admin on public.profiles;
-- create policy profiles_select_all on public.profiles for select to public using (true);
-- alter view public.public_profile_cards set (security_invoker = on);
-- -- C
-- create policy orders_insert_buyer on public.orders for insert to public with check (buyer_id = auth.uid());
-- create policy "users can create their own withdrawal requests" on public.withdrawal_requests for insert to public with check (user_id = auth.uid());
-- create policy "Users create own press orders" on public.press_release_orders for insert to public with check (user_id = auth.uid());
-- create policy "Users add items to own press orders" on public.press_release_order_items for insert to public
--   with check (exists (select 1 from public.press_release_orders o where o.id = press_release_order_items.order_id and o.user_id = auth.uid()));
-- create policy page_views_insert_any on public.page_views for insert to public with check (true);
-- create policy contact_messages_insert_any on public.contact_messages for insert to public with check (true);
-- create policy "anyone can create a ticket" on public.support_tickets for insert to public with check (true);
-- create policy "anyone can create ticket messages" on public.support_ticket_messages for insert to public with check (true);
-- drop policy if exists support_ticket_messages_admin_insert on public.support_ticket_messages;
-- -- D
-- create policy admin_settings_select_all on public.admin_settings for select to public using (true);
-- commit;
