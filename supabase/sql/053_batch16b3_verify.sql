-- =====================================================================
-- 053_batch16b3_verify.sql  (Batch 16B-3) — read-only checks
-- Run each block (V1, V2, V3, V4, S1) ONE AT A TIME and tell me the result
-- (or just "the result is what you expected" when everything matches).
-- Nothing is saved: V1-V4 only read; S1 ends with an error on purpose so everything is rolled back.
-- =====================================================================

-- V1: 2 new tables, RLS on. Expect 2 rows, relrowsecurity = true.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('outreach_tickets', 'outreach_ticket_messages')
order by 1;

-- V2: policies. Expect 2 rows, both SELECT.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public' and tablename in ('outreach_tickets', 'outreach_ticket_messages')
order by 1;

-- V3: table grants for anon/authenticated. Expect exactly 2 rows, both "authenticated | SELECT". Nothing for anon.
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name in ('outreach_tickets', 'outreach_ticket_messages') and grantee in ('anon', 'authenticated')
order by 1, 2, 3;

-- V4: who may run the new functions. Expect:
--   outreach_delivery_daily      | authenticated = true, anon = false
--   outreach_delivery_stats      | authenticated = true, anon = false
--   outreach_record_reply        | authenticated = false, anon = false
select p.proname,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can_run,
       has_function_privilege('anon', p.oid, 'execute') as anon_can_run
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname in ('outreach_delivery_daily', 'outreach_delivery_stats', 'outreach_record_reply')
order by 1;

-- S1: self-test of tickets and the delivery numbers. ALWAYS ends with a red error:
--   "SELFTEST PASSED: ..." = fine (nothing saved).  "SELFTEST FAILED: ..." = send me the exact message.
do $$
declare camp uuid; camp2 uuid; c1 uuid; c2 uuid; c3 uuid; s1 uuid; s2 uuid; s3 uuid; e1 uuid; e2 uuid; e3 uuid; tid uuid; tid2 uuid;
        t record; n int; r record;
begin
  insert into public.outreach_campaigns(name, sequence_id, step_id, daily_cap, status, filter_tag) values ('Selftest A', 'seqA', 'stepA', 20, 'active', 'st3') returning id into camp;
  insert into public.outreach_campaigns(name, sequence_id, step_id, daily_cap, status, filter_tag) values ('Selftest B', 'seqB', 'stepB', 20, 'active', 'st3') returning id into camp2;
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('a@selftest-t3.org','selftest-t3.org','opted_in', array['st3']) returning id into c1;
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('b@selftest-t3.org','selftest-t3.org','opted_in', array['st3']) returning id into c2;
  insert into public.outreach_contacts(email,email_domain,source,tags) values ('c@selftest-t3.org','selftest-t3.org','opted_in', array['st3']) returning id into c3;
  insert into public.outreach_sends(campaign_id, contact_id, status, pushed_at) values (camp, c1, 'replied', now() - interval '1 hour') returning id into s1;
  insert into public.outreach_sends(campaign_id, contact_id, status, pushed_at) values (camp, c2, 'bounced', now() - interval '1 hour') returning id into s2;
  insert into public.outreach_sends(campaign_id, contact_id, status, pushed_at) values (camp, c3, 'pushed', now() - interval '3 days') returning id into s3;
  insert into public.outreach_events(dedupe_key, event, email, contact_id, send_id) values ('st3-e1', 'reply-received', 'a@selftest-t3.org', c1, s1) returning id into e1;
  insert into public.outreach_events(dedupe_key, event, email, contact_id, send_id) values ('st3-e2', 'reply-received', 'a@selftest-t3.org', c1, s1) returning id into e2;
  insert into public.outreach_events(dedupe_key, event, email, contact_id, send_id) values ('st3-e3', 'reply-received', 'a@selftest-t3.org', c1, s1) returning id into e3;
  insert into public.outreach_events(dedupe_key, event, email, contact_id, send_id) values ('st3-o1', 'email-opened', 'a@selftest-t3.org', c1, s1);
  insert into public.outreach_events(dedupe_key, event, email, contact_id, send_id) values ('st3-o2', 'email-opened', 'a@selftest-t3.org', c1, s1);

  -- a) format rules
  begin insert into public.outreach_tickets(contact_id, email, status) values (c2, 'b@selftest-t3.org', 'open'); raise exception 'SELFTEST FAILED: bad ticket status accepted';
  exception when check_violation then null; end;
  begin perform public.outreach_record_reply(c2, camp, s2, 'b@selftest-t3.org', null, null, 'x', 'weird', null, now()); raise exception 'SELFTEST FAILED: bad kind accepted';
  exception when raise_exception then if sqlerrm like 'SELFTEST FAILED%' then raise; end if; end;

  -- b) the first reply opens a ticket with one message
  tid := public.outreach_record_reply(c1, camp, s1, 'a@selftest-t3.org', 'Hello', 'conv1', E'  Interested   in\nthis one  ', 'reply', e1, now() - interval '30 minutes');
  select * into t from public.outreach_tickets where id = tid;
  if t.reply_count <> 1 or t.status <> 'new' or t.kind <> 'reply' then raise exception 'SELFTEST FAILED: first reply gave count %, status %, kind %', t.reply_count, t.status, t.kind; end if;
  if t.last_reply_preview <> 'Interested in this one' then raise exception 'SELFTEST FAILED: preview was %', t.last_reply_preview; end if;

  -- c) the same webhook event again changes nothing
  tid2 := public.outreach_record_reply(c1, camp, s1, 'a@selftest-t3.org', 'Hello', 'conv1', 'x', 'reply', e1, now());
  select count(*) into n from public.outreach_ticket_messages where ticket_id = tid;
  select reply_count into r from public.outreach_tickets where id = tid;
  if tid2 <> tid or n <> 1 or r.reply_count <> 1 then raise exception 'SELFTEST FAILED: repeat event changed the ticket (messages %, count %)', n, r.reply_count; end if;

  -- d) a second reply adds a message to the SAME ticket
  perform public.outreach_record_reply(c1, camp, s1, 'a@selftest-t3.org', null, null, 'Please send prices', 'reply', e2, now() - interval '20 minutes');
  select * into t from public.outreach_tickets where id = tid;
  select count(*) into n from public.outreach_ticket_messages where ticket_id = tid;
  if t.reply_count <> 2 or n <> 2 or t.conversation_id <> 'conv1' or t.last_reply_preview <> 'Please send prices' then
    raise exception 'SELFTEST FAILED: second reply gave count %, messages %, conv %, preview %', t.reply_count, n, t.conversation_id, t.last_reply_preview;
  end if;

  -- e) an out-of-office answer never downgrades a real reply and never reopens a closed ticket
  update public.outreach_tickets set status = 'closed', closed_at = now() where id = tid;
  perform public.outreach_record_reply(c1, camp, s1, 'a@selftest-t3.org', null, null, 'I am away until Monday', 'auto_reply', null, now());
  select * into t from public.outreach_tickets where id = tid;
  if t.kind <> 'reply' or t.status <> 'closed' then raise exception 'SELFTEST FAILED: auto reply changed kind to % / status to %', t.kind, t.status; end if;

  -- f) a real reply on a closed ticket opens it again
  perform public.outreach_record_reply(c1, camp, s1, 'a@selftest-t3.org', null, null, 'Actually, yes please', 'reply', e3, now());
  select * into t from public.outreach_tickets where id = tid;
  if t.status <> 'new' or t.closed_at is not null then raise exception 'SELFTEST FAILED: closed ticket was not reopened (status %)', t.status; end if;

  -- g) the replied contact is never picked again, by ANY campaign; the others still are
  select count(*) into n from public.outreach_next_contacts(camp2, 10) where id = c1;
  if n <> 0 then raise exception 'SELFTEST FAILED: a contact who replied was picked by another campaign'; end if;
  select count(*) into n from public.outreach_next_contacts(camp2, 10);
  if n <> 3 - 1 then raise exception 'SELFTEST FAILED: expected 2 pickable contacts, got %', n; end if;

  -- h) deleting a contact removes its ticket and messages
  insert into public.outreach_contacts(email,email_domain,source) values ('d@selftest-t3.org','selftest-t3.org','other') returning id into c3;
  perform public.outreach_record_reply(c3, null, null, 'd@selftest-t3.org', null, null, 'hi', 'reply', null, now());
  delete from public.outreach_contacts where id = c3;
  select count(*) into n from public.outreach_tickets where email = 'd@selftest-t3.org';
  if n <> 0 then raise exception 'SELFTEST FAILED: ticket survived its contact'; end if;

  -- i) delivery numbers for the campaign
  select * into r from public.outreach_delivery_stats_core(30) where campaign_id = camp;
  if r.total <> 3 or r.replied <> 1 or r.bounced <> 1 or r.sent <> 2 or r.handed_over <> 3 or r.opened <> 1 or r.stuck <> 1 or r.clicked <> 0 or r.queued <> 0 or r.push_failed <> 0 then
    raise exception 'SELFTEST FAILED: delivery numbers total %, replied %, bounced %, sent %, handed %, opened % (distinct sends), stuck %', r.total, r.replied, r.bounced, r.sent, r.handed_over, r.opened, r.stuck;
  end if;
  select coalesce(sum(d.n), 0) into n from public.outreach_delivery_daily_core(14) d where d.metric = 'email-opened';
  if n < 2 then raise exception 'SELFTEST FAILED: daily open events counted %', n; end if;

  -- j) the browser-facing versions refuse a caller who is not an admin (this editor is not a logged-in admin)
  begin perform public.outreach_delivery_stats(30); raise exception 'SELFTEST FAILED: delivery_stats ran without an admin';
  exception when insufficient_privilege then null; end;

  raise exception 'SELFTEST PASSED: tickets, replies and delivery numbers behave (nothing was saved)';
end $$;
