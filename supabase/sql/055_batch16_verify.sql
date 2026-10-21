-- =====================================================================
-- 055_batch16_verify.sql  (Batch 16) — read-only checks
-- Run each block (V1, V2, V3, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing is saved: V1-V3 only read; S1 ends with an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: 3 new tables, RLS on. Expect 3 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('opportunities', 'opportunity_runs', 'search_cache')
order by 1;

-- V2: policies. Expect 2 rows (opportunities_select, opportunity_runs_select), both SELECT. search_cache has none on purpose.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('opportunities', 'opportunity_runs', 'search_cache')
order by 1;

-- V3: grants for anon/authenticated. Expect exactly 2 rows: opportunities | authenticated | SELECT and opportunity_runs | authenticated | SELECT.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('opportunities', 'opportunity_runs', 'search_cache') and grantee in ('anon', 'authenticated')
order by 1, 2, 3;

-- S1: self-test. ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..." = fine (nothing saved).  "SELFTEST FAILED: ..." = send me the exact message.
do $$
declare u1 uuid; u2 uuid; p1 uuid; p2 uuid; n int;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null then raise exception 'SELFTEST FAILED: no user exists to test with'; end if;
  insert into public.projects(user_id, name, canonical_url, domain) values (u1, 'Selftest P1', 'https://selftest-p1.example', 'selftest-p1.example') returning id into p1;

  -- a) a normal row; the same website + kind cannot be stored twice, a different kind can
  insert into public.opportunities(user_id, project_id, opp_type, url, domain, score) values (u1, p1, 'guest_post', 'https://blog.example/write-for-us', 'blog.example', 80);
  begin insert into public.opportunities(user_id, project_id, opp_type, url, domain, score) values (u1, p1, 'guest_post', 'https://blog.example/other', 'blog.example', 50);
    raise exception 'SELFTEST FAILED: duplicate website+type accepted';
  exception when unique_violation then null; end;
  insert into public.opportunities(user_id, project_id, opp_type, url, domain, score) values (u1, p1, 'directory', 'https://blog.example/submit', 'blog.example', 40);

  -- b) format rules
  begin insert into public.opportunities(user_id, project_id, opp_type, url, domain) values (u1, p1, 'weird', 'https://x.example/a', 'x.example'); raise exception 'SELFTEST FAILED: bad type accepted';
  exception when check_violation then null; end;
  begin insert into public.opportunities(user_id, project_id, opp_type, url, domain, score) values (u1, p1, 'directory', 'https://y.example/a', 'y.example', 101); raise exception 'SELFTEST FAILED: score 101 accepted';
  exception when check_violation then null; end;
  begin insert into public.opportunities(user_id, project_id, opp_type, url, domain, status) values (u1, p1, 'directory', 'https://z.example/a', 'z.example', 'won'); raise exception 'SELFTEST FAILED: bad status accepted';
  exception when check_violation then null; end;
  begin insert into public.opportunities(user_id, project_id, opp_type, url, domain) values (u1, p1, 'directory', 'https://Up.example/a', 'Up.example'); raise exception 'SELFTEST FAILED: upper-case domain accepted';
  exception when check_violation then null; end;

  -- c) someone else's project is refused
  if u2 is not null then
    begin insert into public.opportunities(user_id, project_id, opp_type, url, domain) values (u2, p1, 'directory', 'https://w.example/a', 'w.example'); raise exception 'SELFTEST FAILED: opportunity accepted on another user''s project';
    exception when check_violation then null; end;
  end if;

  -- d) deleting the project removes its opportunities; run history stays but loses the project link
  insert into public.opportunity_runs(user_id, project_id, types, queries, hits, added) values (u1, p1, array['guest_post'], 3, 20, 2);
  delete from public.projects where id = p1;
  select count(*) into n from public.opportunities where project_id = p1;
  if n <> 0 then raise exception 'SELFTEST FAILED: opportunities survived their project'; end if;
  select count(*) into n from public.opportunity_runs where user_id = u1 and project_id is null and queries = 3 and hits = 20;
  if n < 1 then raise exception 'SELFTEST FAILED: run history was not kept'; end if;

  -- e) cache table works and refuses silly keys
  insert into public.search_cache(cache_key, results) values ('0123456789abcdef0123', '[]'::jsonb);
  begin insert into public.search_cache(cache_key, results) values ('short', '[]'::jsonb); raise exception 'SELFTEST FAILED: short cache key accepted';
  exception when check_violation then null; end;

  raise exception 'SELFTEST PASSED: opportunities, runs and cache behave (nothing was saved)';
end $$;
