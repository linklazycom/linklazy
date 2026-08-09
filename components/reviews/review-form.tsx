"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ReviewForm({ orderId, onDone }: { orderId: string; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError("Pick a star rating first.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/orders/${orderId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment || undefined }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not submit review.");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-chip border border-line bg-white p-5">
      <h3 className="mb-3 text-sm font-medium">Leave a review</h3>
      <div className="mb-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={cn(
              "text-2xl leading-none transition-colors",
              n <= rating ? "text-amber" : "text-line"
            )}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        placeholder="Optional — how did the order go?"
        className="mb-3 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-brand-violet"
      />
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <Button type="submit" size="sm" disabled={submitting}>
        {submitting ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
