"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface FooterLink {
  label: string;
  href: string;
}

type FooterColumns = Record<string, FooterLink[]>;

export function FooterLinksEditor({ initialColumns }: { initialColumns: FooterColumns }) {
  const [columns, setColumns] = useState<FooterColumns>(initialColumns);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateLink(column: string, index: number, field: keyof FooterLink, value: string) {
    setColumns((prev) => ({
      ...prev,
      [column]: prev[column].map((l, i) => (i === index ? { ...l, [field]: value } : l)),
    }));
    setSaved(false);
  }

  function removeLink(column: string, index: number) {
    setColumns((prev) => ({ ...prev, [column]: prev[column].filter((_, i) => i !== index) }));
    setSaved(false);
  }

  function addLink(column: string) {
    setColumns((prev) => ({ ...prev, [column]: [...prev[column], { label: "", href: "/" }] }));
    setSaved(false);
  }

  function renameColumn(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) return;
    setColumns((prev) => {
      const next: FooterColumns = {};
      for (const [name, links] of Object.entries(prev)) {
        next[name === oldName ? newName : name] = links;
      }
      return next;
    });
    setSaved(false);
  }

  function removeColumn(column: string) {
    setColumns((prev) => {
      const next = { ...prev };
      delete next[column];
      return next;
    });
    setSaved(false);
  }

  function addColumn() {
    let name = "New column";
    let n = 2;
    while (columns[name]) {
      name = `New column ${n}`;
      n++;
    }
    setColumns((prev) => ({ ...prev, [name]: [] }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const cleaned: FooterColumns = {};
    for (const [column, links] of Object.entries(columns)) {
      const trimmedName = column.trim();
      if (!trimmedName) continue;
      cleaned[trimmedName] = links.filter((l) => l.label.trim() && l.href.trim());
    }

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "footer_links", value: cleaned }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Could not save footer links.");
      setSaving(false);
      return;
    }

    setColumns(cleaned);
    setSaving(false);
    setSaved(true);
  }

  return (
    <div>
      <div className="mb-4 grid gap-6 sm:grid-cols-2">
        {Object.entries(columns).map(([column, links]) => (
          <div key={column} className="rounded-chip border border-line p-3">
            <div className="mb-2 flex items-center gap-2">
              <input
                value={column}
                onChange={(e) => renameColumn(column, e.target.value)}
                className="flex-1 rounded-chip border border-line px-2 py-1.5 text-sm font-medium outline-none focus:border-signal"
              />
              <button
                type="button"
                onClick={() => removeColumn(column)}
                aria-label="Remove column"
                className="flex h-7 w-7 items-center justify-center rounded-chip border border-line text-xs text-red-600"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    value={link.label}
                    onChange={(e) => updateLink(column, i, "label", e.target.value)}
                    placeholder="Label"
                    className="w-24 rounded-chip border border-line px-2 py-1.5 text-xs outline-none focus:border-signal"
                  />
                  <input
                    value={link.href}
                    onChange={(e) => updateLink(column, i, "href", e.target.value)}
                    placeholder="/path"
                    className="flex-1 rounded-chip border border-line px-2 py-1.5 text-xs outline-none focus:border-signal"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(column, i)}
                    aria-label="Remove link"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-chip border border-line text-xs text-red-600"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {!links.length && <p className="text-xs text-muted">No links in this column.</p>}
            </div>
            <button
              type="button"
              onClick={() => addLink(column)}
              className="mt-2 text-xs font-medium text-brand-violet"
            >
              + Add link
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={addColumn}>
          + Add column
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save footer links"}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
