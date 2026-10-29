-- Batch 20 verify (read-only). Expect ONE row: lost_notified_at
select column_name from information_schema.columns
 where table_schema='public' and table_name='backlinks' and column_name='lost_notified_at';
