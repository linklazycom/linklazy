"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface NavLink {
  label: string;
  href: string;
}

export function NavLinksEditor({ initialLinks }: { initialLinks: NavLink[] }) {
  const [links, setLinks] = useState<NavLink[]>(initialLinks);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLink(index: number, field: keyof NavLink, value: string) {
    setLinks((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
    setSaved(false);
  }

  function removeLink(index: number) {
    setLinks((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  }

  function addLink() {
    setLinks((prev) => [...prev, { label: "", href: "/" }]);
    setSaved(false);
  }

  function moveLink(index: number, direction: -1 | 1) {
    setLinks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const cleaned = links.filter((l) => l.label.trim() && l.href.trim());

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "nav_links", value: cleaned }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not save nav links.");
      setSaving(false);
      return;
    }

    setLinks(cleaned);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2">
        {links.map((link, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={link.label}
              onChange={(e) => updateLink(i, "label", e.target.value)}
              placeholder="Label"
              className="w-32 rounded-chip border border-line px-2 py-1.5 text-sm outline-none focus:border-signal"
            />
            <input
              value={link.href}
              onChange={(e) => updateLink(i, "href", e.target.value)}
              placeholder="/path"
              className="flex-1 rounded-chip border border-line px-2 py-1.5 text-sm outline-none focus:border-signal"
            />
            <button
              type="button"
              onClick={() => moveLink(i, -1)}
              disabled={i === 0}
              aria-label="Move up"
              className="flex h-7 w-7 items-center justify-center rounded-chip border border-line text-xs disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveLink(i, 1)}
              disabled={i === links.length - 1}
              aria-label="Move down"
              className="flex h-7 w-7 items-center justify-center rounded-chip border border-line text-xs disabled:opacity-30"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => removeLink(i)}
              aria-label="Remove"
              className="flex h-7 w-7 items-center justify-center rounded-chip border border-line text-xs text-red-600"
            >
              ✕
            </button>
          </div>
        ))}
        {!links.length && <p className="text-sm text-muted">No nav links yet.</p>}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addLink}>
          + Add link
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save nav links"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
