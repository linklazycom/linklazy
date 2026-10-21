-- =====================================================================
-- 052_batch16b3_reply_tickets_and_delivery.sql  (Batch 16B-3)  — additive only
-- PREREQUISITE: 050_batch16_outreach_all_in_one.sql was run (outreach_contacts / campaigns / sends / events exist).
-- Creates: outreach_tickets, outreach_ticket_messages, function outreach_record_reply(),
--          delivery-report functions outreach_delivery_stats() and outreach_delivery_daily() (admin-only).
-- Changes: function outreach_next_contacts() — a contact who replied (has a ticket) is never picked again by ANY campaign.
-- Safe to run twice. Sends nothing. Does NOT touch any existing table or row.
--
-- PRE-CHECK (run first; expect a = true, b..d = NULL):
--   select to_regclass('public.outreach_sends') is not null as a, to_regclass('public.outreach_tickets') b,
--          to_regclass('public.outreach_ticket_messages') c, to_regprocedure('public.outreach_record_reply(uuid,uuid,uuid,text,text,text,text,text,uuid,timestamptz)') d;
--
-- ORDER: run this file FIRST, then 053_batch16b3_verify.sql, then deploy the batch16b3 code.
--
-- ROLLBACK (tickets and their notes are lost; contacts, sends and events are NOT touched):
--   drop function if exists public.outreach_delivery_daily(integer);
--   drop function if exists public.outreach_delivery_stats(integer);
--   drop function if exists public.outreach_delivery_daily_core(integer);
--   drop function if exists public.outreach_delivery_stats_core(integer);
--   drop function if exists public.outreach_record_reply(uuid, uuid, uuid, text, text, text, text, text, uuid, timestamptz);
--   drop table if exists public.outreach_ticket_messages;
--   drop table if exists public.outreach_tickets;
--   -- then put the previous picker back by re-running the "create or replace function public.outreach_next_contacts" block of file 050.
-- =====================================================================

-- ---------- tickets: one per contact who replied ----------
create table if not exists public.outreach_tickets (
  id                 uuid primary key default gen_random_uuid(),
  contact_id         uuid not null references public.outreach_contacts(id) on delete cascade,
  campaign_id        uuid references public.outreach_campaigns(id) on delete set null,
  send_id            uuid references public.outreach_sends(id) on delete set null,
  email              text not null,
  subject            text,
  conversation_id    text,
  status             text not null default 'new',
  kind               text not null default 'reply',
  reply_count        integer not null default 0,
  last_reply_at      timestamptz,
  last_reply_preview text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  closed_at          timestamptz,
  constraint outreach_tickets_one_per_contact unique (contact_id),
  constraint outreach_tickets_status check (status in ('new','followup','interested','order','closed')),
  constraint outreach_tickets_kind   check (kind in ('reply','auto_reply','no_thanks')),
  constraint outreach_tickets_email  check (char_length(email) between 3 and 254),
  constraint outreach_tickets_count  check (reply_count >= 0)
);
create index if not exists outreach_tickets_status_idx on public.outreach_tickets (status, last_reply_at desc nulls last);
create index if not exists outreach_tickets_campaign_idx on public.outreach_tickets (campaign_id) where campaign_id is not null;

-- ---------- messages on a ticket: the contact's replies (from the webhook) and your own notes ----------
create table if not exists public.outreach_ticket_messages (
  id          uuid primary key default gen_random_uuid(),
  ticket_id   uuid not null references public.outreach_tickets(id) on delete cascade,
  kind        text not null,
  body        text not null default '',
  event_id    uuid references public.outreach_events(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint outreach_ticket_messages_kind check (kind in ('reply','note')),
  constraint outreach_ticket_messages_body check (char_length(body) <= 5000)
);
create index if not exists outreach_ticket_messages_ticket_idx on public.outreach_ticket_messages (ticket_id, created_at);
-- A webhook event can become a message only once (a repeat delivery is ignored).
create unique index if not exists outreach_ticket_messages_event_uq on public.outreach_ticket_messages (event_id) where event_id is not null;

-- ---------- records one reply: finds or opens the contact's ticket and adds the message, in one step ----------
create or replace function public.outreach_record_reply(
  p_contact uuid, p_campaign uuid, p_send uuid, p_email text, p_subject text, p_conversation text,
  p_text text, p_kind text, p_event uuid, p_at timestamptz
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  tid uuid;
  at_time timestamptz := coalesce(p_at, now());
  preview text := nullif(left(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')), 200), '');
begin
  if p_kind is null or p_kind not in ('reply', 'auto_reply', 'no_thanks') then
    raise exception 'outreach_record_reply: bad kind %', p_kind;
  end if;

  -- The same webhook event again: nothing changes.
  if p_event is not null then
    select m.ticket_id into tid from public.outreach_ticket_messages m where m.event_id = p_event;
    if found then return tid; end if;
  end if;

  insert into public.outreach_tickets as t
    (contact_id, campaign_id, send_id, email, subject, conversation_id, kind, reply_count, last_reply_at, last_reply_preview)
  values
    (p_contact, p_campaign, p_send, left(p_email, 254), left(p_subject, 200), left(p_conversation, 60), p_kind, 1, at_time, preview)
  on conflict (contact_id) do update set
    reply_count        = t.reply_count + 1,
    conversation_id    = coalesce(excluded.conversation_id, t.conversation_id),
    subject            = coalesce(excluded.subject, t.subject),
    -- an automatic answer (out of office) never downgrades a real reply
    kind               = case when excluded.kind = 'auto_reply' then t.kind else excluded.kind end,
    -- a real reply on a closed ticket opens it again
    status             = case when t.status = 'closed' and excluded.kind <> 'auto_reply' then 'new' else t.status end,
    closed_at          = case when t.status = 'closed' and excluded.kind <> 'auto_reply' then null else t.closed_at end,
    last_reply_preview = case when excluded.last_reply_at >= coalesce(t.last_reply_at, '-infinity'::timestamptz) then excluded.last_reply_preview else t.last_reply_preview end,
    last_reply_at      = greatest(coalesce(t.last_reply_at, excluded.last_reply_at), excluded.last_reply_at),
    updated_at         = now()
  returning t.id into tid;

  insert into public.outreach_ticket_messages (ticket_id, kind, body, event_id, created_at)
  values (tid, 'reply', left(coalesce(p_text, ''), 5000), p_event, at_time);

  return tid;
end $$;
revoke all on function public.outreach_record_reply(uuid, uuid, uuid, text, text, text, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.outreach_record_reply(uuid, uuid, uuid, text, text, text, text, text, uuid, timestamptz) to service_role;

-- ---------- who is mailed next: same rules as before, plus "never someone who already replied" ----------
create or replace function public.outreach_next_contacts(p_campaign uuid, p_limit integer)
returns table (id uuid, email text, full_name text, company text, website text, country text, tags text[])
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id, c.email, c.full_name, c.company, c.website, c.country, c.tags
  from public.outreach_campaigns k
  join public.outreach_contacts c on c.status = 'active'
  where k.id = p_campaign
    and (k.filter_tag is null or k.filter_tag = any (c.tags))
    and (k.filter_country is null or c.country = k.filter_country)
    and (k.filter_source is null or c.source = k.filter_source)
    and not exists (select 1 from public.outreach_suppressions s where s.email = c.email)
    and not exists (select 1 from public.outreach_sends x where x.campaign_id = k.id and x.contact_id = c.id)
    and not exists (select 1 from public.outreach_tickets t where t.contact_id = c.id)
  order by c.created_at asc, c.id asc
  limit greatest(0, least(coalesce(p_limit, 0), 500))
$$;
revoke all on function public.outreach_next_contacts(uuid, integer) from public, anon, authenticated;
grant execute on function public.outreach_next_contacts(uuid, integer) to service_role;

-- ---------- delivery report ----------
-- One row per campaign that has sends in the window. "sent" = Saleshandy confirmed the email went out (any later status counts too).
-- "stuck" = handed to Saleshandy more than 2 days ago and still no "sent" confirmation (webhook missing, or Saleshandy not sending).
create or replace function public.outreach_delivery_stats_core(p_days integer)
returns table (campaign_id uuid, campaign_name text, total bigint, queued bigint, push_failed bigint, handed_over bigint, sent bigint,
               bounced bigint, replied bigint, unsubscribed bigint, opened bigint, clicked bigint, stuck bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with win as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as since)
  select
    s.campaign_id,
    coalesce(k.name, '(deleted campaign)'),
    count(*),
    count(*) filter (where s.status = 'queued'),
    count(*) filter (where s.status = 'push_failed'),
    count(*) filter (where s.status not in ('queued', 'push_failed')),
    count(*) filter (where s.status in ('sent', 'finished', 'replied', 'unsubscribed', 'bounced')),
    count(*) filter (where s.status = 'bounced'),
    count(*) filter (where s.status = 'replied'),
    count(*) filter (where s.status = 'unsubscribed'),
    count(*) filter (where exists (select 1 from public.outreach_events e where e.send_id = s.id and e.event = 'email-opened')),
    count(*) filter (where exists (select 1 from public.outreach_events e where e.send_id = s.id and e.event = 'email-link-clicked')),
    count(*) filter (where s.status = 'pushed' and s.pushed_at < now() - interval '2 days')
  from public.outreach_sends s
  left join public.outreach_campaigns k on k.id = s.campaign_id
  where s.created_at >= (select since from win)
  group by s.campaign_id, k.name
  order by 3 desc
$$;
revoke all on function public.outreach_delivery_stats_core(integer) from public, anon, authenticated;

create or replace function public.outreach_delivery_stats(p_days integer default 30)
returns table (campaign_id uuid, campaign_name text, total bigint, queued bigint, push_failed bigint, handed_over bigint, sent bigint,
               bounced bigint, replied bigint, unsubscribed bigint, opened bigint, clicked bigint, stuck bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select * from public.outreach_delivery_stats_core(p_days);
end $$;
revoke all on function public.outreach_delivery_stats(integer) from public, anon;
grant execute on function public.outreach_delivery_stats(integer) to authenticated;

-- Per day (UTC): how many were handed over and how many webhook events of each kind arrived.
create or replace function public.outreach_delivery_daily_core(p_days integer)
returns table (day date, metric text, n bigint)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with win as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 14), 90))) as since)
  select (s.pushed_at at time zone 'UTC')::date, 'pushed'::text, count(*)
  from public.outreach_sends s
  where s.pushed_at >= (select since from win)
  group by 1
  union all
  select (coalesce(e.occurred_at, e.created_at) at time zone 'UTC')::date, e.event, count(*)
  from public.outreach_events e
  where coalesce(e.occurred_at, e.created_at) >= (select since from win)
  group by 1, 2
$$;
revoke all on function public.outreach_delivery_daily_core(integer) from public, anon, authenticated;

create or replace function public.outreach_delivery_daily(p_days integer default 14)
returns table (day date, metric text, n bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select * from public.outreach_delivery_daily_core(p_days);
end $$;
revoke all on function public.outreach_delivery_daily(integer) from public, anon;
grant execute on function public.outreach_delivery_daily(integer) to authenticated;

-- ---------- Row Level Security: admins only ----------
alter table public.outreach_tickets         enable row level security;
alter table public.outreach_ticket_messages enable row level security;

drop policy if exists outreach_tickets_select on public.outreach_tickets;
create policy outreach_tickets_select on public.outreach_tickets for select to authenticated using (public.is_admin());
drop policy if exists outreach_ticket_messages_select on public.outreach_ticket_messages;
create policy outreach_ticket_messages_select on public.outreach_ticket_messages for select to authenticated using (public.is_admin());

-- All writes go through the admin-only server routes (service role).
revoke all on public.outreach_tickets, public.outreach_ticket_messages from anon, authenticated;
grant select on public.outreach_tickets, public.outreach_ticket_messages to authenticated;
