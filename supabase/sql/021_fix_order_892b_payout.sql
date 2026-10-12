-- 021_fix_order_892b_payout.sql — OPTIONAL. Run only AFTER you sent me the 020 result.
--
-- Order 892b8570... (4500, seller = your admin test account) was accepted without paying the
-- seller (the old admin "force accept" never paid). It is test data, so this is optional, but
-- until it is fixed the "Payment health" page will keep listing it.
--
-- STEP 1 (preview, read-only, run alone): shows what would be paid.
select o.id, o.price_amount,
       coalesce((select (value #>> '{}')::numeric from public.site_settings
                 where key = 'bdt_per_usd' and (value #>> '{}') ~ '^[0-9.]+$'), 125) as bdt_per_usd,
       (select count(*) from public.wallet_ledger w
         where w.user_id = o.seller_id and w.type = 'seller_earning'
           and w.related_user_id = o.buyer_id and w.notes like 'Order payout%'
           and w.created_at >= o.accepted_at - interval '1 minute') as existing_payout_rows
from public.orders o
where o.id = '892b8570-c220-4bfb-9929-272cf2a58025';

-- STEP 2 (the fix, run as a separate Run). Stops with an error if a payout already exists.
do $$
declare
  v_order record;
  v_bdt_per_usd numeric;
  v_prior bigint;
  v_rate numeric;
  v_commission integer;
  v_earning integer;
begin
  select * into v_order from public.orders
  where id = '892b8570-c220-4bfb-9929-272cf2a58025'
    and order_type::text = 'paid' and status::text = 'accepted';
  if not found then
    raise exception 'Order not found or not in accepted state';
  end if;

  if exists (
    select 1 from public.wallet_ledger w
    where w.user_id = v_order.seller_id and w.type = 'seller_earning'
      and w.related_user_id = v_order.buyer_id and w.notes like 'Order payout%'
      and w.created_at >= v_order.accepted_at - interval '1 minute'
  ) then
    raise exception 'A payout for this order already exists - nothing to do';
  end if;

  select coalesce((select (value #>> '{}')::numeric from public.site_settings
                   where key = 'bdt_per_usd' and (value #>> '{}') ~ '^[0-9.]+$'), 125)
    into v_bdt_per_usd;

  select coalesce(sum(price_amount), 0) into v_prior
  from public.orders
  where seller_id = v_order.seller_id and order_type::text = 'paid' and status::text = 'accepted'
    and accepted_at >= (date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')
    and id <> v_order.id;

  -- same tiers as lib/commission.ts: <$500 20%, <$1000 15%, else 10%
  v_rate := case
    when (v_prior + v_order.price_amount) / v_bdt_per_usd >= 1000 then 10
    when (v_prior + v_order.price_amount) / v_bdt_per_usd >= 500 then 15
    else 20 end;
  v_commission := round(v_order.price_amount * v_rate / 100);
  v_earning := v_order.price_amount - v_commission;

  perform public.adjust_wallet_balance(
    v_order.seller_id, v_earning, 'seller_earning',
    'Order payout after ' || v_rate || '% commission (manual correction: admin force-accept had not paid the seller)',
    null, null, v_order.site_id, v_order.buyer_id
  );

  update public.orders set commission_rate = v_rate, commission_amount = v_commission where id = v_order.id;
  update public.payments set status = 'released' where order_id = v_order.id and status = 'held_escrow';

  raise notice 'Paid % (commission %, rate %) to seller %', v_earning, v_commission, v_rate, v_order.seller_id;
end $$;
