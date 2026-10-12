-- 020_diagnostics_commission_and_logs.sql — READ-ONLY. Run once, send me ALL the rows.

select 'q1_exchange_rate_setting' as q, to_jsonb(x) as data
from (select key, value from public.site_settings where key = 'bdt_per_usd') x

union all
select 'q2_admin_settings', to_jsonb(x)
from (select key, value from public.admin_settings
      where key in ('commission_rate_default', 'ppv_earning_hold_days')) x

union all
-- the 2 accepted orders earlier paid 10% commission although the tiers start at 20%
select 'q3_accepted_orders_commission', to_jsonb(x)
from (select id, seller_id, price_amount, commission_rate, commission_amount, accepted_at
      from public.orders where order_type::text = 'paid' and status::text = 'accepted') x

union all
-- was order 892b8570 accepted through the admin "force accept" button?
select 'q4_admin_logs_latest', to_jsonb(x)
from (select action, target_id, created_at, metadata
      from public.admin_logs order by created_at desc limit 30) x

union all
select 'q5_disputes', to_jsonb(x)
from (select id, order_id, status::text as status, created_at, resolved_at
      from public.disputes) x

order by 1;
