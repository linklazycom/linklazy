-- =====================================================================
-- 033_batch9_verify_read_only.sql  (Batch 9)  — READ ONLY, changes nothing
-- Run AFTER 032. Run each V-query separately and send me the results.
-- =====================================================================

-- V1: 4 rows, relrowsecurity = true for all
select relname, relrowsecurity
from pg_class
where relname in ('short_links','short_link_secrets','link_blocklist','link_reports')
  and relnamespace = 'public'::regnamespace
order by relname;

-- V2: expected exactly 3 rows (short_links_select, link_blocklist_select_admin, link_reports_select_admin), all SELECT
select tablename, policyname, cmd
from pg_policies
where tablename in ('short_links','short_link_secrets','link_blocklist','link_reports')
order by tablename, policyname;

-- V3: expected: 'authenticated' has only SELECT on short_links/link_blocklist/link_reports;
--     NO rows for 'anon'; NO rows at all for short_link_secrets
select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('short_links','short_link_secrets','link_blocklist','link_reports')
  and grantee in ('anon','authenticated')
order by table_name, grantee, privilege_type;

-- V4: expected 2 function rows and 1 trigger row (tgenabled = 'O')
select proname from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('consume_link_click','short_links_on_profile_status');

select tgname, tgenabled from pg_trigger where tgname = 'short_links_profile_status';
