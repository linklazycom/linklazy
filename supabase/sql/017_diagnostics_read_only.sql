-- 017_diagnostics_read_only.sql — READ-ONLY (changes nothing). Run once, send me ALL the rows.
-- One result table: column q = which check, column data = the row.
-- A check that returns nothing simply does not appear (that is good news).

-- A) Paid orders that were accepted but whose seller payout is not in the ledger
select 'A_accepted_orders_without_payout' as q, to_jsonb(x) as data
from (
  select o.id, o.price_amount, o.accepted_at, o.seller_id, o.buyer_id
  from public.orders o
  where o.order_type::text = 'paid' and o.status::text = 'accepted'
    and not exists (
      select 1 from public.wallet_ledger w
      where w.user_id = o.seller_id and w.type = 'seller_earning'
        and w.related_user_id = o.buyer_id and w.related_site_id = o.site_id
        and w.notes like 'Order payout%'
        and w.created_at between o.accepted_at - interval '1 minute' and o.accepted_at + interval '30 minutes'
    )
) x

union all
-- B) Wallet balance vs ledger. Known issue: each unlock writes an extra 'platform_fee'
--    row that did not reduce the balance, so compare ledger_without_fee_rows to the balance.
select 'B_balance_vs_ledger', to_jsonb(x)
from (
  select p.id, p.full_name, p.wallet_balance,
         coalesce(sum(w.amount) filter (where w.type <> 'platform_fee'), 0) as ledger_without_fee_rows,
         p.wallet_balance - coalesce(sum(w.amount) filter (where w.type <> 'platform_fee'), 0) as difference
  from public.profiles p
  left join public.wallet_ledger w on w.user_id = p.id
  group by p.id, p.full_name, p.wallet_balance
  having p.wallet_balance <> coalesce(sum(w.amount) filter (where w.type <> 'platform_fee'), 0)
) x

union all
-- C) Payments that never finished
select 'C_payments_initiated', to_jsonb(x)
from (
  select id, order_id, provider::text as provider, amount, currency, created_at
  from public.payments where status::text = 'initiated'
) x

union all
-- D) Paid orders past the payment step with no payment row
select 'D_orders_without_payment_row', to_jsonb(x)
from (
  select o.id, o.status::text as status, o.price_amount, o.created_at
  from public.orders o
  where o.order_type::text = 'paid'
    and o.status::text not in ('pending_payment', 'cancelled', 'refunded')
    and not exists (select 1 from public.payments p where p.order_id = o.id)
) x

union all
-- E) Pending withdrawal requests vs wallet balance (can the user actually cover them?)
select 'E_withdrawals_open', to_jsonb(x)
from (
  select r.id, r.user_id, r.amount, r.status, p.wallet_balance, r.requested_at
  from public.withdrawal_requests r join public.profiles p on p.id = r.user_id
  where r.status in ('pending', 'approved')
) x

order by 1;
