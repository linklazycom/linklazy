-- 014_fix_reviews.sql
-- Run in Supabase → SQL Editor. Safe to re-run.
--
-- Problem: reviews_insert_participant only checked that the reviewer belongs to the
-- order. A client could review ANY user (reviewee_id), on orders that are not
-- finished, and repeat it (no unique constraint exists in the exported schema).
-- Review ratings feed seller_tier, so this could be used to inflate/destroy ratings.

drop policy if exists reviews_insert_participant on public.reviews;

create policy reviews_insert_participant on public.reviews
  for insert
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = reviews.order_id
        and o.status::text = 'accepted'
        and (
          (o.buyer_id  = auth.uid() and reviews.reviewee_id = o.seller_id)
          or
          (o.seller_id = auth.uid() and reviews.reviewee_id = o.buyer_id)
        )
    )
    and not exists (
      select 1 from public.reviews r2
      where r2.order_id = reviews.order_id and r2.reviewer_id = auth.uid()
    )
  );

-- One review per person per order (the review route already expects this).
-- Created only if no duplicates exist yet; otherwise a notice tells you.
do $$
begin
  if exists (
    select 1 from public.reviews group by order_id, reviewer_id having count(*) > 1
  ) then
    raise notice 'Duplicate reviews exist (same order + reviewer) - unique index NOT created. Clean them up first.';
  else
    create unique index if not exists reviews_order_reviewer_uniq
      on public.reviews (order_id, reviewer_id);
  end if;
end $$;
