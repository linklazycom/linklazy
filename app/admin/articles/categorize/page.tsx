"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BLOG_CATEGORIES, suggestCategory } from "@/lib/blog-categories";

interface ArticleRow {
  id: string;
  title: string;
  target_keyword: string | null;
  category: string | null;
}

export default function BulkCategorizePage() {
  const supabase = createClient();
  const [articles, setArticles] = useState<ArticleRow[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [bulkCategory, setBulkCategory] = useState<string>(BLOG_CATEGORIES[0]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    // "Old, effectively uncategorized" = null OR still sitting on the
    // default "General" bucket — both are fair game to review here.
    const { data } = await supabase
      .from("articles")
      .select("id, title, target_keyword, category")
      .or("category.is.null,category.eq.General")
      .order("title", { ascending: true });

    const rows = (data as ArticleRow[]) ?? [];
    setArticles(rows);
    const initialChoices: Record<string, string> = {};
    rows.forEach((a) => {
      initialChoices[a.id] = suggestCategory(a.title, a.target_keyword);
    });
    setChoices(initialChoices);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyOne(id: string) {
    setSavingId(id);
    setMessage(null);
    const res = await fetch(`/api/articles/${id}/category`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: choices[id] }),
    });
    setSavingId(null);
    if (!res.ok) {
      const body = await res.json();
      setMessage(body.error ?? "Could not save category.");
      return;
    }
    setArticles((prev) => prev.filter((a) => a.id !== id));
  }

  async function applyBulk() {
    const ids = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([id]) => id);
    if (!ids.length) return;

    setBulkSaving(true);
    setMessage(null);
    let failed = 0;
    for (const id of ids) {
      const res = await fetch(`/api/articles/${id}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: bulkCategory }),
      });
      if (!res.ok) failed += 1;
    }
    setBulkSaving(false);
    setMessage(failed ? `${failed} article(s) failed to update.` : `Updated ${ids.length} article(s).`);
    setSelected({});
    load();
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-medium">Bulk-categorize articles</h1>
          <p className="mt-1 text-sm text-muted">
            Articles still on the default &quot;General&quot; category, or with no category at all.
            Suggestions are keyword-based — check them before applying.
          </p>
        </div>
        <Link href="/admin/articles" className="text-sm text-brand-blue underline">
          ← Back to articles
        </Link>
      </div>

      {message && <p className="mb-4 text-sm">{message}</p>}

      {selectedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-chip border border-line bg-white p-3">
          <span className="text-sm">{selectedCount} selected — set all to:</span>
          <select
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            className="rounded-chip border border-line px-2 py-1.5 text-sm"
          >
            {BLOG_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={applyBulk} disabled={bulkSaving}>
            {bulkSaving ? "Applying…" : "Apply to selected"}
          </Button>
        </div>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !articles.length ? (
        <p className="text-muted">
          Nothing left to categorize — every article has a specific category set.
        </p>
      ) : (
        <div className="space-y-2">
          {articles.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-chip border border-line bg-white p-3"
            >
              <input
                type="checkbox"
                checked={!!selected[a.id]}
                onChange={(e) => setSelected((prev) => ({ ...prev, [a.id]: e.target.checked }))}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{a.title}</p>
                {a.target_keyword && (
                  <p className="text-xs text-muted">Keyword: {a.target_keyword}</p>
                )}
              </div>
              <select
                value={choices[a.id] ?? "General"}
                onChange={(e) => setChoices((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="rounded-chip border border-line px-2 py-1.5 text-sm"
              >
                {BLOG_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => applyOne(a.id)} disabled={savingId === a.id}>
                {savingId === a.id ? "Saving…" : "Apply"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
