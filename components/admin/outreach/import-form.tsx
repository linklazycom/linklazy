"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";
import { CONTACT_SOURCES } from "@/lib/outreach/rules";

interface Counts {
  rows: number;
  toAdd: number;
  held: number;
  invalid: number;
  duplicateInFile: number;
  alreadyExisting: number;
  suppressed: number;
}
interface Problem {
  line: number;
  email: string;
  reason: string;
}

const inputClass = "w-full rounded-chip border border-line bg-white px-3 py-2 text-sm outline-none focus:border-signal";

export function OutreachImportForm() {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [source, setSource] = useState("");
  const [country, setCountry] = useState("");
  const [tags, setTags] = useState("");
  const [declared, setDeclared] = useState(false);
  const [busy, setBusy] = useState<"check" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [checked, setChecked] = useState(false);
  const [done, setDone] = useState(false);

  function changed() {
    // Any change to the file or options means the last check no longer applies.
    setChecked(false);
    setDone(false);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("That file is larger than 2 MB. Split it into smaller files (up to 5000 rows each).");
      return;
    }
    setError(null);
    setFileName(file.name);
    setCsv(await file.text());
    changed();
  }

  async function run(dryRun: boolean) {
    if (busy) return;
    setBusy(dryRun ? "check" : "import");
    setError(null);
    const res = await apiRequest("/api/admin/outreach/import", "POST", {
      csv,
      file_name: fileName || null,
      source,
      default_country: country || null,
      tags,
      declaration: declared,
      dry_run: dryRun,
    });
    setBusy(null);
    if (!res.ok) {
      setError(res.error);
      setCounts((res.data?.counts as Counts | undefined) ?? null);
      setProblems((res.data?.problems as Problem[] | undefined) ?? []);
      return;
    }
    setCounts((res.data?.counts as Counts | undefined) ?? null);
    setProblems((res.data?.problems as Problem[] | undefined) ?? []);
    if (dryRun) setChecked(true);
    else {
      setDone(true);
      setChecked(false);
      router.refresh();
    }
  }

  const ready = csv.trim().length > 0 && source !== "";

  return (
    <div className="space-y-5">
      <div className="space-y-4 rounded-chip border border-line bg-white p-5">
        <div>
          <label htmlFor="o-file" className="mb-1 block text-sm text-muted">
            CSV file (needs an &quot;email&quot; column; optional: name, company, website, country, tags, notes). A plain list of addresses also works.
          </label>
          <input id="o-file" type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} className="text-sm" />
        </div>
        <div>
          <label htmlFor="o-csv" className="mb-1 block text-sm text-muted">
            …or paste the list here
          </label>
          <textarea
            id="o-csv"
            rows={6}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setFileName("");
              changed();
            }}
            className={`${inputClass} font-mono`}
            placeholder={"email,name,company,website,country\nmaria@example-blog.com,Maria,Example Blog,example-blog.com,US"}
          />
        </div>
        <div>
          <label htmlFor="o-source" className="mb-1 block text-sm text-muted">
            How did you get these emails? *
          </label>
          <select
            id="o-source"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              changed();
            }}
            className={inputClass}
          >
            <option value="">Choose…</option>
            {CONTACT_SOURCES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="o-country" className="mb-1 block text-sm text-muted">
              Country code for rows without one (optional, e.g. BD)
            </label>
            <input id="o-country" value={country} maxLength={2} onChange={(e) => { setCountry(e.target.value.toUpperCase()); changed(); }} className={inputClass} />
          </div>
          <div>
            <label htmlFor="o-tags" className="mb-1 block text-sm text-muted">
              Tags for this import (optional, comma separated)
            </label>
            <input id="o-tags" value={tags} onChange={(e) => { setTags(e.target.value); changed(); }} className={inputClass} placeholder="backlink-buyers, 2026" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} className="mt-1" />
          <span>I am allowed to email these people about my own business, I will honour every unsubscribe, and I understand that people in the EU/EEA, UK and Switzerland, and lists I bought or collected, are held until I release them on purpose.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" disabled={!ready || busy !== null} onClick={() => run(true)}>
            {busy === "check" ? "Checking…" : "1. Check the file"}
          </Button>
          <Button type="button" disabled={!ready || !checked || !declared || busy !== null} onClick={() => run(false)}>
            {busy === "import" ? "Importing…" : "2. Import"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {counts && (
        <section className="space-y-3 rounded-chip border border-line bg-white p-5">
          <h2 className="font-display text-lg font-medium">{done ? "Imported" : "Check result (nothing saved yet)"}</h2>
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li>Rows in the file: <strong>{counts.rows}</strong></li>
            <li>{done ? "Added" : "Will be added"}: <strong>{counts.toAdd}</strong></li>
            <li>…of which held for review: <strong>{counts.held}</strong></li>
            <li>Invalid emails: <strong>{counts.invalid}</strong></li>
            <li>Duplicates in the file: <strong>{counts.duplicateInFile}</strong></li>
            <li>Already in your contacts: <strong>{counts.alreadyExisting}</strong></li>
            <li>On the do-not-email list: <strong>{counts.suppressed}</strong></li>
          </ul>
          {problems.length > 0 && (
            <details>
              <summary className="cursor-pointer text-sm underline">Skipped rows ({problems.length}{problems.length === 100 ? "+" : ""})</summary>
              <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs text-muted">
                {problems.map((p) => (
                  <li key={`${p.line}-${p.email}`}>
                    Line {p.line}: {p.email || "(empty)"} — {p.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
