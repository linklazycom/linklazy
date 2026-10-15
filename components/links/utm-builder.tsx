"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { applyUtm, readUtm, UTM_PRESETS, type UtmParams } from "@/lib/links/utm";

function normalize(url: string): string {
  const t = url.trim();
  if (!t) return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
}

/** Builds a destination URL with UTM tags. Used in the create/edit forms (and reusable for the free /tools UTM builder later). */
export function UtmBuilder({ url, onApply }: { url: string; onApply: (url: string) => void }) {
  const [params, setParams] = useState<UtmParams>(() => readUtm(normalize(url)));
  const base = normalize(url);
  const preview = base ? applyUtm(base, params) : null;

  function set(key: keyof UtmParams, value: string) {
    setParams((p) => ({ ...p, [key]: value }));
  }

  return (
    <div className="space-y-3 rounded-chip border border-line bg-paper p-4">
      <div>
        <p className="mb-2 text-sm font-medium">Quick presets</p>
        <div className="flex flex-wrap gap-2">
          {UTM_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setParams((cur) => ({ ...cur, ...p.params }))}
              className="rounded-chip border border-line bg-white px-2.5 py-1 text-xs hover:bg-brand-soft"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="utm_source" label="Source (where from)" placeholder="newsletter" value={params.utm_source ?? ""} onChange={(e) => set("utm_source", e.target.value)} />
        <Field id="utm_medium" label="Medium (kind of traffic)" placeholder="email" value={params.utm_medium ?? ""} onChange={(e) => set("utm_medium", e.target.value)} />
        <Field id="utm_campaign" label="Campaign" placeholder="spring_sale" value={params.utm_campaign ?? ""} onChange={(e) => set("utm_campaign", e.target.value)} />
        <Field id="utm_term" label="Term (optional)" value={params.utm_term ?? ""} onChange={(e) => set("utm_term", e.target.value)} />
        <Field id="utm_content" label="Content (optional)" value={params.utm_content ?? ""} onChange={(e) => set("utm_content", e.target.value)} />
      </div>
      <div>
        <p className="mb-1 text-xs text-muted">Result</p>
        <p className="break-all rounded-chip border border-line bg-white p-2 font-mono text-xs">
          {preview ?? "Enter a destination URL above first."}
        </p>
      </div>
      <Button type="button" size="sm" disabled={!preview} onClick={() => preview && onApply(preview)}>
        Use this URL
      </Button>
    </div>
  );
}
