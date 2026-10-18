-- =====================================================================
-- 041_batch13_verify_and_selftest.sql  (Batch 13) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing here is saved: V1-V4 only read; S1 changes things and then
-- raises an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: both tables exist with RLS on. Expect 2 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('backlinks','backlink_checks')
order by 1;

-- V2: policies. Expect exactly 2 rows: backlink_checks / backlink_checks_select and backlinks / backlinks_select.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('backlinks','backlink_checks')
order by 1, 2;

-- V3: grants for anon/authenticated. Expect SELECT for authenticated on both tables and nothing for anon.
-- (Supabase defaults may also show REFERENCES / TRIGGER for authenticated: harmless. There must be NO INSERT/UPDATE/DELETE.)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('backlinks','backlink_checks')
  and grantee in ('anon','authenticated')
order by 1, 2, 3;

-- V4: the project-owner trigger on backlinks. Expect trigger_enabled = 1.
select count(*) as trigger_enabled
from pg_trigger
where tgname = 'backlinks_project_owner' and not tgisinternal and tgenabled = 'O';

-- S1: self-test (needs at least 1 row in auth.users; 2 users test the cross-user rules).
-- It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare
  u1 uuid; u2 uuid; p1 uuid; p2 uuid; b1 uuid; n int;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null then raise exception 'SELFTEST FAILED: no users found'; end if;

  -- a) bad status / bad origin / uppercase domain are rejected
  begin
    insert into public.backlinks(user_id, source_url, source_domain, target_url, status) values (u1, 'https://src.example.org/a', 'src.example.org', 'https://me.example.org/', 'bogus');
    raise exception 'SELFTEST FAILED: bad status accepted';
  exception when check_violation then null; end;
  begin
    insert into public.backlinks(user_id, source_url, source_domain, target_url, origin) values (u1, 'https://src.example.org/a', 'src.example.org', 'https://me.example.org/', 'scraped');
    raise exception 'SELFTEST FAILED: bad origin accepted';
  exception when check_violation then null; end;
  begin
    insert into public.backlinks(user_id, source_url, source_domain, target_url) values (u1, 'https://src.example.org/a', 'SRC.example.org', 'https://me.example.org/');
    raise exception 'SELFTEST FAILED: uppercase domain accepted';
  exception when check_violation then null; end;

  -- b) the same pair twice for one user is rejected; another user may track the same pair
  insert into public.backlinks(user_id, source_url, source_domain, target_url)
  values (u1, 'https://src.example.org/a', 'src.example.org', 'https://me.example.org/') returning id into b1;
  begin
    insert into public.backlinks(user_id, source_url, source_domain, target_url) values (u1, 'https://src.example.org/a', 'src.example.org', 'https://me.example.org/');
    raise exception 'SELFTEST FAILED: duplicate pair for the same user accepted';
  exception when unique_violation then null; end;
  if u2 is not null then
    insert into public.backlinks(user_id, source_url, source_domain, target_url) values (u2, 'https://src.example.org/a', 'src.example.org', 'https://me.example.org/');
  end if;

  -- c) history rows: bad status and over-long evidence are rejected; rows are removed with the backlink
  begin
    insert into public.backlink_checks(backlink_id, status) values (b1, 'unchecked');
    raise exception 'SELFTEST FAILED: history row with status unchecked accepted';
  exception when check_violation then null; end;
  begin
    insert into public.backlink_checks(backlink_id, status, evidence) values (b1, 'active', repeat('x', 601));
    raise exception 'SELFTEST FAILED: over-long evidence accepted';
  exception when check_violation then null; end;
  insert into public.backlink_checks(backlink_id, status, trigger, http_status) values (b1, 'active', 'scheduled', 200);

  -- d) project link: own project OK; someone else's project rejected; deleting the project keeps the backlink
  insert into public.projects(user_id, name, canonical_url, domain) values (u1, 'Selftest13', 'https://me.example.org/', 'me.example.org') returning id into p1;
  update public.backlinks set project_id = p1 where id = b1;
  if u2 is not null then
    insert into public.projects(user_id, name, canonical_url, domain) values (u2, 'Other13', 'https://me.example.org/', 'me.example.org') returning id into p2;
    begin
      update public.backlinks set project_id = p2 where id = b1;
      raise exception 'SELFTEST FAILED: backlink accepted another user''s project';
    exception when check_violation then null; end;
  end if;
  delete from public.projects where id = p1;
  select count(*) into n from public.backlinks where id = b1 and project_id is null;
  if n <> 1 then raise exception 'SELFTEST FAILED: backlink lost or project_id not cleared when the project was deleted'; end if;

  delete from public.backlinks where id = b1;
  select count(*) into n from public.backlink_checks where backlink_id = b1;
  if n <> 0 then raise exception 'SELFTEST FAILED: history survived backlink delete'; end if;

  raise exception 'SELFTEST PASSED: backlink rules, history rules and the project-owner check all behave (nothing was saved)';
end $$;
