-- =====================================================================
-- 026_batch7b_columns_diagnostics_read_only.sql  (Batch 7B প্রস্তুতি)
-- শুধু পড়ে। কিছু বদলায় না। ২টি কোয়েরি **একটি একটি করে** চালান।
-- (আগের Q1 Supabase-এর ১০০-সারি সীমায় কাটা পড়েছিল; এখানে প্রতি টেবিলে ১ সারি।)
-- =====================================================================

-- ---------- Q-A: প্রতি টেবিলে এক সারি; কলামগুলো "নাম:টাইপ" আকারে ----------
select table_name,
       string_agg(column_name || ':' || udt_name, ', ' order by ordinal_position) as columns
from information_schema.columns
where table_schema = 'public'
group by table_name
order by table_name;

-- ---------- Q-B: সেটিংস টেবিলের শুধু কী-এর নাম (মান নয়) ----------
select 'site_settings' as source, key from public.site_settings
union all
select 'admin_settings', key from public.admin_settings
order by 1, 2;
