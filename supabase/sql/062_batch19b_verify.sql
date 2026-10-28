-- Batch 19B verify (read-only). Run V1..V4 one at a time.

-- V1: expect 4 rows
select column_name from information_schema.columns
 where table_schema='public' and table_name='press_release_orders'
   and column_name in ('delivery_url','expected_delivery_at','delivered_at','status_changed_at') order by 1;

-- V2: expect 1 row (delivery_days)
select column_name from information_schema.columns
 where table_schema='public' and table_name='press_release_products' and column_name='delivery_days';

-- V3: expect ONE row: prf_admin_select | SELECT
select policyname, cmd from pg_policies where schemaname='public' and tablename='press_release_fulfillment';

-- V4: expect ONE row: authenticated | SELECT  (no anon row, no insert/update/delete)
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='press_release_fulfillment' and grantee in ('anon','authenticated');
