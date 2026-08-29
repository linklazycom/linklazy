"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function SaveSearchButton({ filters }: { filters: Record<string, string | undefined> }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function handleSave() {
    setSaving(true);
    const cleanFilters = Object.fromEntries(
      Object.entries(filters).filter(([k, v]) => k !== "page" && v !== undefined && v !== "")
    );

    await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || undefined, filters: cleanFilters, email_alerts: true }),
    });

    setSaving(false);
    setSaved(true);
    setShowForm(false);
  }

  if (saved) {
    return <p className="text-sm text-signal">Search saved — we&apos;ll email you about new matches.</p>;
  }

  if (showForm) {
    return (
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name this search (optional)"
          className="rounded-chip border border-line px-3 py-1.5 text-sm outline-none focus:border-brand-violet"
        />
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save & get alerts"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="secondary" onClick={() => setShowForm(true)}>
      Save this search
    </Button>
  );
}
