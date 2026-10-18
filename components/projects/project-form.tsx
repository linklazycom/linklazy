"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { COUNTRIES, LANGUAGES } from "@/lib/projects/options";
import { NICHES } from "@/lib/niches";

export interface ProjectFormValues {
  name: string;
  url: string;
  description: string;
  niche: string;
  country: string;
  language: string;
  keywords: string; // one per line
  competitors: string; // one per line
  notes: string;
}

export const EMPTY_PROJECT: ProjectFormValues = { name: "", url: "", description: "", niche: "", country: "", language: "", keywords: "", competitors: "", notes: "" };

interface Suggestion {
  niche: string | null;
  keywords: string[];
}

/** What the next AI suggestion costs this user (from /api/usage/quote). */
interface Quote {
  charging: boolean;
  price: number;
  freePerDay: number;
  freeLeftToday: number;
  nextUseCosts: boolean;
  balance: number | null;
}

const TEXTAREA = "w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal";
const SELECT = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

function mergeLines(current: string, extra: string[]): string {
  const have = new Set(current.split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean));
  const add = extra.filter((k) => !have.has(k.toLowerCase()));
  const base = current.trim();
  return [base, ...add].filter(Boolean).join("\n");
}

export function ProjectForm({ mode, projectId, initial, maxKeywords }: { mode: "create" | "edit"; projectId?: string; initial: ProjectFormValues; maxKeywords: number }) {
  const router = useRouter();
  const [v, setV] = useState<ProjectFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [needsTopUp, setNeedsTopUp] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);

  const loadQuote = useCallback(async () => {
    const res = await apiRequest("/api/usage/quote?action=project_ai_suggest", "GET");
    if (res.ok) setQuote((res.data?.quote as Quote | undefined) ?? null);
  }, []);
  useEffect(() => {
    let alive = true;
    void apiRequest("/api/usage/quote?action=project_ai_suggest", "GET").then((res) => {
      if (alive && res.ok) setQuote((res.data?.quote as Quote | undefined) ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };
  const fieldErr = (f: string) => (errorField === f && error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null);
  const keywordCount = v.keywords.split(/[\n,;]+/).filter((k) => k.trim()).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrorField(undefined);
    setSaved(false);
    const res =
      mode === "create"
        ? await apiRequest("/api/projects", "POST", v)
        : await apiRequest(`/api/projects/${projectId}`, "PATCH", v);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setErrorField(res.field);
      return;
    }
    const project = res.data?.project as { id?: string } | undefined;
    if (mode === "create") {
      router.push(project?.id ? `/dashboard/projects/${project.id}` : "/dashboard/projects");
    } else {
      setSaved(true);
    }
    router.refresh();
  }

  async function askForSuggestions() {
    // The price is shown BEFORE any payment, and the server only ever charges the price it decides itself.
    if (quote?.nextUseCosts && !window.confirm(`This suggestion costs ৳${quote.price}, taken from your wallet. If we can't deliver suggestions you are refunded automatically. Continue?`)) return;
    setSuggesting(true);
    setSuggestError(null);
    setNeedsTopUp(false);
    setSuggestion(null);
    const res = await apiRequest("/api/projects/suggest", "POST", {
      name: v.name,
      url: v.url,
      description: v.description,
      request_id: crypto.randomUUID(),
      expected_price: quote?.price ?? 0,
    });
    setSuggesting(false);
    if (!res.ok) {
      setSuggestError(res.error);
      if (res.data?.code === "insufficient") setNeedsTopUp(true);
      if (res.data?.code === "price_changed") void loadQuote();
      return;
    }
    setSuggestion((res.data?.suggestion as Suggestion | undefined) ?? null);
    void loadQuote();
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-chip border border-line bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field id="name" label="Project name" placeholder="My online shop" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} required />
          {fieldErr("name")}
        </div>
        <div>
          <Field id="url" label="Website address" placeholder="https://example.com" value={v.url} onChange={(e) => set("url", e.target.value)} required />
          {fieldErr("url")}
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm text-muted">
          What is this website about?
        </label>
        <textarea id="description" rows={3} maxLength={1000} className={TEXTAREA} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="A few sentences: what you offer, who it is for." />
        {fieldErr("description")}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="niche" className="mb-1 block text-sm text-muted">
            Niche
          </label>
          <select id="niche" className={SELECT} value={v.niche} onChange={(e) => set("niche", e.target.value)}>
            <option value="">Not set</option>
            {NICHES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {fieldErr("niche")}
        </div>
        <div>
          <label htmlFor="country" className="mb-1 block text-sm text-muted">
            Target country
          </label>
          <select id="country" className={SELECT} value={v.country} onChange={(e) => set("country", e.target.value)}>
            <option value="">Not set</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErr("country")}
        </div>
        <div>
          <label htmlFor="language" className="mb-1 block text-sm text-muted">
            Content language
          </label>
          <select id="language" className={SELECT} value={v.language} onChange={(e) => set("language", e.target.value)}>
            <option value="">Not set</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
          {fieldErr("language")}
        </div>
      </div>

      <div className="rounded-chip border border-dashed border-line bg-paper p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">Not sure about the niche or keywords? Get ideas from your description. They are only suggestions: check and edit them before you save.</p>
          <Button type="button" variant="secondary" size="sm" onClick={askForSuggestions} disabled={suggesting}>
            {suggesting ? "Thinking…" : quote?.nextUseCosts ? `Suggest niche & keywords (৳${quote.price})` : "Suggest niche & keywords"}
          </Button>
        </div>
        {quote?.charging && (
          <p className="mt-2 text-xs text-muted">
            {quote.freeLeftToday > 0
              ? `Free today: ${quote.freeLeftToday} of ${quote.freePerDay} left. After that each suggestion costs ৳${quote.price} from your wallet.`
              : `Each suggestion costs ৳${quote.price} from your wallet${quote.balance !== null ? ` (your balance: ৳${quote.balance})` : ""}.`}
            {quote.nextUseCosts && quote.balance !== null && quote.balance < quote.price && (
              <>
                {" "}
                <Link href="/dashboard/billing" className="text-brand-violet underline">
                  Top up your wallet
                </Link>
              </>
            )}
          </p>
        )}
        {suggestError && (
          <p className="mt-3 text-sm text-red-600">
            {suggestError}
            {needsTopUp && (
              <>
                {" "}
                <Link href="/dashboard/billing" className="underline">
                  Top up your wallet
                </Link>
              </>
            )}
          </p>
        )}
        {suggestion && (
          <div className="mt-3 space-y-3 text-sm">
            {suggestion.niche && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted">Suggested niche:</span>
                <span className="rounded-full bg-white px-2 py-0.5">{suggestion.niche}</span>
                <button type="button" className="text-xs text-brand-violet underline" onClick={() => set("niche", suggestion.niche ?? "")}>
                  Use this niche
                </button>
              </div>
            )}
            {suggestion.keywords.length > 0 && (
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted">Suggested keywords:</span>
                  <button type="button" className="text-xs text-brand-violet underline" onClick={() => set("keywords", mergeLines(v.keywords, suggestion.keywords))}>
                    Add all
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestion.keywords.map((k) => (
                    <button key={k} type="button" onClick={() => set("keywords", mergeLines(v.keywords, [k]))} className="rounded-full bg-white px-2 py-0.5 text-xs hover:bg-brand-soft" title="Add to my keywords">
                      + {k}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="keywords" className="mb-1 block text-sm text-muted">
            Keywords (one per line)
          </label>
          <textarea id="keywords" rows={6} className={TEXTAREA} value={v.keywords} onChange={(e) => set("keywords", e.target.value)} placeholder={"organic dog food\nbest puppy treats"} />
          <p className="mt-1 text-xs text-muted">
            {keywordCount} of {maxKeywords} used
          </p>
          {fieldErr("keywords")}
        </div>
        <div>
          <label htmlFor="competitors" className="mb-1 block text-sm text-muted">
            Competitors (websites, one per line)
          </label>
          <textarea id="competitors" rows={6} className={TEXTAREA} value={v.competitors} onChange={(e) => set("competitors", e.target.value)} placeholder={"rival-one.com\nhttps://rival-two.com"} />
          <p className="mt-1 text-xs text-muted">Up to 10. Saved as plain domains.</p>
          {fieldErr("competitors")}
        </div>
      </div>

      <div>
        <label htmlFor="notes" className="mb-1 block text-sm text-muted">
          Notes (only you can see these)
        </label>
        <textarea id="notes" rows={3} maxLength={2000} className={TEXTAREA} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
        {fieldErr("notes")}
      </div>

      {error && !errorField && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-signal">Saved ✓</p>}
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : mode === "create" ? "Create project" : "Save changes"}
      </Button>
    </form>
  );
}
