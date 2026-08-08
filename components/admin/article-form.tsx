"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export interface ArticleFormValues {
  id?: string;
  title: string;
  slug: string;
  meta_description: string;
  target_keyword: string;
  content: string;
  status: string;
}

export function ArticleForm({ initial }: { initial?: ArticleFormValues }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      title: form.get("title"),
      slug: form.get("slug"),
      meta_description: form.get("meta_description"),
      target_keyword: form.get("target_keyword"),
      content: form.get("content"),
      status: form.get("status"),
    };

    const url = initial?.id ? `/api/articles/${initial.id}` : "/api/articles";
    const method = initial?.id ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === "string" ? body.error : "Could not save article.");
      setSaving(false);
      return;
    }

    router.push("/admin/articles");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
      <Field id="title" name="title" label="Title" defaultValue={initial?.title} required />
      <Field id="slug" name="slug" label="Slug (URL path)" defaultValue={initial?.slug} placeholder="how-to-vet-a-backlink-site" required />
      <Field
        id="target_keyword"
        name="target_keyword"
        label="Target keyword (low-competition)"
        defaultValue={initial?.target_keyword}
      />
      <div>
        <label htmlFor="meta_description" className="mb-1 block text-sm text-muted">
          Meta description
        </label>
        <textarea
          id="meta_description"
          name="meta_description"
          rows={2}
          defaultValue={initial?.meta_description}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
        />
      </div>
      <div>
        <label htmlFor="content" className="mb-1 block text-sm text-muted">
          Content (Markdown)
        </label>
        <textarea
          id="content"
          name="content"
          rows={16}
          defaultValue={initial?.content}
          className="w-full rounded-chip border border-line px-3 py-2 font-mono text-sm outline-none focus:border-signal"
          required
        />
      </div>
      <div>
        <label htmlFor="status" className="mb-1 block text-sm text-muted">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={initial?.status ?? "draft"}
          className="w-full rounded-chip border border-line px-3 py-2 text-sm"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save article"}
      </Button>
    </form>
  );
}
