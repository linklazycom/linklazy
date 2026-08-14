"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface CaseStudyData {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  metric_before: string;
  metric_after: string;
  published: boolean;
}

export function CaseStudyForm({ initial }: { initial?: CaseStudyData }) {
  const router = useRouter();
  const [data, setData] = useState<CaseStudyData>(
    initial ?? {
      slug: "",
      title: "",
      summary: "",
      content: "",
      metric_before: "",
      metric_after: "",
      published: false,
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CaseStudyData>(key: K, value: CaseStudyData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const url = data.id ? `/api/admin/case-studies/${data.id}` : "/api/admin/case-studies";
    const method = data.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not save.");
      setSaving(false);
      return;
    }

    router.push("/admin/case-studies");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <Field
        id="title"
        label="Title"
        required
        value={data.title}
        onChange={(e) => update("title", e.target.value)}
      />
      <Field
        id="slug"
        label="Slug (URL path)"
        required
        placeholder="acme-site-da-growth"
        value={data.slug}
        onChange={(e) => update("slug", e.target.value)}
      />
      <div>
        <label htmlFor="summary" className="mb-1 block text-sm text-muted">
          Summary (shown on the listing page)
        </label>
        <textarea
          id="summary"
          rows={2}
          required
          value={data.summary}
          onChange={(e) => update("summary", e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field
          id="metric_before"
          label="Metric before (optional)"
          placeholder="DA 22"
          value={data.metric_before}
          onChange={(e) => update("metric_before", e.target.value)}
        />
        <Field
          id="metric_after"
          label="Metric after (optional)"
          placeholder="DA 41"
          value={data.metric_after}
          onChange={(e) => update("metric_after", e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="content" className="mb-1 block text-sm text-muted">
          Full story (markdown supported)
        </label>
        <textarea
          id="content"
          rows={12}
          required
          value={data.content}
          onChange={(e) => update("content", e.target.value)}
          className="w-full rounded-chip border border-line px-3 py-2 font-mono text-sm outline-none focus:border-signal"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.published}
          onChange={(e) => update("published", e.target.checked)}
        />
        Published (visible on the public site)
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : data.id ? "Save changes" : "Create case study"}
      </Button>
    </form>
  );
}
