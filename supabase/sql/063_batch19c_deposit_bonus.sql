-- =====================================================================
-- 063_batch19c_deposit_bonus.sql  (Batch 19C) — additive only
-- Creates: public.wallet_bonuses (one row per bonus; unique per payment) and a ledger tracker trigger.
-- Does NOT change wallet_balance logic, any existing function, or any existing row.
-- Rules: the bonus is credited to wallet_balance through the existing adjust_wallet_balance (so the
--        reconciliation view stays consistent), but "remaining" is NOT withdrawable. Spending uses the bonus first.
-- Run BEFORE deploying the batch19c code. Safe to run twice.
--
-- ROLLBACK (balances are not touched; the bonus tracking is lost, so everything becomes withdrawable):
--   drop trigger if exists wallet_bonus_track_trg on public.wallet_ledger;
--   drop function if exists public.wallet_bonus_track();
--   drop table if exists public.wallet_bonuses;
-- =====================================================================

create table if not exists public.wallet_bonuses (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  payment_id         uuid not null unique,                 -- the top-up payment (one bonus per payment)
  provider           text,
  topup_amount       numeric(12,2) not null,
  bonus_amount       numeric(12,2) not null,
  remaining          numeric(12,2) not null,               -- unspent, non-withdrawable part
  status             text not null default 'pending',      -- pending | granted | failed | clawed_back
  created_at         timestamptz not null default now(),
  clawed_back_at     timestamptz,
  clawed_back_amount numeric(12,2),
  constraint wallet_bonuses_status check (status in ('pending','granted','failed','clawed_back')),
  constraint wallet_bonuses_amounts check (bonus_amount >= 0 and remaining >= 0 and remaining <= bonus_amount)
);
create index if not exists wallet_bonuses_user_idx on public.wallet_bonuses (user_id, status);
create index if not exists wallet_bonuses_recent_idx on public.wallet_bonuses (created_at desc);

alter table public.wallet_bonuses enable row level security;

-- A user reads only their own rows; admins read all. Writes: server routes with the service role only.
drop policy if exists wallet_bonuses_own_select on public.wallet_bonuses;
create policy wallet_bonuses_own_select on public.wallet_bonuses for select to authenticated using (user_id = auth.uid());
drop policy if exists wallet_bonuses_admin_select on public.wallet_bonuses;
create policy wallet_bonuses_admin_select on public.wallet_bonuses for select to authenticated using (public.is_admin());

revoke all on public.wallet_bonuses from anon, authenticated;
grant select on public.wallet_bonuses to authenticated;

-- ---------- tracker ----------
-- After every wallet ledger row:
--   * a debit that is NOT a withdrawal and NOT a bonus clawback uses up the oldest bonus first;
--   * an order refund (a credit linked to a site) gives back what that spending took from the bonus (never more).
-- The body is wrapped so that, whatever happens here, a wallet operation can never fail because of the tracker.
create or replace function public.wallet_bonus_track()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  need numeric;
  take numeric;
  r record;
begin
  begin
    if new.user_id is null then
      return new;
    end if;

    if new.amount < 0
       and new.type::text <> 'withdrawal'
       and coalesce(new.notes, '') not like '[bonus-clawback]%' then
      need := -new.amount;
      for r in
        select id, remaining from public.wallet_bonuses
         where user_id = new.user_id and status = 'granted' and remaining > 0
         order by created_at
         for update
      loop
        exit when need <= 0;
        take := least(r.remaining, need);
        update public.wallet_bonuses set remaining = remaining - take where id = r.id;
        need := need - take;
      end loop;

    elsif new.amount > 0
          and new.type::text = 'order_refund'
          and new.related_site_id is not null then
      need := new.amount;
      for r in
        select id, bonus_amount, remaining from public.wallet_bonuses
         where user_id = new.user_id and status = 'granted' and remaining < bonus_amount
         order by created_at
         for update
      loop
        exit when need <= 0;
        take := least(r.bonus_amount - r.remaining, need);
        update public.wallet_bonuses set remaining = remaining + take where id = r.id;
        need := need - take;
      end loop;
    end if;
  exception when others then
    -- never block the wallet
    null;
  end;
  return new;
end;
$$;

drop trigger if exists wallet_bonus_track_trg on public.wallet_ledger;
create trigger wallet_bonus_track_trg
  after insert on public.wallet_ledger
  for each row execute function public.wallet_bonus_track();

-- ---------- optional: a dedicated 'bonus' ledger label ----------
-- If wallet_ledger.type is an enum, try to add 'bonus'. If anything about this fails, nothing is lost:
-- the code falls back to the 'admin_adjustment' label.
do $$
declare
  enum_name text;
begin
  select c.udt_name into enum_name
    from information_schema.columns c
   where c.table_schema = 'public' and c.table_name = 'wallet_ledger' and c.column_name = 'type' and c.data_type = 'USER-DEFINED';
  if enum_name is not null then
    execute format('alter type public.%I add value if not exists %L', enum_name, 'bonus');
  end if;
exception when others then
  raise notice 'Could not add the bonus ledger label (%). The admin_adjustment label will be used.', sqlerrm;
end $$;
