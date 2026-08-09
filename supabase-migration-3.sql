-- =========================================================
-- LINKLAZY — MIGRATION 3 (Sprint 6)
-- Seller tier auto-computation (Bronze/Silver/Gold) based on
-- completed orders and average rating. Runs automatically whenever
-- an order is accepted or a review is added — no cron job needed.
-- Run this in Supabase SQL Editor AFTER migration 2.
-- =========================================================

create or replace function public.recompute_seller_stats(p_seller_id uuid)
returns void as $$
declare
  v_completed_count int;
  v_avg_rating numeric(3,2);
  v_avg_delivery_hours numeric(6,2);
  v_response_rate numeric(5,2);
  v_tier text;
begin
  -- Completed (accepted) orders for this seller
  select count(*) into v_completed_count
  from public.orders
  where seller_id = p_seller_id and status = 'accepted';

  -- Average rating this seller has received
  select avg(r.rating) into v_avg_rating
  from public.reviews r
  join public.orders o on o.id = r.order_id
  where r.reviewee_id = p_seller_id;

  -- Average time between order creation and delivery, for accepted orders
  select avg(extract(epoch from (o.delivered_at - o.created_at)) / 3600)
    into v_avg_delivery_hours
  from public.orders o
  where o.seller_id = p_seller_id and o.delivered_at is not null;

  -- Response rate: share of orders that reached delivered/accepted vs
  -- total non-cancelled orders assigned to this seller
  select case when count(*) filter (where status not in ('cancelled')) = 0 then null
    else round(
      100.0 * count(*) filter (where status in ('delivered', 'accepted')) /
      count(*) filter (where status not in ('cancelled')), 2
    ) end
  into v_response_rate
  from public.orders
  where seller_id = p_seller_id;

  -- Tier thresholds: tune these as the marketplace grows
  v_tier := case
    when v_completed_count >= 50 and coalesce(v_avg_rating, 0) >= 4.5 then 'gold'
    when v_completed_count >= 15 and coalesce(v_avg_rating, 0) >= 4.0 then 'silver'
    when v_completed_count >= 3 and coalesce(v_avg_rating, 0) >= 3.5 then 'bronze'
    else 'unranked'
  end;

  update public.profiles
  set
    seller_tier = v_tier,
    response_rate = v_response_rate,
    avg_delivery_hours = v_avg_delivery_hours
  where id = p_seller_id;
end;
$$ language plpgsql security definer;

-- Trigger: recompute stats whenever an order's status changes
create or replace function public.trg_recompute_seller_stats_on_order()
returns trigger as $$
begin
  if (tg_op = 'UPDATE' and new.status is distinct from old.status)
     or tg_op = 'INSERT' then
    perform public.recompute_seller_stats(new.seller_id);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_recompute_seller_stats on public.orders;
create trigger trg_orders_recompute_seller_stats
  after insert or update on public.orders
  for each row execute procedure public.trg_recompute_seller_stats_on_order();

-- Trigger: recompute stats whenever a new review comes in
create or replace function public.trg_recompute_seller_stats_on_review()
returns trigger as $$
begin
  perform public.recompute_seller_stats(new.reviewee_id);
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_reviews_recompute_seller_stats on public.reviews;
create trigger trg_reviews_recompute_seller_stats
  after insert on public.reviews
  for each row execute procedure public.trg_recompute_seller_stats_on_review();

-- =========================================================
-- END OF MIGRATION 3
-- =========================================================
