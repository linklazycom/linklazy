-- =====================================================================
-- 037_batch11_verify_and_selftest.sql  (Batch 11) — read-only checks
-- Run each block (V1, V2, V3, S1) ONE AT A TIME and send me the results.
-- Nothing here is saved: V1-V3 only read; S1 changes things and then
-- raises an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: both tables exist with RLS on. Expect 2 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('custom_domains','api_keys')
order by 1;

-- V2: policies. Expect exactly 1 row: custom_domains / custom_domains_select. (api_keys has none, on purpose.)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('custom_domains','api_keys')
order by 1, 2;

-- V3: grants for anon/authenticated. Expect ONLY: authenticated SELECT on custom_domains. Nothing on api_keys.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('custom_domains','api_keys')
  and grantee in ('anon','authenticated')
order by 1, 2, 3;

-- S1: self-test (needs at least 1 row in auth.users). It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare
  u1 uuid; u2 uuid; d1 uuid; d2 uuid; ok boolean;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null then raise exception 'SELFTEST FAILED: no users found'; end if;

  -- a) bad status is rejected
  begin
    insert into public.custom_domains(user_id, hostname, status, verify_token) values (u1, 'selftest.example.org', 'bogus', 'x');
    raise exception 'SELFTEST FAILED: bad status accepted';
  exception when check_violation then null; end;

  -- b) uppercase hostname is rejected
  begin
    insert into public.custom_domains(user_id, hostname, verify_token) values (u1, 'SelfTest.Example.org', 'x');
    raise exception 'SELFTEST FAILED: uppercase hostname accepted';
  exception when check_violation then null; end;

  -- c) same user cannot claim the same hostname twice
  insert into public.custom_domains(user_id, hostname, verify_token) values (u1, 'selftest.example.org', 't1') returning id into d1;
  begin
    insert into public.custom_domains(user_id, hostname, verify_token) values (u1, 'selftest.example.org', 't2');
    raise exception 'SELFTEST FAILED: duplicate claim by same user accepted';
  exception when unique_violation then null; end;

  -- d) first to verify wins; a second verified owner is rejected (needs a 2nd user)
  if u2 is not null then
    insert into public.custom_domains(user_id, hostname, verify_token) values (u2, 'selftest.example.org', 't3') returning id into d2;
    update public.custom_domains set status = 'active' where id = d1;
    begin
      update public.custom_domains set status = 'verified' where id = d2;
      raise exception 'SELFTEST FAILED: two owners of one hostname accepted';
    exception when unique_violation then null; end;
  end if;

  -- e) api_keys: bad scope, bad hash length and duplicate hash are rejected
  begin
    insert into public.api_keys(user_id, name, key_prefix, key_hash, scopes) values (u1, 'k', 'll_live_abcd', repeat('a',64), '{admin}');
    raise exception 'SELFTEST FAILED: bad scope accepted';
  exception when check_violation then null; end;
  begin
    insert into public.api_keys(user_id, name, key_prefix, key_hash) values (u1, 'k', 'll_live_abcd', 'short');
    raise exception 'SELFTEST FAILED: short hash accepted';
  exception when check_violation then null; end;
  insert into public.api_keys(user_id, name, key_prefix, key_hash) values (u1, 'k', 'll_live_abcd', repeat('b',64));
  begin
    insert into public.api_keys(user_id, name, key_prefix, key_hash) values (u1, 'k2', 'll_live_abcd', repeat('b',64));
    raise exception 'SELFTEST FAILED: duplicate hash accepted';
  exception when unique_violation then null; end;

  raise exception 'SELFTEST PASSED: constraints and unique rules all behave (nothing was saved)';
end $$;
