-- 031_batch8b_refund_type_check_read_only.sql - READ ONLY. Run AFTER the Batch 8b code is deployed
-- and after you have rejected one test order or withdrawal request.
--
-- R1: ledger types in use (expect order_refund to appear after a refund; admin_adjustment only
--     for manual admin corrections or if the fallback was needed)
select type, count(*) as entries, coalesce(sum(amount), 0) as total
from public.wallet_ledger
group by type
order by type;

-- R2: the latest refund entries
select created_at, user_id, type, amount, notes
from public.wallet_ledger
where type in ('order_refund', 'admin_adjustment')
order by created_at desc
limit 10;
