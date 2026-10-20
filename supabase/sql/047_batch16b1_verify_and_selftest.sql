-- =====================================================================
-- 047_batch16b1_verify_and_selftest.sql  (Batch 16B-1) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing is saved: V1-V4 only read; S1 ends with an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: 3 tables, all with RLS on. Expect 3 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('outreach_contacts','outreach_imports','outreach_suppressions')
order by 1;

-- V2: policies. Expect 3 rows, all SELECT.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('outreach_contacts','outreach_imports','outreach_suppressions')
order by 1;

-- V3: grants for anon/authenticated. Expect exactly 3 rows: authenticated SELECT on each table. Nothing for anon.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('outreach_contacts','outreach_imports','outreach_suppressions') and grantee in ('anon','authenticated')
order by 1, 2, 3;

-- V4: triggers. Expect trigger_enabled = 2.
select count(*) as trigger_enabled
from pg_trigger
where tgname in ('outreach_contacts_enforce_suppression','outreach_suppression_apply') and not tgisinternal and tgenabled = 'O';

-- S1: self-test (no users needed). It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare s text; n int;
begin
  -- a) format rules
  begin insert into public.outreach_contacts(email,email_domain,source) values ('Upper@Example.org','example.org','other'); raise exception 'SELFTEST FAILED: uppercase email accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_contacts(email,email_domain,source) values ('a@b.org','b.org','nope'); raise exception 'SELFTEST FAILED: bad source accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_contacts(email,email_domain,source,status) values ('held@b.org','b.org','other','held'); raise exception 'SELFTEST FAILED: held without reason accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_contacts(email,email_domain,source,country) values ('c@b.org','b.org','other','Germany'); raise exception 'SELFTEST FAILED: bad country accepted';
  exception when check_violation then null; end;

  -- b) a normal contact, and the unique email
  insert into public.outreach_contacts(email,email_domain,source) values ('one@selftest-outreach.org','selftest-outreach.org','past_customers');
  begin insert into public.outreach_contacts(email,email_domain,source) values ('one@selftest-outreach.org','selftest-outreach.org','other'); raise exception 'SELFTEST FAILED: duplicate email accepted';
  exception when unique_violation then null; end;

  -- c) adding to the do-not-email list moves the existing contact out of active
  insert into public.outreach_suppressions(email,reason) values ('one@selftest-outreach.org','unsubscribe');
  select status into s from public.outreach_contacts where email = 'one@selftest-outreach.org';
  if s <> 'unsubscribed' then raise exception 'SELFTEST FAILED: suppression did not apply (status=%)', s; end if;

  -- d) a NEW contact with a suppressed address cannot be active, whoever inserts it
  insert into public.outreach_suppressions(email,reason) values ('two@selftest-outreach.org','bounce');
  insert into public.outreach_contacts(email,email_domain,source,status) values ('two@selftest-outreach.org','selftest-outreach.org','other','active');
  select status into s from public.outreach_contacts where email = 'two@selftest-outreach.org';
  if s <> 'bounced' then raise exception 'SELFTEST FAILED: suppressed address was inserted as % ', s; end if;

  -- e) re-activating a suppressed contact by hand is undone by the database
  update public.outreach_contacts set status = 'active' where email = 'one@selftest-outreach.org';
  select status into s from public.outreach_contacts where email = 'one@selftest-outreach.org';
  if s <> 'unsubscribed' then raise exception 'SELFTEST FAILED: unsubscribed contact was re-activated (status=%)', s; end if;

  -- f) manual suppression -> blocked
  insert into public.outreach_contacts(email,email_domain,source) values ('three@selftest-outreach.org','selftest-outreach.org','other');
  insert into public.outreach_suppressions(email,reason) values ('three@selftest-outreach.org','manual');
  select status into s from public.outreach_contacts where email = 'three@selftest-outreach.org';
  if s <> 'blocked' then raise exception 'SELFTEST FAILED: manual suppression gave status %', s; end if;

  -- g) a clean address stays active
  insert into public.outreach_contacts(email,email_domain,source) values ('four@selftest-outreach.org','selftest-outreach.org','opted_in');
  select count(*) into n from public.outreach_contacts where email = 'four@selftest-outreach.org' and status = 'active';
  if n <> 1 then raise exception 'SELFTEST FAILED: clean contact was not active'; end if;

  raise exception 'SELFTEST PASSED: outreach rules hold (nothing was saved)';
end $$;
