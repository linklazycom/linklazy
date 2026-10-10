-- 010_lock_down_wallet_functions.sql
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Problem: SECURITY DEFINER wallet functions were callable by any visitor via
-- the public REST API (/rest/v1/rpc/...). adjust_wallet_balance could mint money,
-- unlock_site_with_wallet(p_buyer_id) could spend another user's balance.
-- The app calls adjust_wallet_balance / place_bulk_order_with_wallet /
-- increment_coupon_redemption_count only with the service-role client, so they
-- can be closed completely. unlock_site_with_wallet is called with the logged-in
-- user's session, so it stays open to `authenticated` but now checks the caller.

-- 1) Close server-only functions
revoke execute on function public.adjust_wallet_balance(uuid, numeric, text, text, text, text, uuid, uuid, boolean) from public, anon, authenticated;
revoke execute on function public.place_bulk_order_with_wallet(uuid, uuid[], text, text, text) from public, anon, authenticated;
revoke execute on function public.increment_coupon_redemption_count(uuid) from public, anon, authenticated;

grant execute on function public.adjust_wallet_balance(uuid, numeric, text, text, text, text, uuid, uuid, boolean) to service_role;
grant execute on function public.place_bulk_order_with_wallet(uuid, uuid[], text, text, text) to service_role;
grant execute on function public.increment_coupon_redemption_count(uuid) to service_role;

-- 2) unlock_site_with_wallet: same logic as before + caller check
create or replace function public.unlock_site_with_wallet(p_buyer_id uuid, p_site_id uuid)
returns table(ok boolean, error text, expires_at timestamp with time zone)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_site record;
  v_buyer record;
  v_existing record;
  v_platform_fee integer;
  v_seller_earning integer;
  v_expires_at timestamptz;
  v_buyer_balance_after integer;
  v_hold_days integer;
begin
  -- NEW: a logged-in user may only unlock for themselves (service role is exempt)
  if coalesce(auth.role(), '') <> 'service_role'
     and (auth.uid() is null or auth.uid() <> p_buyer_id) then
    return query select false, 'Not allowed.', null::timestamptz;
    return;
  end if;

  select id, owner_id, pay_per_view_enabled, view_price, access_duration_days
    into v_site
    from public.sites
    where id = p_site_id
    for update;

  if not found then
    return query select false, 'Site not found.', null::timestamptz;
    return;
  end if;

  if v_site.owner_id = p_buyer_id then
    return query select false, 'You cannot unlock your own site.', null::timestamptz;
    return;
  end if;

  if not v_site.pay_per_view_enabled or v_site.view_price is null then
    return query select false, 'This site is not available for pay-per-view.', null::timestamptz;
    return;
  end if;

  select su.* into v_existing
    from public.site_unlocks su
    where su.buyer_id = p_buyer_id and su.site_id = p_site_id
      and (su.expires_at is null or su.expires_at > now())
      and su.earning_status != 'reversed'
    order by su.unlocked_at desc
    limit 1;

  if found then
    return query select true, null::text, v_existing.expires_at;
    return;
  end if;

  select id, wallet_balance into v_buyer
    from public.profiles
    where id = p_buyer_id
    for update;

  if not found then
    return query select false, 'Buyer profile not found.', null::timestamptz;
    return;
  end if;

  if v_buyer.wallet_balance < v_site.view_price then
    return query select false, 'Insufficient wallet balance. Please top up.', null::timestamptz;
    return;
  end if;

  v_platform_fee := round(v_site.view_price * 0.20);
  v_seller_earning := v_site.view_price - v_platform_fee;

  if v_site.access_duration_days is null then
    v_expires_at := null;
  else
    v_expires_at := now() + (v_site.access_duration_days || ' days')::interval;
  end if;

  select coalesce((value)::text::integer, 4) into v_hold_days
    from public.admin_settings where key = 'ppv_earning_hold_days';
  if v_hold_days is null then
    v_hold_days := 4;
  end if;

  update public.profiles
    set wallet_balance = wallet_balance - v_site.view_price
    where id = p_buyer_id
    returning wallet_balance into v_buyer_balance_after;

  insert into public.wallet_ledger (user_id, type, amount, related_site_id, related_user_id, balance_after, notes)
    values (p_buyer_id, 'unlock_spend', -v_site.view_price, p_site_id, v_site.owner_id, v_buyer_balance_after, 'Site detail unlock (pay-per-view)');

  insert into public.wallet_ledger (user_id, type, amount, related_site_id, related_user_id, balance_after, notes)
    values (p_buyer_id, 'platform_fee', -v_platform_fee, p_site_id, v_site.owner_id, v_buyer_balance_after, 'LinkLazy platform fee (20%)');

  insert into public.site_unlocks (
    buyer_id, site_id, expires_at, price_paid, platform_fee, seller_earning,
    earning_status, earning_release_at
  )
    values (
      p_buyer_id, p_site_id, v_expires_at, v_site.view_price, v_platform_fee, v_seller_earning,
      'pending', now() + (v_hold_days || ' days')::interval
    );

  return query select true, null::text, v_expires_at;
end;
$function$;

revoke execute on function public.unlock_site_with_wallet(uuid, uuid) from public, anon;
grant execute on function public.unlock_site_with_wallet(uuid, uuid) to authenticated, service_role;
