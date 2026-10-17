-- =====================================================================
-- 039_batch12_verify_and_selftest.sql  (Batch 12) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and send me the results
-- (or just tell me "the result is what you expected" when everything matches).
-- Nothing here is saved: V1-V4 only read; S1 changes things and then
-- raises an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: both tables exist with RLS on. Expect 2 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('projects','project_keywords')
order by 1;

-- V2: policies. Expect exactly 2 rows: project_keywords / project_keywords_select and projects / projects_select.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('projects','project_keywords')
order by 1, 2;

-- V3: grants for anon/authenticated. Expect ONLY: authenticated SELECT on project_keywords and on projects. Nothing for anon.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('projects','project_keywords')
  and grantee in ('anon','authenticated')
order by 1, 2, 3;

-- V4: the new short_links column and the owner-check trigger. Expect: column_exists = 1, trigger_enabled = 1.
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'short_links' and column_name = 'project_id') as column_exists,
  (select count(*) from pg_trigger
    where tgname = 'short_links_project_owner' and not tgisinternal and tgenabled = 'O') as trigger_enabled;

-- S1: self-test (needs at least 1 row in auth.users; 2 users test the cross-user rules).
-- It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare
  u1 uuid; u2 uuid; p1 uuid; p2 uuid; l1 uuid; n int;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null then raise exception 'SELFTEST FAILED: no users found'; end if;

  -- a) format rules
  begin
    insert into public.projects(user_id, name, canonical_url, domain, country) values (u1, 'T', 'https://selftest.example.org/', 'selftest.example.org', 'usa');
    raise exception 'SELFTEST FAILED: bad country accepted';
  exception when check_violation then null; end;
  begin
    insert into public.projects(user_id, name, canonical_url, domain, language) values (u1, 'T', 'https://selftest.example.org/', 'selftest.example.org', 'EN');
    raise exception 'SELFTEST FAILED: bad language accepted';
  exception when check_violation then null; end;
  begin
    insert into public.projects(user_id, name, canonical_url, domain) values (u1, 'T', 'https://selftest.example.org/', 'SelfTest.Example.org');
    raise exception 'SELFTEST FAILED: uppercase domain accepted';
  exception when check_violation then null; end;
  begin
    insert into public.projects(user_id, name, canonical_url, domain, competitors)
    values (u1, 'T', 'https://selftest.example.org/', 'selftest.example.org', array['a1.com','a2.com','a3.com','a4.com','a5.com','a6.com','a7.com','a8.com','a9.com','a10.com','a11.com']);
    raise exception 'SELFTEST FAILED: 11 competitors accepted';
  exception when check_violation then null; end;

  -- b) one project per domain per user; another user may use the same domain
  insert into public.projects(user_id, name, canonical_url, domain, country, language)
  values (u1, 'Selftest', 'https://selftest.example.org/', 'selftest.example.org', 'US', 'pt-BR') returning id into p1;
  begin
    insert into public.projects(user_id, name, canonical_url, domain) values (u1, 'Dup', 'https://www.selftest.example.org/', 'selftest.example.org');
    raise exception 'SELFTEST FAILED: duplicate domain for the same user accepted';
  exception when unique_violation then null; end;
  if u2 is not null then
    insert into public.projects(user_id, name, canonical_url, domain) values (u2, 'Other', 'https://selftest.example.org/', 'selftest.example.org') returning id into p2;
  end if;

  -- c) keywords: unique ignoring case, minimum length, removed together with the project
  insert into public.project_keywords(project_id, keyword) values (p1, 'Link Building');
  begin
    insert into public.project_keywords(project_id, keyword) values (p1, 'link building');
    raise exception 'SELFTEST FAILED: duplicate keyword (different case) accepted';
  exception when unique_violation then null; end;
  begin
    insert into public.project_keywords(project_id, keyword) values (p1, 'x');
    raise exception 'SELFTEST FAILED: 1-character keyword accepted';
  exception when check_violation then null; end;

  -- d) short links: own project OK; someone else's project rejected; deleting the project keeps the link
  insert into public.short_links(user_id, slug, destination_url, project_id)
  values (u1, 'selftest-p12-a', 'https://selftest.example.org/x', p1) returning id into l1;
  if p2 is not null then
    begin
      update public.short_links set project_id = p2 where id = l1;
      raise exception 'SELFTEST FAILED: link accepted another user''s project';
    exception when check_violation then null; end;
  end if;
  delete from public.projects where id = p1;
  select count(*) into n from public.project_keywords where project_id = p1;
  if n <> 0 then raise exception 'SELFTEST FAILED: keywords survived project delete'; end if;
  select count(*) into n from public.short_links where id = l1 and project_id is null;
  if n <> 1 then raise exception 'SELFTEST FAILED: link lost or project_id not cleared when the project was deleted'; end if;

  raise exception 'SELFTEST PASSED: project rules, keyword rules and the link-owner check all behave (nothing was saved)';
end $$;
