import { parseCsv } from "@/lib/csv";
import { cleanLine } from "@/lib/projects/rules";
import { normalizeEmail } from "@/lib/outreach/email";
import { countryFromDomain, isRestrictedCountry, normalizeCountry } from "@/lib/outreach/regions";
import { cleanTags, cleanWebsite, type ContactSource } from "@/lib/outreach/rules";

/**
 * Contact-list import planning (Batch 16B-1). Pure: takes the CSV text plus the emails that already exist
 * or are suppressed, and returns exactly what would be added and why anything was skipped. The route
 * runs it first as a dry run so the admin sees the result before anything is written.
 */
export const IMPORT_MAX_ROWS = 5000;

export interface RawRow {
  line: number;
  email: string;
  name: string;
  company: string;
  website: string;
  country: string;
  tags: string;
  notes: string;
}

const ALIASES: Record<keyof Omit<RawRow, "line">, string[]> = {
  email: ["email", "e-mail", "email_address", "email address", "mail"],
  name: ["name", "full_name", "full name", "contact", "contact_name"],
  company: ["company", "organization", "organisation", "business", "site_name"],
  website: ["website", "site", "url", "domain", "web"],
  country: ["country", "country_code"],
  tags: ["tags", "tag", "segment"],
  notes: ["notes", "note", "comment"],
};

export function parseContactsCsv(text: string): { ok: true; rows: RawRow[] } | { ok: false; error: string } {
  const table = parseCsv(text);
  if (table.length === 0) return { ok: false, error: "The file is empty." };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => header.findIndex((h) => names.includes(h));
  let emailIdx = col(ALIASES.email);
  let dataStart = 1;
  const idx = {
    name: col(ALIASES.name),
    first: header.indexOf("first_name"),
    last: header.indexOf("last_name"),
    company: col(ALIASES.company),
    website: col(ALIASES.website),
    country: col(ALIASES.country),
    tags: col(ALIASES.tags),
    notes: col(ALIASES.notes),
  };

  if (emailIdx === -1) {
    // A plain list of addresses without a header row: the first column is the email, the second (if any) the name.
    if (!table[0][0]?.includes("@")) return { ok: false, error: 'Missing an "email" column. Add a header row with an "email" column.' };
    emailIdx = 0;
    dataStart = 0;
    idx.name = table[0].length > 1 ? 1 : -1;
    idx.first = idx.last = idx.company = idx.website = idx.country = idx.tags = idx.notes = -1;
  }

  const body = table.slice(dataStart);
  if (body.length === 0) return { ok: false, error: "No data rows found." };
  if (body.length > IMPORT_MAX_ROWS) return { ok: false, error: `Too many rows (${body.length}). The limit is ${IMPORT_MAX_ROWS} per import: split the file.` };

  const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");
  const rows = body.map((r, i): RawRow => {
    const first = cell(r, idx.first);
    const last = cell(r, idx.last);
    return {
      line: i + 1 + dataStart,
      email: cell(r, emailIdx),
      name: cell(r, idx.name) || `${first} ${last}`.trim(),
      company: cell(r, idx.company),
      website: cell(r, idx.website),
      country: cell(r, idx.country),
      tags: cell(r, idx.tags),
      notes: cell(r, idx.notes),
    };
  });
  return { ok: true, rows };
}

export interface ImportOptions {
  source: ContactSource;
  /** ISO code used when a row has no country of its own. */
  defaultCountry: string | null;
  tags: string[];
}

export interface PlannedContact {
  email: string;
  email_domain: string;
  full_name: string | null;
  company: string | null;
  website: string | null;
  country: string | null;
  country_source: "file" | "default" | "tld" | null;
  source: ContactSource;
  status: "active" | "held";
  hold_reason: "restricted_region" | "source_review" | null;
  is_role: boolean;
  tags: string[];
  notes: string | null;
}

export interface ImportProblem {
  line: number;
  email: string;
  reason: string;
}

export interface ImportCounts {
  rows: number;
  toAdd: number;
  held: number;
  invalid: number;
  duplicateInFile: number;
  alreadyExisting: number;
  suppressed: number;
}

export interface ImportPlan {
  contacts: PlannedContact[];
  problems: ImportProblem[];
  counts: ImportCounts;
}

export function planImport(rows: RawRow[], opts: ImportOptions, existing: ReadonlySet<string>, suppressed: ReadonlySet<string>): ImportPlan {
  const contacts: PlannedContact[] = [];
  const problems: ImportProblem[] = [];
  const seen = new Set<string>();
  const counts: ImportCounts = { rows: rows.length, toAdd: 0, held: 0, invalid: 0, duplicateInFile: 0, alreadyExisting: 0, suppressed: 0 };

  for (const r of rows) {
    const e = normalizeEmail(r.email);
    if (!e.ok) {
      counts.invalid++;
      problems.push({ line: r.line, email: r.email.slice(0, 80), reason: e.reason });
      continue;
    }
    if (seen.has(e.email)) {
      counts.duplicateInFile++;
      problems.push({ line: r.line, email: e.email, reason: "Duplicate in this file" });
      continue;
    }
    seen.add(e.email);
    if (suppressed.has(e.email)) {
      counts.suppressed++;
      problems.push({ line: r.line, email: e.email, reason: "On the do-not-email list" });
      continue;
    }
    if (existing.has(e.email)) {
      counts.alreadyExisting++;
      problems.push({ line: r.line, email: e.email, reason: "Already in your contacts" });
      continue;
    }

    let country = normalizeCountry(r.country);
    let countrySource: PlannedContact["country_source"] = country ? "file" : null;
    if (!country && opts.defaultCountry) {
      country = opts.defaultCountry;
      countrySource = "default";
    }
    if (!country) {
      country = countryFromDomain(e.domain);
      countrySource = country ? "tld" : null;
    }

    const holdReason: PlannedContact["hold_reason"] = isRestrictedCountry(country) ? "restricted_region" : opts.source === "purchased_or_scraped" ? "source_review" : null;
    const rowTags = cleanTags(r.tags);
    contacts.push({
      email: e.email,
      email_domain: e.domain,
      full_name: cleanLine(r.name, 100),
      company: cleanLine(r.company, 120),
      website: cleanWebsite(r.website),
      country,
      country_source: countrySource,
      source: opts.source,
      status: holdReason ? "held" : "active",
      hold_reason: holdReason,
      is_role: e.isRole,
      tags: cleanTags([...opts.tags, ...rowTags]),
      notes: cleanLine(r.notes, 500),
    });
    counts.toAdd++;
    if (holdReason) counts.held++;
  }
  return { contacts, problems, counts };
}
