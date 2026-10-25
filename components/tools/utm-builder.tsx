"use client";

import { useMemo, useState } from "react";
import { applyUtm, cleanUtmValue, UTM_KEYS, UTM_PRESETS, type UtmKey, type UtmParams } from "@/lib/links/utm";

const LABELS: Record<UtmKey, string> = { utm_source: "Source (where from)", utm_medium: "Medium (kind of channel)", utm_campaign: "Campaign name", utm_term: "Term (optional)", utm_content: "Content (optional)" };

export function UtmBuilder() {
  const [url, setUrl] = useState("");
  const [params, setParams] = useState<UtmParams>({});
  const [copied, setCopied] = useState(false);

  const built = useMemo(() => {
    if (!url.trim()) return null;
    const clean: UtmParams = {};
    for (const k of UTM_KEYS) clean[k] = cleanUtmValue(params[k]);
    return applyUtm(/^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`, clean);
  }, [url, params]);

  async function copy() {
    if (!built) return;
    try {
      await navigator.clipboard.writeText(built);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the text can still be selected by hand
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-chip border border-line bg-white p-5">
        <label htmlFor="utm-url" className="block text-sm font-medium">Page address</label>
        <input id="utm-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/page" className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
        <div className="flex flex-wrap gap-2 pt-1 text-xs">
          <span className="text-muted">Quick fill:</span>
          {UTM_PRESETS.map((p) => (
            <button key={p.label} type="button" onClick={() => setParams((cur) => ({ ...cur, ...p.params }))} className="rounded-chip border border-line px-2 py-1 hover:bg-paper">{p.label}</button>
          ))}
        </div>
        {UTM_KEYS.map((k) => (
          <div key={k}>
            <label htmlFor={k} className="block text-sm">{LABELS[k]}</label>
            <input id={k} value={params[k] ?? ""} onChange={(e) => setParams((cur) => ({ ...cur, [k]: e.target.value }))} maxLength={100} className="mt-1 w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
          </div>
        ))}
      </div>
      <div className="rounded-chip border border-line bg-paper p-5">
        <p className="mb-2 text-sm font-medium">Your link</p>
        {built ? (
          <>
            <p className="break-all rounded-chip bg-white p-3 text-sm" data-testid="utm-result">{built}</p>
            <button type="button" onClick={copy} className="mt-3 rounded-chip border border-line bg-white px-3 py-1.5 text-sm hover:bg-paper">{copied ? "Copied" : "Copy link"}</button>
          </>
        ) : (
          <p className="text-sm text-muted">Enter a page address to see your tagged link.</p>
        )}
      </div>
      <p className="text-xs text-muted">UTM tags are added to the end of a link so your analytics can show which post or email brought a visitor. Nothing you type here is sent to us; it all happens in your browser.</p>
    </div>
  );
}
