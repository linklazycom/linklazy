-- 013a_preflight_check.sql  — READ-ONLY. Run BEFORE deploying the Batch 3 code.
-- Send me the results of all queries (1-6).

-- 1) Which provider/status values do payments use? (wallet orders must show 'wallet' + 'held_escrow')
select provider, status, count(*) as rows
from public.payments group by 1, 2 order by 1, 2;

-- 2) All enum types and their values (payment status/provider, order status, roles...)
select t.typname as enum_name, e.enumlabel as value
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where n.nspname = 'public'
order by t.typname, e.enumsortorder;

-- 3) Paid orders that were delivered/accepted but have NO held/released payment
--    (these would be blocked from payout by the new rule — or are suspicious)
select o.id, o.status, o.price_amount, o.created_at, o.buyer_id, o.seller_id
from public.orders o
where o.order_type::text = 'paid'
  and o.status::text in ('delivered', 'accepted')
  and not exists (
    select 1 from public.payments p
    where p.order_id = o.id and p.status::text in ('held_escrow', 'released')
  )
order by o.created_at desc;

-- 4) Orders where buyer = seller (self-dealing)
select id, status, order_type, price_amount, created_at
from public.orders where buyer_id = seller_id;

-- 5) bKash payments counted as paid but WITHOUT a "Completed" transaction on record
--    (old code accepted any HTTP-200 answer from bKash). Look at these carefully.
select id, order_id, payer_id, status::text as status, amount, created_at,
       raw_response->>'transactionStatus' as bkash_status,
       raw_response->>'statusCode' as bkash_code
from public.payments
where provider::text = 'bkash'
  and status::text in ('held_escrow', 'released')
  and coalesce(raw_response->>'transactionStatus', '') <> 'Completed'
order by created_at desc;

-- 6) Wallet top-ups in the ledger that have no matching "released" payment
select w.id, w.user_id, w.amount, w.provider, w.provider_txn_id, w.created_at
from public.wallet_ledger w
where w.type = 'topup'
  and not exists (
    select 1 from public.payments p
    where p.provider_txn_id = w.provider_txn_id and p.status::text = 'released'
  )
order by w.created_at desc;
