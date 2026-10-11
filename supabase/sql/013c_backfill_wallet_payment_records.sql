-- 013c_backfill_wallet_payment_records.sql
-- Run AFTER 013b has finished (separate Run). Safe to re-run (it skips orders that
-- already have a payment row).
--
-- Why: wallet-paid orders created before 013b have no payments row, so the new
-- "no held payment = no payout" rule would block their payout. This creates the
-- missing row ONLY for orders where the ledger proves the buyer's wallet was debited
-- (a 'bulk_order_spend' entry with exactly the order's creation timestamp).

-- Open / delivered orders -> money is still held in escrow
insert into public.payments (order_id, payer_id, provider, amount, currency, status)
select o.id, o.buyer_id, 'wallet', o.price_amount, 'BDT', 'held_escrow'
from public.orders o
where o.order_type::text = 'paid'
  and o.status::text in ('pending_seller_acceptance', 'awaiting_seller_site', 'in_progress', 'delivered', 'disputed')
  and o.price_amount is not null
  and not exists (select 1 from public.payments p where p.order_id = o.id)
  and exists (
    select 1 from public.wallet_ledger w
    where w.user_id = o.buyer_id
      and w.type = 'bulk_order_spend'
      and w.created_at = o.created_at
  );

-- Already accepted orders -> record as released (for consistent reports; no money moves)
insert into public.payments (order_id, payer_id, provider, amount, currency, status)
select o.id, o.buyer_id, 'wallet', o.price_amount, 'BDT', 'released'
from public.orders o
where o.order_type::text = 'paid'
  and o.status::text = 'accepted'
  and o.price_amount is not null
  and not exists (select 1 from public.payments p where p.order_id = o.id)
  and exists (
    select 1 from public.wallet_ledger w
    where w.user_id = o.buyer_id
      and w.type = 'bulk_order_spend'
      and w.created_at = o.created_at
  );

-- Check: paid orders still WITHOUT a payment row (expected: none, or only ones you can explain)
select o.id, o.status::text as status, o.price_amount, o.created_at
from public.orders o
where o.order_type::text = 'paid'
  and o.status::text not in ('pending_payment', 'cancelled', 'refunded')
  and not exists (select 1 from public.payments p where p.order_id = o.id);
