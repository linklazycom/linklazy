"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

export interface TestimonialRow {
  id: string;
  author_name: string;
  author_role: string | null;
  author_site: string | null;
  quote: string;
  source_note: string | null;
  consent_confirmed: boolean;
  is_published: boolean;
  sort_order: number;
}

const input = "w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal";

export function TestimonialManager({ rows }: { rows: TestimonialRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ author_name: "", author_role: "", author_site: "", quote: "", source_note: "", consent_confirmed: false, is_published: false });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy("add");
    setError(null);
    const res = await apiRequest("/api/admin/testimonials", "POST", { ...form, sort_order: 0 });
    setBusy(null);
    if (!res.ok) return setError(res.error);
    setForm({ author_name: "", author_role: "", author_site: "", quote: "", source_note: "", consent_confirmed: false, is_published: false });
    router.refresh();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    if (busy) return;
    setBusy(id);
    setError(null);
    const res = await apiRequest(`/api/admin/testimonials/${id}`, "PATCH", body);
    setBusy(null);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  async function remove(id: string) {
    if (busy || !window.confirm("Delete this testimonial for good?")) return;
    setBusy(id);
    setError(null);
    const res = await apiRequest(`/api/admin/testimonials/${id}`, "DELETE");
    setBusy(null);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="space-y-3 rounded-chip border border-line bg-white p-5">
        <h2 className="font-display text-lg font-medium">নতুন testimonial যোগ করুন</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="t-name" className="mb-1 block text-sm text-muted">Name *</label><input id="t-name" className={input} value={form.author_name} maxLength={80} onChange={(e) => setForm({ ...form, author_name: e.target.value })} /></div>
          <div><label htmlFor="t-role" className="mb-1 block text-sm text-muted">Role / title (optional)</label><input id="t-role" className={input} value={form.author_role} maxLength={120} onChange={(e) => setForm({ ...form, author_role: e.target.value })} /></div>
          <div className="sm:col-span-2"><label htmlFor="t-site" className="mb-1 block text-sm text-muted">Website (optional)</label><input id="t-site" className={input} value={form.author_site} maxLength={200} onChange={(e) => setForm({ ...form, author_site: e.target.value })} /></div>
        </div>
        <div>
          <label htmlFor="t-quote" className="mb-1 block text-sm text-muted">What they said * (10–600 characters, their own words)</label>
          <textarea id="t-quote" rows={3} className={input} value={form.quote} maxLength={600} onChange={(e) => setForm({ ...form, quote: e.target.value })} />
        </div>
        <div>
          <label htmlFor="t-note" className="mb-1 block text-sm text-muted">Where it came from (private note: email date, message link…)</label>
          <input id="t-note" className={input} value={form.source_note} maxLength={300} onChange={(e) => setForm({ ...form, source_note: e.target.value })} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={form.consent_confirmed} onChange={(e) => setForm({ ...form, consent_confirmed: e.target.checked, is_published: e.target.checked ? form.is_published : false })} />
          <span>এই ব্যক্তি লিখিতভাবে/স্পষ্টভাবে সাইটে তার নাম ও কথা প্রকাশের অনুমতি দিয়েছেন (আমি নিশ্চিত)</span>
        </label>
        <label className={`flex items-center gap-2 text-sm ${form.consent_confirmed ? "" : "opacity-50"}`}>
          <input type="checkbox" disabled={!form.consent_confirmed} checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
          এখনই প্রকাশ করুন
        </label>
        <Button type="submit" disabled={busy !== null}>{busy === "add" ? "Saving…" : "Save testimonial"}</Button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {rows.length === 0 ? (
        <p className="rounded-chip border border-line bg-white p-4 text-sm text-muted">এখনো কোনো testimonial নেই। সত্যিকারের ব্যবহারকারীর অনুমতি পেলে এখানে যোগ করুন; তার আগে সাইটে এই অংশ দেখানো হয় না।</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-chip border border-line bg-white p-4 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{r.author_name}{r.author_role ? <span className="font-normal text-muted"> · {r.author_role}</span> : null}</p>
                  {r.author_site ? <p className="text-xs text-muted">{r.author_site}</p> : null}
                </div>
                <span className={`rounded-chip px-2 py-0.5 text-xs ${r.is_published ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"}`}>{r.is_published ? "Published" : "Draft"}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">“{r.quote}”</p>
              {r.source_note ? <p className="mt-1 text-xs text-muted">Source: {r.source_note}</p> : null}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!r.consent_confirmed && (
                  <button type="button" disabled={busy !== null} className="rounded-chip border border-line px-2 py-1" onClick={() => window.confirm("এই ব্যক্তি প্রকাশের অনুমতি দিয়েছেন — নিশ্চিত?") && patch(r.id, { consent_confirmed: true })}>Confirm permission</button>
                )}
                <button type="button" disabled={busy !== null || !r.consent_confirmed} title={r.consent_confirmed ? "" : "আগে অনুমতি নিশ্চিত করুন"} className="rounded-chip border border-line px-2 py-1 disabled:opacity-50" onClick={() => patch(r.id, { is_published: !r.is_published })}>
                  {r.is_published ? "Unpublish" : "Publish"}
                </button>
                <button type="button" disabled={busy !== null} className="rounded-chip border border-line px-2 py-1 text-red-700" onClick={() => remove(r.id)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
