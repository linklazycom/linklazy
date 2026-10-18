-- =====================================================================
-- 042_batch14_usage_charges.sql  (Batch 14)  — additive only
-- Creates: usage_charges (one row per chargeable use: charged / free / refunded / void)
--          usage_charge_debit(...)  and  usage_charge_refund(...)  (server-only functions)
-- Does NOT change any existing table, policy, trigger or data. It CALLS the existing
-- public.adjust_wallet_balance(...) for every wallet movement (same atomic function the
-- withdrawal and refund code already use), so wallet_ledger and the reconciliation view stay consistent.
--
-- PRE-CHECK (run first; expect: usage_charges = NULL, and one row for adjust_wallet_balance):
--   select to_regclass('public.usage_charges') as usage_charges;
--   select p.proname, pg_get_function_arguments(p.oid) as arguments
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'adjust_wallet_balance';
-- Send me both results if usage_charges is NOT null, or adjust_wallet_balance is missing/has a different argument list
-- (it must contain p_user_id, p_delta, p_type and p_notes).
--
-- ORDER: run this file FIRST, then deploy the batch14 code.
-- Nothing is charged until an admin switches charging on AND gives an action a price (both default to OFF / 0).
--
-- ROLLBACK (no wallet balance is touched; the usage history is lost):
--   drop function if exists public.usage_charge_refund(uuid, text);
--   drop function if exists public.usage_charge_debit(uuid, text, integer, text, integer);
--   drop table if exists public.usage_charges;
--   (If something was already charged, refund it first from Admin > Usage pricing, or fix by hand with the admin wallet tool.)
-- =====================================================================

create table if not exists public.usage_charges (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  action          text not null,
  amount          integer not null default 0,        -- wallet currency units actually taken (0 for free uses)
  status          text not null default 'charged',   -- charged | free | refunded | void
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  refunded_at     timestamptz,
  refund_reason   text,
  constraint usage_charges_status check (status in ('charged','free','refunded','void')),
  constraint usage_charges_amount check (amount >= 0 and amount <= 1000000),
  constraint usage_charges_action_fmt check (action ~ '^[a-z0-9_]{2,60}$'),
  constraint usage_charges_key_len check (char_length(idempotency_key) between 8 and 100),
  constraint usage_charges_free_zero check (status <> 'free' or amount = 0)
);

-- The same request key can only be used once per user: a retry never charges twice.
create unique index if not exists usage_charges_user_key_uidx on public.usage_charges (user_id, idempotency_key);
create index        if not exists usage_charges_quota_idx     on public.usage_charges (user_id, action, created_at desc);
create index        if not exists usage_charges_recent_idx    on public.usage_charges (created_at desc);

-- ---------- debit ----------
-- One transaction: either (usage row + wallet debit) both happen or neither does.
-- r_code: null = ok | 'duplicate' | 'insufficient' | 'failed' | 'invalid'
create or replace function public.usage_charge_debit(
  p_user_id uuid, p_action text, p_amount integer, p_key text, p_free_per_day integer
)
returns table(r_ok boolean, r_code text, r_message text, r_charge_id uuid, r_charged integer, r_is_free boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_used integer;
  v_err text;
begin
  if p_user_id is null or p_amount is null or p_amount < 0 or p_amount > 1000000
     or p_free_per_day is null or p_free_per_day < 0
     or p_action is null or p_action !~ '^[a-z0-9_]{2,60}$'
     or p_key is null or char_length(p_key) < 8 or char_length(p_key) > 100 then
    return query select false, 'invalid'::text, 'Invalid request.'::text, null::uuid, 0, false;
    return;
  end if;

  -- Serialise this user's uses of this action so the free-quota count and the duplicate check are exact.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action, 0));

  select uc.id into v_id from public.usage_charges uc where uc.user_id = p_user_id and uc.idempotency_key = p_key;
  if v_id is not null then
    return query select false, 'duplicate'::text, 'This request was already processed.'::text, v_id, 0, false;
    return;
  end if;

  select count(*)::integer into v_used
    from public.usage_charges uc
   where uc.user_id = p_user_id and uc.action = p_action and uc.status in ('charged', 'free')
     and uc.created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if p_amount = 0 or v_used < p_free_per_day then
    insert into public.usage_charges (user_id, action, amount, status, idempotency_key)
    values (p_user_id, p_action, 0, 'free', p_key) returning id into v_id;
    return query select true, null::text, null::text, v_id, 0, true;
    return;
  end if;

  begin
    insert into public.usage_charges (user_id, action, amount, status, idempotency_key)
    values (p_user_id, p_action, p_amount, 'charged', p_key) returning id into v_id;
    begin
      perform public.adjust_wallet_balance(
        p_user_id => p_user_id, p_delta => -p_amount, p_type => 'usage_charge',
        p_notes => 'Usage: ' || p_action || ' [' || v_id::text || ']');
    exception when others then
      -- Older databases may reject an unknown ledger label; retry once with the long-standing one.
      perform public.adjust_wallet_balance(
        p_user_id => p_user_id, p_delta => -p_amount, p_type => 'admin_adjustment',
        p_notes => 'Usage: ' || p_action || ' [' || v_id::text || ']');
    end;
  exception when others then
    get stacked diagnostics v_err = message_text;
    if v_err ~* '(insufficient|not enough|balance|funds)' then
      return query select false, 'insufficient'::text, 'Not enough wallet balance.'::text, null::uuid, 0, false;
    end if;
    return query select false, 'failed'::text, left('Charge failed: ' || coalesce(v_err, 'unknown'), 200), null::uuid, 0, false;
    return;
  end;

  return query select true, null::text, null::text, v_id, p_amount, false;
end $$;

-- ---------- refund ----------
-- Idempotent: refunding twice gives the money back once.
create or replace function public.usage_charge_refund(p_charge_id uuid, p_reason text)
returns table(r_ok boolean, r_message text, r_refunded integer)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.usage_charges%rowtype;
begin
  select * into c from public.usage_charges uc where uc.id = p_charge_id for update;
  if not found then
    return query select false, 'Charge not found.'::text, 0;
    return;
  end if;

  if c.status in ('refunded', 'void') then
    return query select true, null::text, 0;
    return;
  end if;

  if c.status = 'free' then
    -- nothing was taken; "void" just gives the free use back to the daily quota
    update public.usage_charges set status = 'void', refunded_at = now(), refund_reason = left(coalesce(p_reason, ''), 200) where id = c.id;
    return query select true, null::text, 0;
    return;
  end if;

  begin
    begin
      perform public.adjust_wallet_balance(
        p_user_id => c.user_id, p_delta => c.amount, p_type => 'order_refund',
        p_notes => 'Refund: usage ' || c.action || ' [' || c.id::text || ']');
    exception when others then
      perform public.adjust_wallet_balance(
        p_user_id => c.user_id, p_delta => c.amount, p_type => 'admin_adjustment',
        p_notes => 'Refund: usage ' || c.action || ' [' || c.id::text || ']');
    end;
    update public.usage_charges set status = 'refunded', refunded_at = now(), refund_reason = left(coalesce(p_reason, ''), 200) where id = c.id;
  exception when others then
    return query select false, 'Could not refund.'::text, 0;
    return;
  end;
  return query select true, null::text, c.amount;
end $$;

-- Server-only: closed to every browser role (same rule as adjust_wallet_balance).
revoke all on function public.usage_charge_debit(uuid, text, integer, text, integer) from public, anon, authenticated;
revoke all on function public.usage_charge_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.usage_charge_debit(uuid, text, integer, text, integer) to service_role;
grant execute on function public.usage_charge_refund(uuid, text) to service_role;

-- ---------- Row Level Security ----------
alter table public.usage_charges enable row level security;

-- Owners (and admins) may READ. All writes go through the two functions above (service role).
drop policy if exists usage_charges_select on public.usage_charges;
create policy usage_charges_select on public.usage_charges
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

revoke all on public.usage_charges from anon;
revoke insert, update, delete, truncate on public.usage_charges from authenticated;
grant select on public.usage_charges to authenticated;
