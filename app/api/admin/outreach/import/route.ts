import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { readJson } from "@/lib/links/http";
import { cleanLine } from "@/lib/projects/rules";
import { normalizeEmail } from "@/lib/outreach/email";
import { normalizeCountry } from "@/lib/outreach/regions";
import { cleanTags, isContactSource } from "@/lib/outreach/rules";
import { parseContactsCsv, planImport } from "@/lib/outreach/import";
import { chunk, existingEmails } from "@/lib/outreach/server";

export const maxDuration = 60;

/**
 * Contact import (Batch 16B-1, admin only). "dry_run: true" only reports what WOULD happen; the real import needs
 * the admin's written declaration and records where the list came from. Emails already in the list, on the
 * do-not-email list, duplicated in the file or invalid are skipped; EU/EEA/UK/CH and "bought or collected"
 * lists are imported as HELD, never active.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error.message }, { status: auth.error.status });

  const body = await readJson(request, 2_500_000);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "The file is too large or the request is invalid." }, { status: 400 });
  const b = body as Record<string, unknown>;

  if (typeof b.csv !== "string" || !b.csv.trim()) return NextResponse.json({ error: "Choose a file or paste your list first." }, { status: 400 });
  if (!isContactSource(b.source)) return NextResponse.json({ error: "Tell us how you got these emails.", field: "source" }, { status: 400 });
  const dryRun = b.dry_run === true;
  if (!dryRun && b.declaration !== true) {
    return NextResponse.json({ error: "Please confirm the declaration to import.", field: "declaration" }, { status: 400 });
  }
  let defaultCountry: string | null = null;
  if (typeof b.default_country === "string" && b.default_country.trim()) {
    defaultCountry = normalizeCountry(b.default_country);
    if (!defaultCountry) return NextResponse.json({ error: "Use a 2-letter country code such as BD or US.", field: "default_country" }, { status: 400 });
  }

  const parsed = parseContactsCsv(b.csv);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const service = createServiceClient();
  // Look up the SAME normalised form the planner will use (e.g. "<A@B.com>" -> "a@b.com"), or existing/suppressed matches would be missed.
  const emails: string[] = [];
  for (const r of parsed.rows) {
    const e = normalizeEmail(r.email);
    if (e.ok) emails.push(e.email);
  }
  let existing: Set<string>;
  let suppressed: Set<string>;
  try {
    [existing, suppressed] = await Promise.all([existingEmails(service, "outreach_contacts", emails), existingEmails(service, "outreach_suppressions", emails)]);
  } catch {
    return NextResponse.json({ error: "Could not check your existing contacts. Please try again." }, { status: 500 });
  }

  const tags = cleanTags(b.tags);
  const plan = planImport(parsed.rows, { source: b.source, defaultCountry, tags }, existing, suppressed);
  const problems = plan.problems.slice(0, 100);

  if (dryRun) return NextResponse.json({ ok: true, dryRun: true, counts: plan.counts, problems });

  if (plan.contacts.length === 0) {
    return NextResponse.json({ error: "There is nothing new to import from this file.", counts: plan.counts, problems }, { status: 400 });
  }

  const fileName = cleanLine(b.file_name, 200);
  const { data: imp, error: impErr } = await service
    .from("outreach_imports")
    .insert({
      created_by: auth.adminId,
      file_name: fileName,
      source: b.source,
      total_rows: plan.counts.rows,
      added: plan.counts.toAdd,
      held: plan.counts.held,
      invalid: plan.counts.invalid,
      duplicates: plan.counts.duplicateInFile + plan.counts.alreadyExisting,
      suppressed: plan.counts.suppressed,
      tags,
    })
    .select("id")
    .single();
  if (impErr || !imp) return NextResponse.json({ error: "Could not start the import." }, { status: 500 });

  let inserted = 0;
  for (const group of chunk(plan.contacts, 500)) {
    // ignoreDuplicates: if another import added the same address a moment ago, it is skipped, not overwritten.
    const { data, error } = await service
      .from("outreach_contacts")
      .upsert(group.map((c) => ({ ...c, import_id: imp.id, created_by: auth.adminId })), { onConflict: "email", ignoreDuplicates: true })
      .select("id");
    if (error) {
      await service.from("outreach_imports").update({ added: inserted }).eq("id", imp.id);
      return NextResponse.json({ error: `The import stopped after ${inserted} contacts. Run it again: contacts already added are skipped.`, inserted }, { status: 500 });
    }
    inserted += data?.length ?? 0;
  }
  if (inserted !== plan.counts.toAdd) await service.from("outreach_imports").update({ added: inserted }).eq("id", imp.id);

  await auth.supabase.from("admin_logs").insert({
    admin_id: auth.adminId,
    action: "outreach_import",
    target_table: "outreach_imports",
    target_id: imp.id,
    metadata: { source: b.source, added: inserted, held: plan.counts.held, rows: plan.counts.rows },
  });

  return NextResponse.json({ ok: true, dryRun: false, counts: { ...plan.counts, toAdd: inserted }, problems });
}
