-- =====================================================================
-- 069_batch22_launch_discovery.sql (Batch 22) — READ-ONLY. Changes nothing.
-- Purpose: find out what test/fake data is in the database before launch.
-- Run Q1..Q9 ONE AT A TIME in the Supabase SQL editor and send me the results
-- (you may hide real people's emails; I need the shape, amounts and counts).
-- =====================================================================

-- Q1: who holds money in the wallet (largest first)
select p.email, p.role, p.wallet_balance
  from public.profiles p
 where p.wallet_balance <> 0
 order by p.wallet_balance desc
 limit 50;

-- Q2: where did that money come from? (per account, per ledger type; 'topup' with a real provider is real money)
select p.email, l.type::text as ledger_type, count(*) as rows, sum(l.amount) as total
  from public.wallet_ledger l
  join public.profiles p on p.id = l.user_id
 where p.wallet_balance > 1000
 group by p.email, l.type
 order by p.email, total desc;

-- Q3: payments by provider and status (real PayPal/bKash payments vs internal wallet payments)
select provider, status, count(*) as rows, sum(amount) as total_amount
  from public.payments
 group by provider, status
 order by provider, status;

-- Q4: orders by status
select status, count(*) as orders, sum(price_amount) as total_price
  from public.orders
 group by status
 order by orders desc;

-- Q5: withdrawal requests by status (pending ones must be handled before any balance reset)
select status, count(*) as requests, sum(amount) as total
  from public.withdrawal_requests
 group by status
 order by requests desc;

-- Q6: sites that look like test data (domain contains test/example/bird/demo/sample)
select id, domain, status
  from public.sites
 where domain ilike any (array['%test%','%example%','%bird%','%demo%','%sample%','%dummy%'])
 order by domain
 limit 100;

-- Q7: accounts that look like test accounts
select email, role, wallet_balance, created_at
  from public.profiles
 where email ilike any (array['%test%','%example%','%demo%','%dummy%'])
 order by created_at desc
 limit 100;

-- Q8: how many real users and sites exist at all
select (select count(*) from public.profiles) as profiles,
       (select count(*) from public.sites) as sites,
       (select count(*) from public.sites where status = 'approved') as approved_sites;

-- Q9: every table with its approximate row count (to spot unused tables; nothing is dropped by this)
select c.relname as table_name, c.reltuples::bigint as approx_rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
 order by approx_rows desc, table_name;
