-- =====================================================================
-- 070_batch22_test_money_reset_DRYRUN.sql (Batch 22)
-- Sets the wallet balance of the listed TEST accounts to zero, through the normal audited path
-- (adjust_wallet_balance with a negative 'admin_adjustment'), so the ledger stays consistent.
--
-- ⚠️  DO NOT APPLY until ALL of these are true:
--   1. You took a backup/dump (docs/BACKUP_PLAN.md) and checked the discovery results (069) with me.
--   2. You are SURE every listed account holds fake test money, not real customers' money.
--   3. Pending withdrawal requests of these accounts were rejected (the script refuses to run otherwise).
--
-- It starts as a DRY RUN: it only PRINTS what it would do (see "Messages"/"Notices" in the SQL editor).
-- To apply for real, change  v_apply := false  to  true  and run it again.
-- NOT TESTED against your live database: always read the dry-run output first.
-- =====================================================================
do $$
declare
  v_apply  boolean := false;                  -- <<< change to true ONLY after the checks above
  v_emails text[]  := array[]::text[];        -- <<< fill in, e.g. array['admin@yourdomain.com','david@example.com']
  r        record;
  v_pending integer;
  v_total  numeric := 0;
  v_count  integer := 0;
begin
  if coalesce(array_length(v_emails, 1), 0) = 0 then
    raise exception 'Fill v_emails with the test account emails first.';
  end if;

  select count(*) into v_pending
    from public.withdrawal_requests w
    join public.profiles p on p.id = w.user_id
   where lower(p.email) = any (select lower(x) from unnest(v_emails) x)
     and w.status in ('pending', 'approved');
  if v_pending > 0 then
    raise exception '% pending/approved withdrawal request(s) exist for these accounts. Reject them first.', v_pending;
  end if;

  for r in
    select id, email, wallet_balance
      from public.profiles
     where lower(email) = any (select lower(x) from unnest(v_emails) x)
       and wallet_balance <> 0
  loop
    raise notice '% : balance % -> 0', r.email, r.wallet_balance;
    v_total := v_total + r.wallet_balance;
    v_count := v_count + 1;
    if v_apply then
      perform public.adjust_wallet_balance(
        p_user_id => r.id,
        p_delta   => -r.wallet_balance,
        p_type    => 'admin_adjustment',
        p_notes   => 'Pre-launch test money reset'
      );
    end if;
  end loop;

  raise notice '% - % account(s), total % removed',
    case when v_apply then 'APPLIED' else 'DRY RUN (nothing was changed)' end, v_count, v_total;
end $$;
