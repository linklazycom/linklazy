-- =====================================================================
-- 049_batch16b2_verify_and_selftest.sql  (Batch 16B-2) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing is saved: V1-V4 only read; S1 ends with an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: 4 tables, all with RLS on. Expect 4 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('outreach_connection','outreach_campaigns','outreach_sends','outreach_events')
order by 1;

-- V2: policies. Expect 4 rows, all SELECT.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('outreach_connection','outreach_campaigns','outreach_sends','outreach_events')
order by 1;

-- V3: table-level grants for anon/authenticated. Expect exactly 3 rows: authenticated SELECT on campaigns, events, sends.
-- (outreach_connection has column-level grants only, so it is NOT listed here; nothing for anon.)
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('outreach_connection','outreach_campaigns','outreach_sends','outreach_events') and grantee in ('anon','authenticated')
order by 1, 2, 3;

-- V4: the secret columns must NOT be readable by the browser role. Expect ZERO rows.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema = 'public' and table_name = 'outreach_connection' and grantee in ('anon','authenticated')
  and column_name in ('api_key_encrypted','webhook_secret');

-- S1: self-test (no users needed). It ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..."  = everything is fine (nothing saved).
--   "SELFTEST FAILED: ..."  = send me the exact message.
do $$
declare camp uuid; c_ok uuid; c_held uuid; c_other uuid; n int; r record;
begin
  -- a) format rules
  begin insert into public.outreach_connection(id, webhook_secret) values (2, repeat('a', 30)); raise exception 'SELFTEST FAILED: second connection row accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_connection(id, webhook_secret) values (1, 'short'); raise exception 'SELFTEST FAILED: short webhook secret accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_campaigns(name, sequence_id, step_id, daily_cap) values ('x', 'bad id!', 'abc', 20); raise exception 'SELFTEST FAILED: bad sequence id accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_campaigns(name, sequence_id, step_id, daily_cap) values ('x', 'seq1', 'abc', 500); raise exception 'SELFTEST FAILED: cap 500 accepted';
  exception when check_violation then null; end;
  begin insert into public.outreach_campaigns(name, sequence_id, step_id, daily_cap, status) values ('x', 'seq1', 'abc', 20, 'running'); raise exception 'SELFTEST FAILED: bad status accepted';
  exception when check_violation then null; end;

  -- b) a campaign and four contacts: active+tagged, held, active-but-suppressed, active-other-tag
  insert into public.outreach_campaigns(name, sequence_id, step_id, daily_cap, status, filter_tag)
    values ('Selftest', 'seq1', 'step1', 20, 'active', 'selftest-tag') returning id into camp;
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('ok@selftest-sh.org','selftest-sh.org','opted_in', array['selftest-tag']) returning id into c_ok;
  insert into public.outreach_contacts(email,email_domain,source,status,hold_reason,tags) values ('held@selftest-sh.org','selftest-sh.org','opted_in','held','manual', array['selftest-tag']) returning id into c_held;
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('other@selftest-sh.org','selftest-sh.org','opted_in', array['different']) returning id into c_other;
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('stop@selftest-sh.org','selftest-sh.org','opted_in', array['selftest-tag']);
  insert into public.outreach_suppressions(email, reason) values ('stop@selftest-sh.org', 'unsubscribe');

  -- c) only the active, tagged, not-suppressed contact is picked
  select count(*) into n from public.outreach_next_contacts(camp, 10);
  if n <> 1 then raise exception 'SELFTEST FAILED: expected 1 eligible contact, got %', n; end if;
  select * into r from public.outreach_next_contacts(camp, 10);
  if r.id <> c_ok then raise exception 'SELFTEST FAILED: wrong contact picked'; end if;

  -- d) once given to the campaign, the contact is never picked again; one row per contact per campaign
  insert into public.outreach_sends(campaign_id, contact_id, status) values (camp, c_ok, 'queued');
  select count(*) into n from public.outreach_next_contacts(camp, 10);
  if n <> 0 then raise exception 'SELFTEST FAILED: contact was picked twice'; end if;
  begin insert into public.outreach_sends(campaign_id, contact_id) values (camp, c_ok); raise exception 'SELFTEST FAILED: duplicate send accepted';
  exception when unique_violation then null; end;

  -- e) a contact that is suppressed AFTER being eligible is no longer picked (status changes via the 046 trigger)
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('late@selftest-sh.org','selftest-sh.org','opted_in', array['selftest-tag']);
  select count(*) into n from public.outreach_next_contacts(camp, 10);
  if n <> 1 then raise exception 'SELFTEST FAILED: expected the new contact, got %', n; end if;
  insert into public.outreach_suppressions(email, reason) values ('late@selftest-sh.org', 'bounce');
  select count(*) into n from public.outreach_next_contacts(camp, 10);
  if n <> 0 then raise exception 'SELFTEST FAILED: suppressed contact still picked'; end if;

  -- f) events: bad event name refused; the same event twice is refused (webhook retries are harmless)
  begin insert into public.outreach_events(dedupe_key, event, email) values ('k1', 'email-exploded', 'a@b.org'); raise exception 'SELFTEST FAILED: bad event accepted';
  exception when check_violation then null; end;
  insert into public.outreach_events(dedupe_key, event, email) values ('k2', 'reply-received', 'a@b.org');
  begin insert into public.outreach_events(dedupe_key, event, email) values ('k2', 'reply-received', 'a@b.org'); raise exception 'SELFTEST FAILED: duplicate event accepted';
  exception when unique_violation then null; end;

  -- g) deleting a campaign removes its sends, not the contacts
  delete from public.outreach_campaigns where id = camp;
  select count(*) into n from public.outreach_sends where campaign_id = camp;
  if n <> 0 then raise exception 'SELFTEST FAILED: sends were not removed with the campaign'; end if;
  select count(*) into n from public.outreach_contacts where id = c_ok;
  if n <> 1 then raise exception 'SELFTEST FAILED: contact was deleted with the campaign'; end if;

  raise exception 'SELFTEST PASSED: campaign rules hold (nothing was saved)';
end $$;
