-- 011_protect_profiles.sql
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Problem: policy `profiles_update_own` lets a user update EVERY column of their
-- own profile from the browser (anon key + session). That includes wallet_balance,
-- role ('admin' => is_admin() becomes true), is_banned, seller_tier, etc.
--
-- Fix: a BEFORE UPDATE trigger. It only restricts direct client sessions
-- (current_user = authenticated/anon). Server code (service_role), SECURITY DEFINER
-- functions (e.g. recompute_seller_stats) and the SQL editor are unaffected.
-- Admins (is_admin()) are unaffected.
-- The app's own self-service writes still work:
--   * register form: role (buyer/seller/both) and referred_by (once)
--   * profile page: "become seller" (buyer/seller -> both), name, bio, avatar, etc.

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if public.is_admin() then
    return new;
  end if;

  if new.wallet_balance      is distinct from old.wallet_balance
  or new.is_verified_seller  is distinct from old.is_verified_seller
  or new.seller_tier         is distinct from old.seller_tier
  or new.response_rate       is distinct from old.response_rate
  or new.avg_delivery_hours  is distinct from old.avg_delivery_hours
  or new.completion_rate     is distinct from old.completion_rate
  or new.avg_response_hours  is distinct from old.avg_response_hours
  or new.dispute_rate        is distinct from old.dispute_rate
  or new.completed_order_count is distinct from old.completed_order_count
  or new.metrics_updated_at  is distinct from old.metrics_updated_at
  or new.is_suspended        is distinct from old.is_suspended
  or new.is_flagged          is distinct from old.is_flagged
  or new.flag_reason         is distinct from old.flag_reason
  or new.flagged_at          is distinct from old.flagged_at
  or new.flagged_by          is distinct from old.flagged_by
  or new.is_banned           is distinct from old.is_banned
  or new.banned_at           is distinct from old.banned_at
  or new.banned_reason       is distinct from old.banned_reason
  or new.banned_by           is distinct from old.banned_by
  or new.buyer_plan          is distinct from old.buyer_plan
  or new.buyer_plan_renews_at is distinct from old.buyer_plan_renews_at
  or new.buyer_views_quota   is distinct from old.buyer_views_quota
  or new.buyer_views_used    is distinct from old.buyer_views_used
  or new.seller_plan         is distinct from old.seller_plan
  or new.referral_code       is distinct from old.referral_code
  or new.created_at          is distinct from old.created_at
  then
    raise exception 'This profile field can only be changed by an admin or the system.'
      using errcode = '42501';
  end if;

  -- role: only buyer / seller / both, and never leaving or entering 'admin'
  if new.role is distinct from old.role then
    if old.role::text = 'admin' or new.role::text not in ('buyer', 'seller', 'both') then
      raise exception 'Role change not allowed.' using errcode = '42501';
    end if;
  end if;

  -- referred_by: set once, never to yourself
  if new.referred_by is distinct from old.referred_by then
    if old.referred_by is not null or new.referred_by = new.id then
      raise exception 'Referral cannot be changed.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_protect_profile_columns on public.profiles;
create trigger trg_protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();
