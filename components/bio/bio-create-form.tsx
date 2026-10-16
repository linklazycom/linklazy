"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export function BioCreateForm({ siteUrl }: { siteUrl: string }) {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(undefined);
    const res = await apiRequest("/api/bio", "POST", { slug, display_name: name });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    const page = res.data?.page as { id?: string } | undefined;
    router.push(page?.id ? `/dashboard/bio/${page.id}` : "/dashboard/bio");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-chip border border-line bg-white p-5">
      <h2 className="font-display text-lg font-medium">Create a bio page</h2>
      <Field id="display_name" label="Display name" placeholder="Your name or brand" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required />
      <div>
        <Field id="slug" label="Page address" placeholder="your-name" value={slug} onChange={(e) => setSlug(e.target.value)} hint={`${siteUrl}/bio/${slug.trim().toLowerCase() || "your-name"}`} required />
        {errorField === "slug" && error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
      {error && errorField !== "slug" && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create page"}
      </Button>
    </form>
  );
}
