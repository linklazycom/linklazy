-- =====================================================================
-- 045_batch15_verify_and_selftest.sql  (Batch 15) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing here is saved: V1-V4 only read; S1 changes things and then
-- raises an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: the table exists with RLS on. Expect 1 row, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'content_documents';

-- V2: policies. Expect exactly 1 row: content_documents / content_documents_select / SELECT.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'content_documents';

-- V3: grants for anon/authenticated. Expect ONLY: authenticated SELECT. Nothing for anon.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'content_documents' and grantee in ('anon','authenticated')
order by 2, 3;

-- V4: the owner-check trigger. Expect trigger_enabled = 1.
select count(*) as trigger_enabled
from pg_trigger
where tgname = 'content_documents_project_owner' and not tgisinternal and tgenabled = 'O';

-- S1: self-test (needs at least 1 row in auth.users; 2 users test the cross-user rule).
-- It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare
  u1 uuid; u2 uuid; p2 uuid; d1 uuid; n int;
begin
  select id into u1 from auth.users order by created_at limit 1;
  select id into u2 from auth.users where id <> u1 order by created_at limit 1;
  if u1 is null then raise exception 'SELFTEST FAILED: no users found'; end if;

  -- a) format rules
  begin
    insert into public.content_documents(user_id, kind, title, body) values (u1, 'not_a_kind', 'T', 'b');
    raise exception 'SELFTEST FAILED: bad kind accepted';
  exception when check_violation then null; end;
  begin
    insert into public.content_documents(user_id, kind, title, body) values (u1, 'bio', '', 'b');
    raise exception 'SELFTEST FAILED: empty title accepted';
  exception when check_violation then null; end;
  begin
    insert into public.content_documents(user_id, kind, title, body) values (u1, 'bio', 'T', '');
    raise exception 'SELFTEST FAILED: empty body accepted';
  exception when check_violation then null; end;
  begin
    insert into public.content_documents(user_id, kind, title, body) values (u1, 'bio', 'T', repeat('x', 60001));
    raise exception 'SELFTEST FAILED: oversized body accepted';
  exception when check_violation then null; end;

  -- b) a normal row works
  insert into public.content_documents(user_id, kind, title, body) values (u1, 'article_draft', 'Selftest', 'Hello') returning id into d1;

  -- c) a project of ANOTHER user is refused
  if u2 is not null then
    insert into public.projects(user_id, name, canonical_url, domain) values (u2, 'Other', 'https://selftest-docs.example.org/', 'selftest-docs.example.org') returning id into p2;
    begin
      update public.content_documents set project_id = p2 where id = d1;
      raise exception 'SELFTEST FAILED: document pointed at another user''s project';
    exception when check_violation then null; end;
  end if;

  -- d) deleting the user's document leaves nothing behind
  delete from public.content_documents where id = d1;
  select count(*) into n from public.content_documents where id = d1;
  if n <> 0 then raise exception 'SELFTEST FAILED: delete did not remove the row'; end if;

  raise exception 'SELFTEST PASSED: content_documents rules hold (nothing was saved)';
end $$;
