import type { Metadata } from "next";
import { ShieldCheck, TrendingUp, Gavel, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSiteSettings } from "@/lib/site-settings";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Trust & Payment Protection",
  description:
    "How LinkLazy protects paid orders with escrow, and our public dispute resolution track record.",
};

const FINISHED_STATUSES = ["accepted", "disputed", "refunded"];

async function getPlatformStats() {
  const supabase = await createClient();
  const settings = await getSiteSettings();

  const startingOrders = Number(settings.trust_starting_order_count) || 0;
  const startingResolved = Number(settings.trust_starting_resolved_disputes_count) || 0;

  const { data: orders } = await supabase
    .from("orders")
    .select("status")
    .in("status", FINISHED_STATUSES)
    .eq("order_type", "paid");

  const liveTotal = orders?.length ?? 0;
  const liveDisputed = orders?.filter((o) => o.status === "disputed").length ?? 0;

  const { data: disputes } = await supabase
    .from("disputes")
    .select("status")
    .neq("status", "open");

  const liveResolvedCount = disputes?.length ?? 0;

  // The "starting" numbers are added as a baseline — they're assumed
  // dispute-free (that's the point of a manually-set trust baseline), so
  // only liveDisputed counts against the dispute-free percentage.
  const total = liveTotal + startingOrders;
  const resolvedCount = liveResolvedCount + startingResolved;
  const withoutDispute = total ? Math.round(((total - liveDisputed) / total) * 100) : null;

  return { total, withoutDispute, resolvedCount };
}

const PROTECTION_STEPS = [
  {
    title: "You pay, funds are held in escrow",
    body: "When you place a paid order, your payment is held by LinkLazy — not sent to the seller yet.",
  },
  {
    title: "Seller delivers the placement",
    body: "The seller publishes your link and submits proof. You review it directly on their site.",
  },
  {
    title: "You accept — funds release to the seller",
    body: "Once you accept the delivery, escrowed funds release to the seller's wallet. If something's wrong, open a dispute instead of accepting.",
  },
  {
    title: "Disputes get admin review",
    body: "If you and the seller can't resolve it directly, LinkLazy admins review the order and evidence, and decide on a refund, partial refund, or release to the seller.",
  },
];

export default async function TrustPage() {
  const stats = await getPlatformStats();

  return (
    <main>
      <PageHero
        eyebrow="Payment protection"
        eyebrowIcon={ShieldCheck}
        title="Trust & payment protection"
        description="How paid orders on LinkLazy are protected, and our public track record on disputes."
      />

      <div className="mx-auto max-w-3xl px-6 py-16">
        <section className="mb-14">
          <div className="mb-5 flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-brand-violet" />
            <h2 className="font-display text-xl font-medium">How payment protection works</h2>
          </div>
          <ol className="space-y-4">
            {PROTECTION_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="flex gap-4 rounded-chip border border-line bg-white p-4 shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <div>
                  <p className="mb-1 font-medium text-ink">{step.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <div className="mb-5 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-violet" />
            <h2 className="font-display text-xl font-medium">Our track record</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-chip border border-line bg-white p-5 text-center shadow-sm">
              <ShieldCheck className="mx-auto mb-2 h-5 w-5 text-signal" />
              <p className="font-display text-2xl font-medium text-signal">
                {stats.withoutDispute != null ? `${stats.withoutDispute}%` : "—"}
              </p>
              <p className="mt-1 text-xs text-muted">of paid orders completed without a dispute</p>
            </div>
            <div className="rounded-chip border border-line bg-white p-5 text-center shadow-sm">
              <Gavel className="mx-auto mb-2 h-5 w-5 text-brand-violet" />
              <p className="font-display text-2xl font-medium text-brand-violet">{stats.resolvedCount}</p>
              <p className="mt-1 text-xs text-muted">disputes resolved by admin review</p>
            </div>
            <div className="rounded-chip border border-line bg-white p-5 text-center shadow-sm">
              <TrendingUp className="mx-auto mb-2 h-5 w-5 text-amber" />
              <p className="font-display text-2xl font-medium text-amber">{stats.total}</p>
              <p className="mt-1 text-xs text-muted">total completed paid orders</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-muted">
            Figures are platform-wide and update automatically — we don&apos;t publish
            per-seller dispute details to protect both buyers&apos; and sellers&apos; privacy
            during an active case.
          </p>
        </section>
      </div>
    </main>
  );
}
