-- Batch 19C verify (read-only). Run V1..V4 one at a time.

-- V1: expect t (table exists)
select to_regclass('public.wallet_bonuses') is not null as table_ok;

-- V2: expect ONE row for the tracker trigger, tgenabled = O
select tgname, tgenabled from pg_trigger where tgname = 'wallet_bonus_track_trg';

-- V3: expect TWO policy rows: wallet_bonuses_admin_select | SELECT and wallet_bonuses_own_select | SELECT
select policyname, cmd from pg_policies where schemaname='public' and tablename='wallet_bonuses' order by 1;

-- V4: expect ONE row: authenticated | SELECT (no anon, no write rights)
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='wallet_bonuses' and grantee in ('anon','authenticated');
