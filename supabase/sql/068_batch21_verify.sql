-- Batch 21 verify (read-only). Run V1, V2 one at a time.
-- V1: expect t
select to_regclass('public.cron_runs') is not null as table_ok;
-- V2: expect ZERO rows (no browser role may touch it)
select grantee, privilege_type from information_schema.role_table_grants
 where table_schema='public' and table_name='cron_runs' and grantee in ('anon','authenticated');
