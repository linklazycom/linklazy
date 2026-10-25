-- =====================================================================
-- 058_batch18_verify.sql  (Batch 18) — read-only checks
-- Run each block (V1, V2, V3, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing is saved: V1-V3 only read; S1 ends with an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: table exists, RLS on. Expect 1 row, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'testimonials';

-- V2: policies. Expect 2 rows (testimonials_admin_select, testimonials_public_select), both SELECT.
select policyname, cmd, roles from pg_policies where schemaname = 'public' and tablename = 'testimonials' order by 1;

-- V3: grants. Expect 2 rows: anon | SELECT and authenticated | SELECT. Nothing else (no insert/update/delete).
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'testimonials' and grantee in ('anon', 'authenticated')
order by 1, 2;

-- S1: self-test. ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..." = fine (nothing saved).  "SELFTEST FAILED: ..." = send me the exact message.
do $$
declare t1 uuid; n int;
begin
  -- a) an unpublished testimonial without consent is fine
  insert into public.testimonials(author_name, quote) values ('Selftest A', 'A real sentence that is long enough.') returning id into t1;
  -- b) publishing without consent is refused by the database itself
  begin update public.testimonials set is_published = true where id = t1; raise exception 'SELFTEST FAILED: published without consent';
  exception when check_violation then null; end;
  begin insert into public.testimonials(author_name, quote, is_published) values ('Selftest B', 'Another long enough sentence.', true); raise exception 'SELFTEST FAILED: inserted as published without consent';
  exception when check_violation then null; end;
  -- c) with consent it can be published
  update public.testimonials set consent_confirmed = true, is_published = true where id = t1;
  select count(*) into n from public.testimonials where is_published;
  if n < 1 then raise exception 'SELFTEST FAILED: could not publish with consent'; end if;
  -- d) withdrawing consent while published is refused
  begin update public.testimonials set consent_confirmed = false where id = t1; raise exception 'SELFTEST FAILED: consent withdrawn while still published';
  exception when check_violation then null; end;
  -- e) length rules
  begin insert into public.testimonials(author_name, quote) values ('', 'A real sentence that is long enough.'); raise exception 'SELFTEST FAILED: empty name accepted';
  exception when check_violation then null; end;
  begin insert into public.testimonials(author_name, quote) values ('Short', 'too short'); raise exception 'SELFTEST FAILED: too-short quote accepted';
  exception when check_violation then null; end;
  begin insert into public.testimonials(author_name, quote) values ('Long', repeat('x', 601)); raise exception 'SELFTEST FAILED: 601-character quote accepted';
  exception when check_violation then null; end;
  raise exception 'SELFTEST PASSED: testimonials need permission before they can be published (nothing was saved)';
end $$;
