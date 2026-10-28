-- Batch 19A verify (read-only). Run V1, V2, V3 one at a time.

-- V1: expect 8 rows (the new columns)
select column_name from information_schema.columns
 where table_schema='public' and table_name='withdrawal_requests'
   and column_name in ('method','account_number','account_name','bank_name','bank_branch','routing_number','transaction_id','proof_url')
 order by 1;

-- V2: expect is_nullable = YES
select is_nullable from information_schema.columns
 where table_schema='public' and table_name='withdrawal_requests' and column_name='bkash_number';

-- V3: expect 0 (no old request left without account_number)
select count(*) from public.withdrawal_requests where account_number is null and bkash_number is not null;
