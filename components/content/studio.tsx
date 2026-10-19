"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { ImageSearch } from "@/components/content/image-search";
import { CONTENT_KINDS, CONTENT_NOTICE, DOC_TITLE_MAX, KIND_DEFS, type ContentKind } from "@/lib/content/kinds";
import { exportFileName } from "@/lib/content/documents";

interface Quote {
  charging: boolean;
  price: number;
  freePerDay: number;
  freeLeftToday: number;
  nextUseCosts: boolean;
  balance: number | null;
}

export interface StudioDoc {
  id: string;
  kind: ContentKind;
  title: string;
  body: string;
  project_id: string | null;
}

const inputClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ContentStudio({ projects, initialDoc }: { projects: { id: string; name: string }[]; initialDoc: StudioDoc | null }) {
  const router = useRouter();
  const [kind, setKind] = useState<ContentKind>(initialDoc?.kind ?? "outreach_email");
  const [values, setValues] = useState<Record<string, string>>({});
  const [projectId, setProjectId] = useState<string>(initialDoc?.project_id ?? "");
  const [body, setBody] = useState(initialDoc?.body ?? "");
  const [title, setTitle] = useState(initialDoc?.title ?? "");
  const [docId, setDocId] = useState<string | null>(initialDoc?.id ?? null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState<"generate" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const def = KIND_DEFS[kind];

  useEffect(() => {
    let alive = true;
    void apiRequest(`/api/usage/quote?action=${def.action}`, "GET").then((res) => {
      if (alive) setQuote(res.ok ? ((res.data?.quote as Quote | undefined) ?? null) : null);
    });
    return () => {
      alive = false;
    };
  }, [def.action]);

  function changeKind(next: ContentKind) {
    setKind(next);
    setValues({});
    setError(null);
    setFieldError(null);
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (body.trim() && !window.confirm("Replace the text in the editor with a new draft?")) return;
    if (quote?.nextUseCosts && !window.confirm(`This costs ৳${quote.price}, taken from your wallet. If we can't deliver a draft you are refunded automatically. Continue?`)) return;
    setBusy("generate");
    setError(null);
    setFieldError(null);
    setMessage(null);
    const res = await apiRequest("/api/content/generate", "POST", {
      kind,
      input: values,
      project_id: projectId || null,
      request_id: crypto.randomUUID(),
      expected_price: quote?.price ?? 0,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      setFieldError(res.field ?? null);
      return;
    }
    const text = typeof res.data?.text === "string" ? res.data.text : "";
    setBody(text);
    if (!title.trim()) {
      const first = def.fields.find((f) => f.type !== "select" && values[f.id]);
      setTitle(`${def.label}${first ? `: ${values[first.id]}` : ""}`.slice(0, DOC_TITLE_MAX));
    }
    setDocId(null); // a new draft is a new document until it is saved
    void apiRequest(`/api/usage/quote?action=${def.action}`, "GET").then((r) => {
      if (r.ok) setQuote((r.data?.quote as Quote | undefined) ?? null);
    });
  }

  async function save() {
    if (busy) return;
    setBusy("save");
    setError(null);
    setMessage(null);
    const res = docId
      ? await apiRequest(`/api/content/documents/${docId}`, "PATCH", { title, body })
      : await apiRequest("/api/content/documents", "POST", { kind, title, body, project_id: projectId || null });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      setFieldError(res.field ?? null);
      return;
    }
    if (!docId && typeof res.data?.id === "string") setDocId(res.data.id);
    setMessage("Saved.");
    router.refresh();
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(body);
      setMessage("Copied.");
    } catch {
      setError("Could not copy. Select the text and copy it by hand.");
    }
  }

  function useForAltText(description: string) {
    changeKind("alt_text");
    setValues({ description });
    setBody("");
    setTitle("");
    setDocId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <p className="rounded-chip border border-line bg-white p-3 text-sm text-muted">{CONTENT_NOTICE}</p>

      <form onSubmit={generate} className="space-y-4 rounded-chip border border-line bg-white p-5">
        <div>
          <label htmlFor="c-kind" className="mb-1 block text-sm text-muted">
            What do you want to write?
          </label>
          <select id="c-kind" value={kind} onChange={(e) => changeKind(e.target.value as ContentKind)} className={inputClass}>
            {CONTENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_DEFS[k].label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted">{def.description}</p>
        </div>

        {projects.length > 0 && (
          <div>
            <label htmlFor="c-project" className="mb-1 block text-sm text-muted">
              Use one of your projects as background (optional)
            </label>
            <select id="c-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={inputClass}>
              <option value="">None</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {def.fields.map((f) => (
          <div key={`${kind}-${f.id}`}>
            <label htmlFor={`c-${f.id}`} className="mb-1 block text-sm text-muted">
              {f.label}
              {f.required ? " *" : ""}
            </label>
            {f.type === "textarea" ? (
              <textarea
                id={`c-${f.id}`}
                rows={4}
                maxLength={f.max}
                value={values[f.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                className={inputClass}
              />
            ) : f.type === "select" ? (
              <select id={`c-${f.id}`} value={values[f.id] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))} className={inputClass}>
                <option value="">{f.required ? "Choose…" : "Default"}</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`c-${f.id}`}
                type="text"
                maxLength={f.max}
                placeholder={f.placeholder}
                value={values[f.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                className={inputClass}
              />
            )}
            {fieldError === f.id && error && <p className="mt-1 text-xs text-red-700">{error}</p>}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy !== null}>
            {busy === "generate" ? "Writing…" : quote?.nextUseCosts ? `Write draft (৳${quote.price})` : "Write draft"}
          </Button>
          {quote?.charging && (
            <p className="text-xs text-muted">
              {quote.freeLeftToday > 0
                ? `Free today: ${quote.freeLeftToday} of ${quote.freePerDay} left. After that each use costs ৳${quote.price} from your wallet.`
                : `Each use costs ৳${quote.price} from your wallet${quote.balance !== null ? ` (your balance: ৳${quote.balance})` : ""}.`}
            </p>
          )}
        </div>
        {error && !fieldError && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </form>

      {(body || docId) && (
        <section className="space-y-3 rounded-chip border border-line bg-white p-5">
          <h2 className="font-display text-lg font-medium">Edit, save, export</h2>
          <div>
            <label htmlFor="c-title" className="mb-1 block text-sm text-muted">
              Title
            </label>
            <input id="c-title" value={title} maxLength={DOC_TITLE_MAX} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="c-body" className="mb-1 block text-sm text-muted">
              Text (plain text or markdown: edit freely)
            </label>
            <textarea id="c-body" rows={18} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} font-mono`} />
          </div>
          <p className="text-xs text-muted">{def.reviewNote}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={save} disabled={busy !== null || !title.trim() || !body.trim()}>
              {busy === "save" ? "Saving…" : docId ? "Save changes" : "Save document"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={copyText}>
              Copy
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={!body.trim()} onClick={() => download(exportFileName(title || def.label, "md"), body, "text/markdown")}>
              Download .md
            </Button>
            <Button type="button" size="sm" variant="secondary" disabled={!body.trim()} onClick={() => download(exportFileName(title || def.label, "txt"), body, "text/plain")}>
              Download .txt
            </Button>
          </div>
          {message && <p className="text-sm text-green-700">{message}</p>}
        </section>
      )}

      <ImageSearch onUseForAltText={useForAltText} />
    </div>
  );
}
