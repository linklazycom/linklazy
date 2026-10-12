-- 019_unlock_ledger_split.sql
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Problem: every Pay-Per-View unlock wrote TWO negative ledger rows, 'unlock_spend' for the
-- full price AND 'platform_fee' for the 20% fee, but the buyer's balance only dropped by the
-- price. Ledger total never matched the balance (each unlock was off by the fee).
--
-- Fix: split the price into two rows that add up to the price:
--     unlock_spend = -(seller's 80%)      platform_fee = -(platform's 20%)
-- Admin revenue still reads the platform_fee rows (unchanged); nothing else in the app
-- reads the unlock_spend amount (only counts it).
--
-- Part 1: new function (keeps the caller check from 010). Part 2: fixes the old rows.
-- Part 3 (the check at the bottom): run it as a SEPARATE Run.

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

  -- price split in two rows that add up to exactly the amount taken from the balance
  insert into public.wallet_ledger (user_id, type, amount, related_site_id, related_user_id, balance_after, notes)
    values (p_buyer_id, 'unlock_spend', -v_seller_earning, p_site_id, v_site.owner_id, v_buyer_balance_after, 'Site detail unlock (pay-per-view)');

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

-- Part 2: fix the OLD rows. Only rows still in the old form (amount = -full price) are touched,
-- so re-running does nothing.
update public.wallet_ledger u
set amount = -su.seller_earning
from public.site_unlocks su
where u.type = 'unlock_spend'
  and u.user_id = su.buyer_id
  and u.related_site_id = su.site_id
  and u.created_at = su.unlocked_at
  and u.amount = -su.price_paid
  and su.platform_fee > 0;

-- Part 3 — run this check as a separate Run. Expected: NO rows.
-- select p.id, p.full_name, p.wallet_balance, coalesce(sum(w.amount), 0) as ledger_sum
-- from public.profiles p left join public.wallet_ledger w on w.user_id = p.id
-- group by p.id, p.full_name, p.wallet_balance
-- having p.wallet_balance <> coalesce(sum(w.amount), 0);
