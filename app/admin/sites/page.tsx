"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface SiteRow {
  id: string;
  domain: string;
  niche: string;
  status: string;
  da: number | null;
  dr: number | null;
  dr_verified: number | null;
  dr_check_status: string | null;
  organic_traffic: number | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
}

const STATUSES = ["all", "pending", "approved", "rejected", "suspended"];

const STATUS_TONE: Record<string, "default" | "verified" | "price"> = {
  approved: "verified",
  rejected: "price",
  suspended: "price",
  pending: "default",
};

export default function AdminSitesPage() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), status });
    if (search.trim()) params.set("q", search.trim());
    const res = await fetch(`/api/admin/sites?${params.toString()}`);
    const body = await res.json();
    setSites(body.sites ?? []);
    setTotalPages(body.totalPages ?? 1);
    setTotal(body.total ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status]);

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-medium">All sites</h1>
        <div className="flex items-center gap-2">
          <Link href="/admin/sites/new">
            <Button size="sm">List a site</Button>
          </Link>
          <Link href="/admin/sites/bulk-import">
            <Button size="sm" variant="secondary">Bulk import (CSV)</Button>
          </Link>
          <form onSubmit={runSearch} className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain or niche"
            className="rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-signal"
          />
          <Button type="submit" size="sm" variant="secondary">
            Search
          </Button>
        </form>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`rounded-chip border px-3 py-1.5 text-sm capitalize ${
              status === s ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-muted">
            {total} site{total === 1 ? "" : "s"} · page {page} of {totalPages}
          </p>

          <div className="space-y-3">
            {sites.map((site) => (
              <Link
                key={site.id}
                href={`/admin/sites/${site.id}`}
                className="block rounded-chip border border-line bg-white p-4 hover:border-ink"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{site.domain}</span>
                    <span className="ml-2 text-xs text-muted">
                      by {site.profiles?.full_name || "(no name)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MetricChip
                      label="Status"
                      value={site.status}
                      tone={STATUS_TONE[site.status] ?? "default"}
                    />
                    <span className="text-xs text-muted">
                      {new Date(site.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <MetricChip label="Niche" value={site.niche} />
                  {site.da != null && <MetricChip label="DA" value={site.da} />}
                  {site.dr_verified != null ? (
                    <MetricChip label="DR" value={site.dr_verified} tone="verified" />
                  ) : (
                    site.dr != null && <MetricChip label="DR" value={site.dr} />
                  )}
                  {site.dr_check_status === "failed" && (
                    <MetricChip label="DR check" value="failed" tone="price" />
                  )}
                  {site.organic_traffic != null && (
                    <MetricChip label="Traffic" value={`${site.organic_traffic}/mo`} />
                  )}
                </div>
              </Link>
            ))}
            {!sites.length && <p className="text-muted">No sites match this view.</p>}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted">
                {page} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
