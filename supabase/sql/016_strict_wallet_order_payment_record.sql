-- 016_strict_wallet_order_payment_record.sql
-- Run AFTER 013b (enum value 'wallet' must already exist). Safe to re-run.
--
-- Problem: place_bulk_order_with_wallet wrapped the payments insert in
--   exception when check_violation or invalid_text_representation then null
-- which silently swallowed the failure: the buyer was charged, the order was created,
-- but NO "money held" record existed (this is what happened with provider 'wallet'
-- before 013b).
--
-- Fix: same function, but a failed payments insert now aborts the whole call
-- (nothing is charged, no order is created) instead of being ignored.
-- Everything else is unchanged.

create or replace function public.place_bulk_order_with_wallet(
  p_buyer_id uuid,
  p_site_ids uuid[],
  p_target_url text,
  p_anchor_text text,
  p_notes text default null::text
)
returns table(ok boolean, error text, created_order_ids uuid[], skipped jsonb, new_balance integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_balance integer;
  v_commission_rate numeric;
  v_site record;
  v_total integer := 0;
  v_created uuid[] := '{}';
  v_skipped jsonb := '[]'::jsonb;
  v_order_id uuid;
  v_commission_amount integer;
  v_deadline timestamptz;
begin
  select wallet_balance into v_balance
  from profiles
  where id = p_buyer_id
  for update;

  if v_balance is null then
    return query select false, 'Buyer profile not found.', '{}'::uuid[], '[]'::jsonb, 0;
    return;
  end if;

  select coalesce(value::numeric, 17.5) into v_commission_rate
  from admin_settings where key = 'commission_rate_default';

  for v_site in
    select s.id, s.owner_id, s.status, s.price_amount, s.turnaround_hours,
           s.accepts_paid, s.domain
    from sites s
    where s.id = any(p_site_ids)
  loop
    if v_site.status != 'approved' then
      v_skipped := v_skipped || jsonb_build_object('domain', v_site.domain, 'reason', 'Site not available');
      continue;
    end if;
    if v_site.owner_id = p_buyer_id then
      v_skipped := v_skipped || jsonb_build_object('domain', v_site.domain, 'reason', 'You own this site');
      continue;
    end if;
    if not v_site.accepts_paid or v_site.price_amount is null then
      v_skipped := v_skipped || jsonb_build_object('domain', v_site.domain, 'reason', 'Doesn''t accept paid orders');
      continue;
    end if;

    if v_total + v_site.price_amount > v_balance then
      v_skipped := v_skipped || jsonb_build_object('domain', v_site.domain, 'reason', 'Insufficient wallet balance');
      continue;
    end if;

    v_commission_amount := round(v_site.price_amount * v_commission_rate / 100);
    v_deadline := now() + make_interval(hours => coalesce(v_site.turnaround_hours, 48));

    insert into orders (
      buyer_id, seller_id, site_id, order_type, status,
      target_url, anchor_text, notes,
      price_amount, commission_amount, commission_rate, deadline_at
    ) values (
      p_buyer_id, v_site.owner_id, v_site.id, 'paid', 'pending_seller_acceptance',
      p_target_url, p_anchor_text, p_notes,
      v_site.price_amount, v_commission_amount, v_commission_rate, v_deadline
    )
    returning id into v_order_id;

    -- NO exception swallowing any more: if this fails, the whole call fails.
    insert into payments (
      order_id, payer_id, provider, amount, currency, status
    ) values (
      v_order_id, p_buyer_id, 'wallet', v_site.price_amount, 'BDT', 'held_escrow'
    );

    v_created := v_created || v_order_id;
    v_total := v_total + v_site.price_amount;
  end loop;

  if array_length(v_created, 1) is null then
    return query select false, 'No orders could be placed.', '{}'::uuid[], v_skipped, v_balance;
    return;
  end if;

  update profiles
  set wallet_balance = wallet_balance - v_total
  where id = p_buyer_id;

  insert into wallet_ledger (user_id, type, amount, balance_after, notes)
  values (
    p_buyer_id, 'bulk_order_spend', -v_total, v_balance - v_total,
    'Wallet payment for ' || array_length(v_created, 1) || ' backlink order(s)'
  );

  return query select true, null::text, v_created, v_skipped, (v_balance - v_total);
end;
$function$;

-- keep it server-only (same as 010)
revoke execute on function public.place_bulk_order_with_wallet(uuid, uuid[], text, text, text) from public, anon, authenticated;
grant execute on function public.place_bulk_order_with_wallet(uuid, uuid[], text, text, text) to service_role;
