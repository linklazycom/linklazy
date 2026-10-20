import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { OutreachSenderForm } from "@/components/admin/outreach/settings-form";
import { SuppressionManager } from "@/components/admin/outreach/suppression-manager";
import { getSenderIdentity } from "@/lib/outreach/server";
import { getUnsubscribeSecret } from "@/lib/outreach/token";
import { senderIsComplete } from "@/lib/outreach/sender";
import { CONTACT_SOURCES, CONTACT_STATUSES, HOLD_REASONS, HOLD_REASON_LABELS } from "@/lib/outreach/rules";

export const metadata = { title: "Admin · Outreach" };
export const dynamic = "force-dynamic";

export default async function AdminOutreachPage() {
  const supabase = await createClient();
  const count = async (build: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count: c } = await build(base());
    return c ?? 0;
  };
  function base() {
    return supabase.from("outreach_contacts").select("id", { count: "exact", head: true });
  }

  const [statusCounts, heldCounts, imports, suppressions, suppressionTotal, sender] = await Promise.all([
    Promise.all(CONTACT_STATUSES.map((s) => count((q) => q.eq("status", s)))),
    Promise.all(HOLD_REASONS.map((r) => count((q) => q.eq("status", "held").eq("hold_reason", r)))),
    supabase.from("outreach_imports").select("id, file_name, source, total_rows, added, held, invalid, duplicates, suppressed, created_at").order("created_at", { ascending: false }).limit(5),
    supabase.from("outreach_suppressions").select("id, email, reason, created_at").order("created_at", { ascending: false }).limit(30),
    supabase.from("outreach_suppressions").select("id", { count: "exact", head: true }),
    getSenderIdentity(),
  ]);

  const total = statusCounts.reduce((a, b) => a + b, 0);
  const unsubReady = getUnsubscribeSecret() !== null;
  const senderReady = senderIsComplete(sender);
  const sourceLabel = (id: string) => CONTACT_SOURCES.find((s) => s.id === id)?.label ?? id;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium">Outreach</h1>
        <p className="text-sm text-muted">Your contact list, the safety rules around it and the do-not-email list. Sending campaigns is built in the next step: nothing here sends any email.</p>
      </div>

      <section className="space-y-2 rounded-chip border border-line bg-white p-5">
        <h2 className="font-display text-lg font-medium">Ready to send?</h2>
        <ul className="space-y-1 text-sm">
          <li>{unsubReady ? "✅" : "❌"} Unsubscribe links can be signed {unsubReady ? "" : "— set PROVIDER_KEY_ENCRYPTION_SECRET (already used for API keys) or OUTREACH_UNSUBSCRIBE_SECRET in Vercel"}</li>
          <li>{senderReady ? "✅" : "❌"} Sender name and postal address saved {senderReady ? "" : "— fill in the form below"}</li>
          <li>{total > 0 ? "✅" : "⬜"} Contacts imported ({total})</li>
          <li>⬜ Separate sending domain and mail provider (chosen when campaigns are built)</li>
        </ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-medium">Contacts by status</h2>
          <div className="flex gap-3 text-sm">
            <Link href="/admin/outreach/import" className="underline">Import contacts</Link>
            <Link href="/admin/outreach/contacts" className="underline">Open the list</Link>
          </div>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {CONTACT_STATUSES.map((s, i) => (
            <li key={s} className="rounded-chip border border-line bg-white p-3 text-sm">
              <Link href={`/admin/outreach/contacts?status=${s}`} className="underline">{s}</Link>
              <p className="font-display text-xl">{statusCounts[i]}</p>
              {s === "held" && heldCounts.some((c) => c > 0) && (
                <p className="text-xs text-muted">
                  {HOLD_REASONS.map((r, j) => (heldCounts[j] > 0 ? `${HOLD_REASON_LABELS[r]}: ${heldCounts[j]}` : null)).filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <OutreachSenderForm initial={sender} />

      <SuppressionManager rows={(suppressions.data ?? []) as { id: string; email: string; reason: string; created_at: string }[]} total={suppressionTotal.count ?? 0} />

      <section className="space-y-3">
        <h2 className="font-display text-lg font-medium">Recent imports</h2>
        {(imports.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No imports yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-chip border border-line bg-white text-sm">
            {(imports.data ?? []).map((i) => (
              <li key={i.id} className="p-3">
                <p className="font-medium">{i.file_name ?? "Pasted list"} · {String(i.created_at).slice(0, 10)}</p>
                <p className="text-xs text-muted">
                  {i.added} added of {i.total_rows} rows · {i.held} held · {i.invalid} invalid · {i.duplicates} duplicates · {i.suppressed} on the do-not-email list · source: {sourceLabel(i.source)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
