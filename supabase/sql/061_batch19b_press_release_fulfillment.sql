-- =====================================================================
-- 061_batch19b_press_release_fulfillment.sql  (Batch 19B) — additive only
-- Run BEFORE deploying the batch19b code. Safe to run twice. Drops nothing.
-- Adds: delivery link / expected date / delivered date on orders (client-visible),
--       delivery_days on packages (SLA), and a NEW admin-only table with the
--       supplier, supplier cost and internal note (the client must never see these).
-- ROLLBACK (only the new data is lost):
--   drop table if exists public.press_release_fulfillment;
--   alter table public.press_release_orders drop column if exists delivery_url, drop column if exists expected_delivery_at,
--     drop column if exists delivered_at, drop column if exists status_changed_at;
--   alter table public.press_release_products drop column if exists delivery_days;
-- =====================================================================

alter table public.press_release_orders
  add column if not exists delivery_url text,
  add column if not exists expected_delivery_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists status_changed_at timestamptz;

alter table public.press_release_products
  add column if not exists delivery_days integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'press_release_products_delivery_days_check') then
    alter table public.press_release_products
      add constraint press_release_products_delivery_days_check check (delivery_days is null or delivery_days between 1 and 90);
  end if;
end $$;

create table if not exists public.press_release_fulfillment (
  order_id       uuid primary key references public.press_release_orders(id) on delete cascade,
  supplier_name  text,
  supplier_cost  numeric(12,2),
  internal_note  text,
  updated_at     timestamptz not null default now(),
  constraint prf_supplier_name check (supplier_name is null or char_length(supplier_name) <= 120),
  constraint prf_supplier_cost check (supplier_cost is null or supplier_cost between 0 and 10000000),
  constraint prf_internal_note check (internal_note is null or char_length(internal_note) <= 2000)
);

alter table public.press_release_fulfillment enable row level security;

-- Admins may read; nobody else. Writes: admin routes with the service role only.
drop policy if exists prf_admin_select on public.press_release_fulfillment;
create policy prf_admin_select on public.press_release_fulfillment for select to authenticated using (public.is_admin());

revoke all on public.press_release_fulfillment from anon, authenticated;
grant select on public.press_release_fulfillment to authenticated;
