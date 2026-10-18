-- =====================================================================
-- 043_batch14_verify_and_selftest.sql  (Batch 14) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- V1-V4 only read. S1 uses the REAL wallet function inside one transaction and then
-- raises an error on purpose, so EVERYTHING (including the test credit) is rolled back.
-- =====================================================================

-- V1: table exists with RLS on. Expect 1 row, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'usage_charges';

-- V2: policy. Expect exactly 1 row: usage_charges / usage_charges_select.
select tablename, policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'usage_charges';

-- V3: table grants for anon/authenticated. Expect SELECT for authenticated and nothing for anon.
-- (Supabase defaults may also show REFERENCES / TRIGGER for authenticated: harmless. There must be NO INSERT/UPDATE/DELETE.)
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'usage_charges' and grantee in ('anon','authenticated')
order by 1, 2;

-- V4: the two functions must NOT be callable by browsers. Expect both rows with anon_can = false, authenticated_can = false, service_can = true.
select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_can,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can,
       has_function_privilege('service_role', p.oid, 'execute') as service_can
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('usage_charge_debit', 'usage_charge_refund')
order by 1;

-- S1: self-test with the real wallet function (needs at least 1 row in profiles).
-- It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved, no wallet changed).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare
  u uuid; b0 integer; r record; r2 record; rf record; n integer; k text := to_char(clock_timestamp(), 'HH24MISSUS');
  c1 uuid; c3 uuid;
  bal integer;
begin
  select id into u from public.profiles order by id limit 1;
  if u is null then raise exception 'SELFTEST FAILED: no profiles found'; end if;
  select wallet_balance into b0 from public.profiles where id = u;

  -- give the test user spendable money (rolled back at the end)
  perform public.adjust_wallet_balance(p_user_id => u, p_delta => 100, p_type => 'admin_adjustment', p_notes => 'selftest credit');
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 100 then raise exception 'SELFTEST FAILED: test credit did not change the balance (% -> %)', b0, bal; end if;

  -- a) a normal charge takes money once
  select * into r from public.usage_charge_debit(u, 'selftest_action', 30, 'st14-' || k || '-a', 0);
  if not r.r_ok or r.r_charged <> 30 or r.r_is_free then raise exception 'SELFTEST FAILED: charge 30 -> ok=%, code=%, msg=%, charged=%', r.r_ok, r.r_code, r.r_message, r.r_charged; end if;
  c1 := r.r_charge_id;
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 70 then raise exception 'SELFTEST FAILED: balance after charge is % (expected %)', bal, b0 + 70; end if;

  -- b) the same key again does NOT charge again
  select * into r2 from public.usage_charge_debit(u, 'selftest_action', 30, 'st14-' || k || '-a', 0);
  if r2.r_ok or r2.r_code is distinct from 'duplicate' then raise exception 'SELFTEST FAILED: duplicate key -> ok=%, code=%', r2.r_ok, r2.r_code; end if;
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 70 then raise exception 'SELFTEST FAILED: duplicate request changed the balance to %', bal; end if;

  -- c) not enough money: refused, nothing taken, no usage row left behind
  select * into r2 from public.usage_charge_debit(u, 'selftest_action', b0 + 70 + 1, 'st14-' || k || '-b', 0);
  if r2.r_ok or r2.r_code is distinct from 'insufficient' then
    raise exception 'SELFTEST FAILED: overspending -> ok=%, code=%, message=%', r2.r_ok, r2.r_code, r2.r_message;
  end if;
  select count(*) into n from public.usage_charges where user_id = u and idempotency_key = 'st14-' || k || '-b';
  if n <> 0 then raise exception 'SELFTEST FAILED: a refused charge left a usage row behind'; end if;
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 70 then raise exception 'SELFTEST FAILED: refused charge changed the balance to %', bal; end if;

  -- d) refund gives the money back exactly once
  select * into rf from public.usage_charge_refund(c1, 'selftest');
  if not rf.r_ok or rf.r_refunded <> 30 then raise exception 'SELFTEST FAILED: refund -> ok=%, refunded=%, msg=%', rf.r_ok, rf.r_refunded, rf.r_message; end if;
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 100 then raise exception 'SELFTEST FAILED: balance after refund is % (expected %)', bal, b0 + 100; end if;
  select * into rf from public.usage_charge_refund(c1, 'selftest again');
  if not rf.r_ok or rf.r_refunded <> 0 then raise exception 'SELFTEST FAILED: second refund -> ok=%, refunded=%', rf.r_ok, rf.r_refunded; end if;
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 100 then raise exception 'SELFTEST FAILED: second refund changed the balance to %', bal; end if;

  -- e) daily free allowance: first 2 uses free, third is charged; refunding a free use takes nothing
  select * into r from public.usage_charge_debit(u, 'selftest_free', 5, 'st14-' || k || '-f1', 2);
  if not r.r_ok or not r.r_is_free or r.r_charged <> 0 then raise exception 'SELFTEST FAILED: free use 1 -> ok=%, free=%, charged=%', r.r_ok, r.r_is_free, r.r_charged; end if;
  c3 := r.r_charge_id;
  select * into r from public.usage_charge_debit(u, 'selftest_free', 5, 'st14-' || k || '-f2', 2);
  if not r.r_ok or not r.r_is_free then raise exception 'SELFTEST FAILED: free use 2 was not free'; end if;
  select * into r from public.usage_charge_debit(u, 'selftest_free', 5, 'st14-' || k || '-f3', 2);
  if not r.r_ok or r.r_is_free or r.r_charged <> 5 then raise exception 'SELFTEST FAILED: use 3 -> ok=%, free=%, charged=%', r.r_ok, r.r_is_free, r.r_charged; end if;
  select wallet_balance into bal from public.profiles where id = u;
  if bal <> b0 + 95 then raise exception 'SELFTEST FAILED: balance after free+charged uses is % (expected %)', bal, b0 + 95; end if;
  select * into rf from public.usage_charge_refund(c3, 'selftest free');
  if not rf.r_ok or rf.r_refunded <> 0 then raise exception 'SELFTEST FAILED: refund of a free use -> ok=%, refunded=%', rf.r_ok, rf.r_refunded; end if;
  select count(*) into n from public.usage_charges where id = c3 and status = 'void';
  if n <> 1 then raise exception 'SELFTEST FAILED: a refunded free use was not marked void'; end if;

  -- f) bad input is refused without touching anything
  select * into r2 from public.usage_charge_debit(u, 'Bad Action!', 5, 'st14-' || k || '-x', 0);
  if r2.r_ok or r2.r_code is distinct from 'invalid' then raise exception 'SELFTEST FAILED: bad action name was accepted'; end if;
  select * into r2 from public.usage_charge_debit(u, 'selftest_action', -5, 'st14-' || k || '-y', 0);
  if r2.r_ok or r2.r_code is distinct from 'invalid' then raise exception 'SELFTEST FAILED: negative amount was accepted'; end if;
  select * into rf from public.usage_charge_refund('00000000-0000-0000-0000-000000000000', 'x');
  if rf.r_ok then raise exception 'SELFTEST FAILED: refund of a missing charge reported ok'; end if;

  raise exception 'SELFTEST PASSED: charge, duplicate, overspend, refund, free allowance and bad-input rules all behave with the real wallet function (nothing was saved)';
end $$;
