"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

const PROVIDERS = [
  { id: "claude", label: "Claude (Anthropic)", envVar: "ANTHROPIC_API_KEY" },
  { id: "openai", label: "OpenAI", envVar: "OPENAI_API_KEY" },
  { id: "gemini", label: "Gemini (Google)", envVar: "GEMINI_API_KEY" },
] as const;

const SETTINGS_KEY = "ai_niche_detection_providers";
const CONFIDENCE_KEY = "ai_niche_detection_min_confidence";

export default function AiDetectionSettingsPage() {
  const supabase = createClient();
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [minConfidence, setMinConfidence] = useState("40");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [SETTINGS_KEY, CONFIDENCE_KEY]);

      for (const row of data ?? []) {
        if (row.key === SETTINGS_KEY) {
          const list = Array.isArray(row.value) ? (row.value as string[]) : [];
          setEnabled(new Set(list));
        }
        if (row.key === CONFIDENCE_KEY) {
          setMinConfidence(String(row.value ?? "40"));
        }
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggle(id: string) {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await Promise.all([
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SETTINGS_KEY, value: [...enabled] }),
      }),
      fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: CONFIDENCE_KEY, value: minConfidence }),
      }),
    ]);
    setSaving(false);
    setSaved(true);
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="mb-2 font-display text-2xl font-medium">AI niche detection</h1>
      <p className="mb-6 text-sm text-muted">
        When keyword-based niche detection produces low confidence (or nothing at all), the site
        scanner can fall back to an AI provider to classify the page. Turn on one or more
        providers below — with more than one enabled, the majority answer is used and confidence
        reflects how many agreed. Providers without an API key configured in your environment
        variables are silently skipped.
      </p>

      <div className="mb-6 space-y-2">
        {PROVIDERS.map((p) => (
          <label
            key={p.id}
            className="flex items-center justify-between rounded-chip border border-line bg-white p-3 text-sm has-[:checked]:border-signal"
          >
            <span className="flex items-center gap-2">
              <input type="checkbox" checked={enabled.has(p.id)} onChange={() => toggle(p.id)} />
              {p.label}
            </span>
            <span className="font-mono text-xs text-muted">{p.envVar}</span>
          </label>
        ))}
      </div>

      <div className="mb-6">
        <label htmlFor="min_confidence" className="mb-1 block text-sm text-muted">
          Only use AI fallback when keyword confidence is below (%)
        </label>
        <input
          id="min_confidence"
          type="number"
          min={0}
          max={100}
          value={minConfidence}
          onChange={(e) => {
            setMinConfidence(e.target.value);
            setSaved(false);
          }}
          className="w-32 rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </Button>
      {saved && <span className="ml-3 text-sm text-signal">Saved.</span>}

      <p className="mt-6 text-xs text-muted">
        API keys are read from environment variables (Vercel project settings), never stored in
        the database. Add <code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code>, and/or{" "}
        <code>GEMINI_API_KEY</code> there for whichever providers you enable above.
      </p>
    </div>
  );
}
