import type { SupabaseClient } from "@supabase/supabase-js";

export interface SellerRating {
  avg: number;
  count: number;
}

/**
 * Batch-computes average rating + review count for a set of seller ids in
 * one query, so listing pages (Browse Sites, bulk order) can show a
 * seller's rating next to each site without an N+1 query per card.
 *
 * There's no stored aggregate-rating column on `profiles` today — this
 * computes it from the `reviews` table on each request. Fine at current
 * scale (one query, reviews for a page of ~20-40 owners); if the reviews
 * table grows large, this is the first place to add a cached column
 * (recompute_seller_stats already recomputes similar aggregates on
 * order/review triggers, so avg_rating could be folded in there later).
 */
export async function getSellerRatings(
  supabase: SupabaseClient,
  ownerIds: string[]
): Promise<Map<string, SellerRating>> {
  const ratingByOwner = new Map<string, SellerRating>();
  if (ownerIds.length === 0) return ratingByOwner;

  const { data: reviews } = await supabase
    .from("reviews")
    .select("reviewee_id, rating")
    .in("reviewee_id", ownerIds);

  const sums = new Map<string, { total: number; count: number }>();
  for (const r of reviews ?? []) {
    const entry = sums.get(r.reviewee_id) ?? { total: 0, count: 0 };
    entry.total += r.rating;
    entry.count += 1;
    sums.set(r.reviewee_id, entry);
  }

  for (const [ownerId, { total, count }] of sums) {
    ratingByOwner.set(ownerId, { avg: total / count, count });
  }

  return ratingByOwner;
}
