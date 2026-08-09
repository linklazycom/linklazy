interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export function ReviewsList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) {
    return <p className="text-sm text-muted">No reviews yet.</p>;
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg font-medium text-amber">★ {avg.toFixed(1)}</span>
        <span className="text-sm text-muted">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
      </div>
      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className="rounded-chip border border-line bg-white p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-amber">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
              <span className="text-xs text-muted">{new Date(r.created_at).toLocaleDateString()}</span>
            </div>
            {r.comment && <p className="text-sm text-ink">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
