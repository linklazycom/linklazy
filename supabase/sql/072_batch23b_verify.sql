-- Batch 23B verify (read-only). Expect FIVE rows: suspended_at, suspended_by, suspended_reason (projects) and last_recheck_at, recheck_failures (custom_domains)
select table_name, column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'projects' and column_name in ('suspended_at','suspended_reason','suspended_by'))
     or (table_name = 'custom_domains' and column_name in ('recheck_failures','last_recheck_at')))
 order by table_name, column_name;
