"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

interface SavedSearch {
  id: string;
  name: string | null;
  filters: Record<string, string>;
  email_alerts: boolean;
  created_at: string;
}

function filtersToQueryString(filters: Record<string, string>): string {
  const params = new URLSearchParams(filters);
  return params.toString();
}

function filtersToSummary(filters: Record<string, string>): string {
  const parts: string[] = [];
  if (filters.niche) parts.push(`niche: ${filters.niche}`);
  if (filters.da_min || filters.da_max) {
    parts.push(`DA ${filters.da_min ?? "0"}–${filters.da_max ?? "100"}`);
  }
  if (filters.price_max) parts.push(`under ৳${filters.price_max}`);
  if (filters.link_type) parts.push(filters.link_type);
  if (filters.exchange_only === "1") parts.push("exchange only");
  return parts.length ? parts.join(" · ") : "All sites";
}

export default function SavedSearchesPage() {
  const supabase = createClient();
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data } = await supabase
      .from("saved_searches")
      .select("id, name, filters, email_alerts, created_at")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });
    setSearches((data as SavedSearch[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(id: string) {
    await fetch(`/api/saved-searches/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div>
      <h1 className="mb-2 font-display text-2xl font-medium">Saved searches</h1>
      <p className="mb-6 text-sm text-muted">
        You&apos;ll get an email when a newly approved site matches one of
        these filters.
      </p>

      <div className="space-y-3">
        {searches.map((s) => (
          <div key={s.id} className="rounded-chip border border-line bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">{s.name || "Untitled search"}</span>
              <Button size="sm" variant="ghost" onClick={() => remove(s.id)}>
                Delete
              </Button>
            </div>
            <p className="mb-3 text-sm text-muted">{filtersToSummary(s.filters)}</p>
            <Link
              href={`/dashboard/browse?${filtersToQueryString(s.filters)}`}
              className="text-sm text-brand-violet underline"
            >
              Run this search
            </Link>
          </div>
        ))}
        {!searches.length && (
          <p className="text-muted">
            No saved searches yet — save one from the{" "}
            <Link href="/dashboard/browse" className="underline">
              Browse
            </Link>{" "}
            page.
          </p>
        )}
      </div>
    </div>
  );
}
