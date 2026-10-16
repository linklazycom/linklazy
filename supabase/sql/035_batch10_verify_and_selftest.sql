-- =====================================================================
-- 035_batch10_verify_and_selftest.sql  (Batch 10)
-- Run AFTER 034. Run each block (V1, V2, V3, S1) separately; send me the results.
-- V1–V3 are read-only. S1 writes test rows but ALWAYS rolls them back
-- (it ends with an intentional error — that is how the rollback happens).
-- =====================================================================

-- V1: 4 rows, relrowsecurity = true for all
select relname, relrowsecurity
from pg_class
where relname in ('link_clicks','link_click_rollups','bio_pages','bio_links')
  and relnamespace = 'public'::regnamespace
order by relname;

-- V2: expected exactly 2 rows: bio_pages_select, bio_links_select (both SELECT);
--     none for link_clicks / link_click_rollups
select tablename, policyname, cmd
from pg_policies
where tablename in ('link_clicks','link_click_rollups','bio_pages','bio_links')
order by tablename, policyname;

-- V3: expected: 'authenticated' has only SELECT on bio_pages and bio_links;
--     NO rows for 'anon'; NO rows at all for link_clicks / link_click_rollups
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('link_clicks','link_click_rollups','bio_pages','bio_links')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- S1: self-test of the click logic. Expected result is an ERROR whose message
-- starts with  SELFTEST PASSED  (everything is rolled back by that error).
-- A message starting with  SELFTEST FAILED  means something is wrong: send it to me.
do $$
declare
  v_user   uuid;
  v_link   uuid;
  v_ok     boolean;
  v_count  integer;
  v_moved  bigint;
  v_data   jsonb;
begin
  select id into v_user from auth.users limit 1;
  if v_user is null then
    raise exception 'SELFTEST FAILED: no user found in auth.users to attach a test link to';
  end if;

  insert into public.short_links (user_id, slug, destination_url, max_clicks)
  values (v_user, 'zz-selftest-' || substr(md5(random()::text), 1, 8), 'https://example.com/', 2)
  returning id into v_link;

  -- 1) first click counts
  v_ok := public.record_link_click(v_link, 'direct', 'BD', 'desktop', 'chrome', null, 'visitor-a');
  if not v_ok then raise exception 'SELFTEST FAILED: first click was refused'; end if;

  -- 2) same visitor immediately again = duplicate, not counted twice
  v_ok := public.record_link_click(v_link, 'direct', 'BD', 'desktop', 'chrome', null, 'visitor-a');
  select click_count into v_count from public.short_links where id = v_link;
  if v_count <> 1 then raise exception 'SELFTEST FAILED: duplicate click was counted (count=%)', v_count; end if;

  -- 3) different visitor counts (QR source)
  v_ok := public.record_link_click(v_link, 'qr', 'US', 'mobile', 'safari', 'example.org', 'visitor-b');
  select click_count into v_count from public.short_links where id = v_link;
  if not v_ok or v_count <> 2 then raise exception 'SELFTEST FAILED: second visitor not counted (count=%)', v_count; end if;

  -- 4) limit (2) reached: a third visitor is refused and not counted
  v_ok := public.record_link_click(v_link, 'direct', 'GB', 'desktop', 'firefox', null, 'visitor-c');
  select click_count into v_count from public.short_links where id = v_link;
  if v_ok or v_count <> 2 then raise exception 'SELFTEST FAILED: click limit not enforced (ok=%, count=%)', v_ok, v_count; end if;

  -- 5) analytics sees the 2 logged clicks (1 via QR)
  v_data := public.link_analytics_data(v_link, 30);
  if (v_data->'totals'->>'clicks')::int <> 2 or (v_data->'totals'->>'qr')::int <> 1 then
    raise exception 'SELFTEST FAILED: analytics totals wrong: %', v_data->'totals';
  end if;

  -- 6) rollup: an old click is summarised and its raw row removed; analytics still counts it
  insert into public.link_clicks (link_id, clicked_at, source, country, device, browser, referrer_host, visitor_hash)
  values (v_link, now() - interval '200 days', 'direct', 'BD', 'desktop', 'chrome', null, 'old-visitor');
  v_moved := public.rollup_link_clicks(90);
  if v_moved < 1 then raise exception 'SELFTEST FAILED: rollup moved nothing'; end if;
  if exists (select 1 from public.link_clicks where link_id = v_link and clicked_at < now() - interval '150 days') then
    raise exception 'SELFTEST FAILED: old raw click was not removed';
  end if;
  if not exists (select 1 from public.link_click_rollups where link_id = v_link and dim = 'total') then
    raise exception 'SELFTEST FAILED: no rollup row created';
  end if;
  v_data := public.link_analytics_data(v_link, 365);
  if (v_data->'totals'->>'clicks')::int <> 3 then
    raise exception 'SELFTEST FAILED: 365-day analytics should be 3 (2 raw + 1 rolled up), got %', v_data->'totals'->>'clicks';
  end if;

  -- Everything passed. Raise on purpose so ALL test rows are rolled back.
  raise exception 'SELFTEST PASSED: all checks ok (test data rolled back, nothing was saved)';
end;
$$;
