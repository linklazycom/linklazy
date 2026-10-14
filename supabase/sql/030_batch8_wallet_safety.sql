-- =====================================================================
-- 030_batch8_wallet_safety.sql  (Batch 8)
-- ORDER: run THIS FILE FIRST, then upload the Batch 8 code and deploy.
-- (The new withdrawal code writes the wallet_reserved column added below.)
-- Everything here is additive and safe to run more than once.
--
-- What it does:
--   1) withdrawal_requests.wallet_reserved: remembers how much of a request was
--      taken out of the wallet, so a rejected request can give it back.
--   2) wallet_ledger append-only guard: blocks changing or deleting ledger rows
--      (deleting is still allowed when the whole user is deleted).
--   3) wallet_reconciliation view: wallet_balance versus the sum of the ledger,
--      read by the new admin page /admin/reconciliation.
--
-- Emergency switch for the guard (only if you must correct a ledger row by hand):
--   alter table public.wallet_ledger disable trigger wallet_ledger_append_only_trg;
--   ... make the correction ...
--   alter table public.wallet_ledger enable trigger wallet_ledger_append_only_trg;
-- =====================================================================

begin;

-- 1) withdrawal reservation memory
alter table public.withdrawal_requests
  add column if not exists wallet_reserved integer;

-- 2) append-only guard
create or replace function public.wallet_ledger_append_only()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    if new.amount is distinct from old.amount
       or new.type::text is distinct from old.type::text
       or new.balance_after is distinct from old.balance_after
       or new.created_at is distinct from old.created_at
       or (new.user_id is distinct from old.user_id and new.user_id is not null) then
      raise exception 'wallet_ledger rows cannot be changed' using errcode = '42501';
    end if;
    return new;
  end if;

  -- DELETE: only allowed when the owner profile is already gone (account deletion cascade)
  if exists (select 1 from public.profiles p where p.id = old.user_id) then
    raise exception 'wallet_ledger rows cannot be deleted' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists wallet_ledger_append_only_trg on public.wallet_ledger;
create trigger wallet_ledger_append_only_trg
  before update or delete on public.wallet_ledger
  for each row execute function public.wallet_ledger_append_only();

-- 3) reconciliation view (server-side use only)
create or replace view public.wallet_reconciliation
with (security_invoker = true) as
select
  p.id as user_id,
  p.wallet_balance,
  coalesce(l.ledger_sum, 0) as ledger_sum,
  p.wallet_balance - coalesce(l.ledger_sum, 0) as difference,
  coalesce(l.entries, 0) as entries,
  l.last_entry_at
from public.profiles p
left join (
  select user_id, sum(amount) as ledger_sum, count(*) as entries, max(created_at) as last_entry_at
  from public.wallet_ledger
  group by user_id
) l on l.user_id = p.id;

revoke all on public.wallet_reconciliation from public, anon, authenticated;
grant select on public.wallet_reconciliation to service_role;

commit;

-- =====================================================================
-- CHECKS (run each one separately, send me the results)
--
-- C1: the new column and the trigger exist
--   select column_name from information_schema.columns
--    where table_schema='public' and table_name='withdrawal_requests' and column_name='wallet_reserved';
--   select tgname, tgenabled from pg_trigger where tgname = 'wallet_ledger_append_only_trg';
--   expected: one row each, tgenabled = 'O'
--
-- C2: reconciliation overview (how many users do not match)
--   select count(*) as users_checked,
--          count(*) filter (where difference <> 0) as mismatches
--     from public.wallet_reconciliation;
--
-- C3: mismatching users (read-only)
--   select user_id, wallet_balance, ledger_sum, difference, entries, last_entry_at
--     from public.wallet_reconciliation
--    where difference <> 0
--    order by abs(difference) desc
--    limit 50;
--
-- C4: old rejected withdrawal requests whose wallet part may never have been returned
--   (before this batch a rejection did not give the reserved wallet amount back)
--   select r.id, r.user_id, r.amount, r.requested_at, r.processed_at,
--          (select sum(-l.amount) from public.wallet_ledger l
--            where l.user_id = r.user_id and l.type::text = 'withdrawal'
--              and l.created_at between r.requested_at - interval '2 minutes'
--                                   and r.requested_at + interval '2 minutes') as wallet_debited
--     from public.withdrawal_requests r
--    where r.status = 'rejected' and r.wallet_reserved is null
--    order by r.requested_at;
--
-- C5: ledger column type (for a future dedicated refund type)
--   select data_type, udt_name from information_schema.columns
--    where table_schema='public' and table_name='wallet_ledger' and column_name='type';
--   select e.enumlabel from pg_enum e join pg_type t on t.oid = e.enumtypid
--    where t.typname = (select udt_name from information_schema.columns
--                        where table_schema='public' and table_name='wallet_ledger' and column_name='type')
--    order by e.enumsortorder;
--
-- ROLLBACK (only if something breaks):
--   drop trigger if exists wallet_ledger_append_only_trg on public.wallet_ledger;
--   drop function if exists public.wallet_ledger_append_only();
--   drop view if exists public.wallet_reconciliation;
--   (the wallet_reserved column can stay; it is harmless)
-- =====================================================================
