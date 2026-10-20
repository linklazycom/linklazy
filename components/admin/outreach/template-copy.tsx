"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TemplateCopy({ subjects, html, text }: { subjects: string[]; html: string; text: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setError(null);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    } catch {
      setError("Could not copy. Select the text and copy it by hand.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-chip border border-line bg-white p-5">
        <h2 className="font-display text-lg font-medium">Subject lines (pick one)</h2>
        <ul className="space-y-2 text-sm">
          {subjects.map((s, i) => (
            <li key={s} className="flex flex-wrap items-center gap-2">
              <code className="rounded-chip bg-brand-soft px-2 py-1">{s}</code>
              <button type="button" className="text-xs underline" onClick={() => copy(`s${i}`, s)}>{copied === `s${i}` ? "Copied" : "Copy"}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-chip border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">Preview</h2>
          <p className="text-xs text-muted">The {"{{…}}"} parts are replaced for each person when Saleshandy sends.</p>
        </div>
        <iframe title="Email preview" srcDoc={html} sandbox="" className="h-[620px] w-full rounded-chip border border-line bg-white" />
      </section>

      <section className="space-y-2 rounded-chip border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">HTML version</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => copy("html", html)}>{copied === "html" ? "Copied" : "Copy HTML"}</Button>
        </div>
        <textarea readOnly aria-label="HTML email" rows={10} value={html} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-chip border border-line bg-white p-3 font-mono text-xs" />
      </section>

      <section className="space-y-2 rounded-chip border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">Plain-text version</h2>
          <Button type="button" size="sm" variant="secondary" onClick={() => copy("text", text)}>{copied === "text" ? "Copied" : "Copy text"}</Button>
        </div>
        <textarea readOnly aria-label="Plain text email" rows={12} value={text} onFocus={(e) => e.currentTarget.select()} className="w-full rounded-chip border border-line bg-white p-3 font-mono text-xs" />
      </section>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
