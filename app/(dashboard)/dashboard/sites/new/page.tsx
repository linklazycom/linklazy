"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { NICHES } from "@/lib/niches";
import { Button } from "@/components/ui/button";

export default function NewSitePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptsExchange, setAcceptsExchange] = useState(true);
  const [acceptsPaid, setAcceptsPaid] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      url: form.get("url"),
      niche: form.get("niche"),
      language: form.get("language") || "en",
      da: form.get("da") || undefined,
      pa: form.get("pa") || undefined,
      dr: form.get("dr") || undefined,
      organic_traffic: form.get("organic_traffic") || undefined,
      referring_domains: form.get("referring_domains") || undefined,
      total_backlinks: form.get("total_backlinks") || undefined,
      indexed_pages: form.get("indexed_pages") || undefined,
      post_count: form.get("post_count") || undefined,
      spam_score: form.get("spam_score") || undefined,
      accepts_exchange: acceptsExchange,
      accepts_paid: acceptsPaid,
      price_amount: form.get("price_amount") || undefined,
      link_type: form.get("link_type"),
      placement: form.get("placement"),
      turnaround_hours: form.get("turnaround_hours") || 48,
      guidelines: form.get("guidelines") || undefined,
    };

    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Please check the form for errors.");
      setLoading(false);
      return;
    }

    const { id } = await res.json();
    router.push(`/dashboard/sites/${id}/verify`);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">List a site</h1>
      <p className="mb-6 text-sm text-muted">
        Enter your site&apos;s metrics honestly — inflated numbers get caught
        at review and your account gets flagged. You&apos;ll verify ownership
        in the next step.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Site details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field id="url" name="url" label="Site URL" placeholder="https://example.com" required />
            </div>
            <SelectField id="niche" name="niche" label="Niche" options={NICHES} required />
            <Field id="language" name="language" label="Language" defaultValue="en" />
          </div>
        </div>

        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Metrics</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field id="da" name="da" type="number" label="DA" />
            <Field id="pa" name="pa" type="number" label="PA" />
            <Field id="dr" name="dr" type="number" label="DR" />
            <Field id="organic_traffic" name="organic_traffic" type="number" label="Monthly traffic" />
            <Field id="referring_domains" name="referring_domains" type="number" label="Referring domains" />
            <Field id="total_backlinks" name="total_backlinks" type="number" label="Total backlinks" />
            <Field id="indexed_pages" name="indexed_pages" type="number" label="Indexed pages" />
            <Field id="post_count" name="post_count" type="number" label="Post count" />
            <Field id="spam_score" name="spam_score" type="number" label="Spam score" />
          </div>
        </div>

        <div className="rounded-chip border border-line bg-white p-5">
          <h2 className="mb-4 text-sm font-medium">Link terms</h2>
          <div className="mb-4 grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 rounded-chip border border-line px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={acceptsExchange}
                onChange={(e) => setAcceptsExchange(e.target.checked)}
              />
              Accept exchange
            </label>
            <label className="flex items-center gap-2 rounded-chip border border-line px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={acceptsPaid}
                onChange={(e) => setAcceptsPaid(e.target.checked)}
              />
              Accept paid orders
            </label>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field
              id="price_amount"
              name="price_amount"
              type="number"
              label="Price (৳, smallest unit)"
              disabled={!acceptsPaid}
            />
            <div>
              <label htmlFor="link_type" className="mb-1 block text-sm text-muted">
                Link type
              </label>
              <select
                id="link_type"
                name="link_type"
                defaultValue="dofollow"
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              >
                <option value="dofollow">Dofollow</option>
                <option value="nofollow">Nofollow</option>
              </select>
            </div>
            <div>
              <label htmlFor="placement" className="mb-1 block text-sm text-muted">
                Placement
              </label>
              <select
                id="placement"
                name="placement"
                defaultValue="in_content"
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              >
                <option value="in_content">In-content</option>
                <option value="author_bio">Author bio</option>
                <option value="homepage">Homepage</option>
                <option value="sidebar">Sidebar</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
            <Field
              id="turnaround_hours"
              name="turnaround_hours"
              type="number"
              label="Turnaround time (hours)"
              defaultValue={48}
            />
          </div>
          <div className="mt-4">
            <label htmlFor="guidelines" className="mb-1 block text-sm text-muted">
              Content guidelines (optional)
            </label>
            <textarea
              id="guidelines"
              name="guidelines"
              rows={3}
              className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              placeholder="E.g. no gambling/adult content, anchor text must be natural…"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" size="lg" disabled={loading}>
          {loading ? "Submitting…" : "Submit for review"}
        </Button>
      </form>
    </div>
  );
}
