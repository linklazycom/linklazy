-- Batch 19A: withdrawal payout methods (bKash / Nagad / bank), transaction id and proof.
-- Run this BEFORE deploying the code. Additive only; safe to run twice.
-- Rollback: see the bottom (commented).

alter table public.withdrawal_requests
  add column if not exists method text not null default 'bkash',
  add column if not exists account_number text,
  add column if not exists account_name text,
  add column if not exists bank_name text,
  add column if not exists bank_branch text,
  add column if not exists routing_number text,
  add column if not exists transaction_id text,
  add column if not exists proof_url text;

-- Nagad/bank requests have no bKash number.
alter table public.withdrawal_requests alter column bkash_number drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'withdrawal_requests_method_check') then
    alter table public.withdrawal_requests
      add constraint withdrawal_requests_method_check check (method in ('bkash','nagad','bank'));
  end if;
end $$;

-- Old requests: copy the bKash number into the new column.
update public.withdrawal_requests
   set account_number = bkash_number
 where account_number is null and bkash_number is not null;

-- Rollback (only if needed):
-- alter table public.withdrawal_requests drop constraint if exists withdrawal_requests_method_check;
-- alter table public.withdrawal_requests drop column if exists method, drop column if exists account_number,
--   drop column if exists account_name, drop column if exists bank_name, drop column if exists bank_branch,
--   drop column if exists routing_number, drop column if exists transaction_id, drop column if exists proof_url;
