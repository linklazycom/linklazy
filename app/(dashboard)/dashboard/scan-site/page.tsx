"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { Money } from "@/components/currency/money";
import { NICHES } from "@/lib/niches";

interface MatchedSite {
  id: string;
  domain: string;
  niche: string;
  dr: number | null;
  da: number | null;
  price_amount: number | null;
  turnaround_hours: number | null;
  owner_id: string;
  accepts_paid: boolean;
  relevance_overlap: number | null;
}

interface AutoOrderResult {
  placed: boolean;
  createdOrderIds: string[];
  skipped: { domain: string; reason: string }[];
  newBalance?: number;
  error?: string;
}

interface ScanResponse {
  scanId: string;
  detectedNiche: string;
  confidence: number;
  matchedKeywords: string[];
  sites: MatchedSite[];
  autoOrder: AutoOrderResult | null;
}

const MAX_SELECT = 10;

export default function ScanSitePage() {
  const router = useRouter();

  const [url, setUrl] = useState("");
  const [autoOrderEnabled, setAutoOrderEnabled] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [anchorText, setAnchorText] = useState("");
  const [maxBudget, setMaxBudget] = useState("");
  const [maxSites, setMaxSites] = useState("");

  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNicheList, setShowNicheList] = useState(false);
  const [scan, setScan] = useState<ScanResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function runScan(manualNiche?: string) {
    setScanning(true);
    setError(null);
    setScan(null);

    if (autoOrderEnabled && (!targetUrl || !anchorText)) {
      setError("Target URL and anchor text are required to enable auto-order.");
      setScanning(false);
      return;
    }

    const res = await fetch("/api/buyer-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        auto_order: autoOrderEnabled,
        target_url: autoOrderEnabled ? targetUrl : undefined,
        anchor_text: autoOrderEnabled ? anchorText : undefined,
        max_budget: maxBudget ? Number(maxBudget) : undefined,
        max_sites: maxSites ? Number(maxSites) : undefined,
        manual_niche: manualNiche,
      }),
    });

    setScanning(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === "string" ? body.error : "Scan failed.");
      // Detection failed (or this was already a manual retry that still
      // failed for another reason) — offer the manual niche picker.
      setShowNicheList(true);
      return;
    }

    setShowNicheList(false);
    const data = (await res.json()) as ScanResponse;
    setScan(data);
    // Pre-select every matched site that can actually be paid-ordered —
    // exchange-only (accepts_paid=false) sites still show in the list
    // for visibility, but can't go into a wallet/bKash/PayPal bulk order.
    setSelected(new Set(data.sites.filter((s) => s.accepts_paid).map((s) => s.id)));
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    await runScan();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < MAX_SELECT) {
        next.add(id);
      }
      return next;
    });
  }

  function goToBulkOrder() {
    router.push(`/dashboard/browse/bulk-order?ids=${[...selected].join(",")}`);
  }

  const selectedTotal = (scan?.sites ?? [])
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + (s.price_amount ?? 0), 0);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-2 font-display text-2xl font-medium">Scan your site for matching link opportunities</h1>
      <p className="mb-6 text-sm text-muted">
        Submit your site&apos;s URL and we&apos;ll detect its niche, then show you which sites in
        our marketplace are the best fit to buy backlinks from.
      </p>

      <form onSubmit={handleScan} className="mb-8 space-y-4 rounded-chip border border-line bg-white p-5">
        <div>
          <label htmlFor="scan_url" className="mb-1 block text-sm text-muted">
            Your site URL
          </label>
          <input
            id="scan_url"
            type="url"
            required
            placeholder="https://yoursite.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoOrderEnabled}
            onChange={(e) => setAutoOrderEnabled(e.target.checked)}
          />
          Auto-place orders after scanning (pays from wallet balance automatically)
        </label>

        {autoOrderEnabled && (
          <div className="space-y-4 rounded-chip border border-line bg-canvas p-4">
            <div>
              <label htmlFor="target_url" className="mb-1 block text-sm text-muted">
                Target URL (the page you want linked to)
              </label>
              <input
                id="target_url"
                type="url"
                required={autoOrderEnabled}
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div>
              <label htmlFor="anchor_text" className="mb-1 block text-sm text-muted">
                Anchor text
              </label>
              <input
                id="anchor_text"
                required={autoOrderEnabled}
                maxLength={200}
                value={anchorText}
                onChange={(e) => setAnchorText(e.target.value)}
                className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="max_budget" className="mb-1 block text-sm text-muted">
                  Max budget (optional)
                </label>
                <input
                  id="max_budget"
                  type="number"
                  min={1}
                  value={maxBudget}
                  onChange={(e) => setMaxBudget(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
                />
              </div>
              <div>
                <label htmlFor="max_sites" className="mb-1 block text-sm text-muted">
                  Max sites (optional, up to 10)
                </label>
                <input
                  id="max_sites"
                  type="number"
                  min={1}
                  max={10}
                  value={maxSites}
                  onChange={(e) => setMaxSites(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
                />
              </div>
            </div>
            <p className="text-xs text-muted">
              Orders are only auto-placed using your wallet balance. If your balance runs out
              partway, the sites that fit are ordered and the rest are skipped — nothing is
              charged to bKash/PayPal automatically.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-chip border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <p className="mb-2">{error}</p>
            {showNicheList && (
              <div className="flex flex-wrap gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => runScan(n)}
                    className="rounded-chip border border-red-300 bg-white px-2 py-1 text-xs text-red-700 hover:border-red-500"
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Button type="submit" disabled={scanning}>
          {scanning ? "Scanning…" : "Scan site"}
        </Button>
      </form>

      {scan && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <MetricChip label="Detected niche" value={scan.detectedNiche} tone="verified" />
            <MetricChip label="Confidence" value={`${scan.confidence}%`} />
            <button
              type="button"
              onClick={() => setShowNicheList((v) => !v)}
              className="text-sm text-muted underline"
            >
              Wrong niche?
            </button>
          </div>

          {showNicheList && (
            <div className="mb-4 flex flex-wrap gap-2 rounded-chip border border-line bg-canvas p-3">
              {NICHES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => runScan(n)}
                  className={`rounded-chip border px-2 py-1 text-xs ${
                    n === scan.detectedNiche
                      ? "border-signal bg-signal-soft"
                      : "border-line bg-white hover:border-signal"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {scan.autoOrder && (
            <div
              className={`mb-6 rounded-chip border p-4 text-sm ${
                scan.autoOrder.placed
                  ? "border-signal/40 bg-signal-soft"
                  : "border-amber/40 bg-amber-soft"
              }`}
            >
              <p className="mb-2 font-medium">
                {scan.autoOrder.error
                  ? "Auto-order couldn't run"
                  : scan.autoOrder.createdOrderIds.length > 0
                    ? `Auto-order placed: ${scan.autoOrder.createdOrderIds.length} order(s)`
                    : "Auto-order didn't place anything"}
              </p>
              {scan.autoOrder.error && <p>{scan.autoOrder.error}</p>}
              {scan.autoOrder.skipped.length > 0 && (
                <div className="mt-2 space-y-1">
                  {scan.autoOrder.skipped.map((s, i) => (
                    <p key={i} className="text-muted">
                      {s.domain} — {s.reason}
                    </p>
                  ))}
                </div>
              )}
              {scan.autoOrder.createdOrderIds.length > 0 && (
                <Link href="/dashboard/orders" className="mt-2 inline-block underline">
                  View orders →
                </Link>
              )}
            </div>
          )}

          <p className="mb-3 text-sm text-muted">
            {scan.sites.length} approved site{scan.sites.length === 1 ? "" : "s"} found in this niche.
            Sites marked &quot;Exchange only&quot; don&apos;t accept paid orders and can&apos;t be
            added to a bulk order. Deselect any you don&apos;t want, then review your order.
          </p>

          <div className="mb-24 space-y-2">
            {scan.sites.map((s) => (
              <label
                key={s.id}
                className={`flex items-center justify-between rounded-chip border border-line bg-white p-3 text-sm has-[:checked]:border-signal ${
                  !s.accepts_paid ? "opacity-60" : ""
                }`}
              >
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggle(s.id)}
                    disabled={!s.accepts_paid || (!selected.has(s.id) && selected.size >= MAX_SELECT)}
                  />
                  <span className="font-mono font-medium">{s.domain}</span>
                  {!s.accepts_paid && (
                    <span className="rounded-chip bg-canvas px-2 py-0.5 text-xs text-muted">
                      Exchange only
                    </span>
                  )}
                  {s.relevance_overlap != null && s.relevance_overlap > 0 && (
                    <span className="rounded-chip bg-signal-soft px-2 py-0.5 text-xs text-signal">
                      {s.relevance_overlap} keyword match{s.relevance_overlap > 1 ? "es" : ""}
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-2">
                  {s.dr != null && <MetricChip label="DR" value={s.dr} />}
                  {s.price_amount != null && <MetricChip label="Price" value={s.price_amount} tone="price" />}
                </span>
              </label>
            ))}
            {!scan.sites.length && (
              <p className="text-sm text-muted">No approved sites currently match this niche.</p>
            )}
          </div>

          {selected.size > 0 && (
            <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-line bg-white p-4 shadow-lg md:left-64">
              <div className="mx-auto flex max-w-5xl items-center justify-between">
                <p className="text-sm">
                  {selected.size} site{selected.size > 1 ? "s" : ""} selected (max {MAX_SELECT}) —{" "}
                  <Money amount={selectedTotal} />
                </p>
                <Button size="sm" onClick={goToBulkOrder}>
                  Review & order →
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
