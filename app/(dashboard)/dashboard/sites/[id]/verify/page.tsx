"use client";

import { useEffect, useState, use as usePromise } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

interface Verification {
  id: string;
  method: string;
  token: string;
  status: string;
}

export default function VerifySitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = usePromise(params);
  const supabase = createClient();
  const [siteUrl, setSiteUrl] = useState("");
  const [siteStatus, setSiteStatus] = useState("pending");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    async function load() {
      const { data: site } = await supabase
        .from("sites")
        .select("url, status")
        .eq("id", id)
        .single();
      if (site) {
        setSiteUrl(site.url);
        setSiteStatus(site.status);
      }

      const { data: v } = await supabase
        .from("site_verifications")
        .select("id, method, token, status")
        .eq("site_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      setVerification(v as Verification);
    }
    load();
  }, [id, supabase]);

  async function handleCheck() {
    setChecking(true);
    setResult(null);
    const res = await fetch(`/api/sites/${id}/verify`, { method: "POST" });
    const body = await res.json();
    setResult(body);
    setChecking(false);
    if (body.ok) {
      setVerification((prev) => (prev ? { ...prev, status: "verified" } : prev));
    }
  }

  const domain = siteUrl ? new URL(siteUrl).origin : "";

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 font-display text-2xl font-medium">Verify ownership</h1>
      <p className="mb-6 text-sm text-muted">
        We need to confirm you actually control this site before it goes to
        review. Add the tag below to your homepage, then run the check.
      </p>

      <div className="mb-6 flex items-center gap-2">
        <MetricChip label="Listing status" value={siteStatus} tone={siteStatus === "approved" ? "verified" : "price"} />
        {verification && (
          <MetricChip
            label="Ownership"
            value={verification.status}
            tone={verification.status === "verified" ? "verified" : "default"}
          />
        )}
      </div>

      {verification && (
        <div className="mb-6 rounded-chip border border-line bg-white p-5">
          <h2 className="mb-2 text-sm font-medium">Step 1 — Add this meta tag</h2>
          <p className="mb-3 text-sm text-muted">
            Paste this inside the <code>&lt;head&gt;</code> section of {domain || "your homepage"}:
          </p>
          <pre className="overflow-x-auto rounded-chip bg-ink p-3 font-mono text-xs text-paper">
{`<meta name="linklazy-site-verification" content="${verification.token}" />`}
          </pre>
          <p className="mt-3 text-xs text-muted">
            Prefer a different method? DNS TXT and file-upload verification are
            also supported — contact support to switch methods for this listing.
          </p>
        </div>
      )}

      <div className="mb-4">
        <h2 className="mb-2 text-sm font-medium">Step 2 — Run the check</h2>
        <Button onClick={handleCheck} disabled={checking || verification?.status === "verified"}>
          {checking
            ? "Checking…"
            : verification?.status === "verified"
              ? "Verified"
              : "Check now"}
        </Button>
      </div>

      {result && (
        <p className={`text-sm ${result.ok ? "text-signal" : "text-red-600"}`}>
          {result.message}
        </p>
      )}

      {verification?.status === "verified" && (
        <p className="mt-4 text-sm text-muted">
          Ownership verified. Your listing is now waiting for admin review —
          you&apos;ll be notified once it&apos;s approved and visible in the
          directory.
        </p>
      )}
    </div>
  );
}
