import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Trust & Payment Protection",
  description:
    "How LinkLazy protects paid orders with escrow, and our public dispute resolution track record.",
};

const FINISHED_STATUSES = ["accepted", "disputed", "refunded"];

async function getPlatformStats() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("status")
    .in("status", FINISHED_STATUSES)
    .eq("order_type", "paid");

  const total = orders?.length ?? 0;
  const disputed = orders?.filter((o) => o.status === "disputed").length ?? 0;
  const withoutDispute = total ? Math.round(((total - disputed) / total) * 100) : null;

  const { data: disputes } = await supabase
    .from("disputes")
    .select("status")
    .neq("status", "open");

  const resolvedCount = disputes?.length ?? 0;

  return { total, withoutDispute, resolvedCount };
}

export default async function TrustPage() {
  const stats = await getPlatformStats();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-display text-3xl font-medium">Trust &amp; payment protection</h1>
      <p className="mb-10 text-muted">
        How paid orders on LinkLazy are protected, and our public track record on disputes.
      </p>

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-medium">How payment protection works</h2>
        <ol className="space-y-4 text-sm">
          <li className="rounded-chip border border-line bg-white p-4">
            <p className="mb-1 font-medium">1. You pay, funds are held in escrow</p>
            <p className="text-muted">
              When you place a paid order, your payment is held by LinkLazy — not sent to the
              seller yet.
            </p>
          </li>
          <li className="rounded-chip border border-line bg-white p-4">
            <p className="mb-1 font-medium">2. Seller delivers the placement</p>
            <p className="text-muted">
              The seller publishes your link and submits proof. You review it directly on their
              site.
            </p>
          </li>
          <li className="rounded-chip border border-line bg-white p-4">
            <p className="mb-1 font-medium">3. You accept — funds release to the seller</p>
            <p className="text-muted">
              Once you accept the delivery, escrowed funds release to the seller&apos;s wallet.
              If something&apos;s wrong, open a dispute instead of accepting.
            </p>
          </li>
          <li className="rounded-chip border border-line bg-white p-4">
            <p className="mb-1 font-medium">4. Disputes get admin review</p>
            <p className="text-muted">
              If you and the seller can&apos;t resolve it directly, LinkLazy admins review the
              order and evidence, and decide on a refund, partial refund, or release to the
              seller.
            </p>
          </li>
        </ol>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-medium">Our track record</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-chip border border-line bg-white p-4 text-center">
            <p className="font-display text-2xl font-medium">
              {stats.withoutDispute != null ? `${stats.withoutDispute}%` : "—"}
            </p>
            <p className="text-xs text-muted">of paid orders completed without a dispute</p>
          </div>
          <div className="rounded-chip border border-line bg-white p-4 text-center">
            <p className="font-display text-2xl font-medium">{stats.resolvedCount}</p>
            <p className="text-xs text-muted">disputes resolved by admin review</p>
          </div>
          <div className="rounded-chip border border-line bg-white p-4 text-center">
            <p className="font-display text-2xl font-medium">{stats.total}</p>
            <p className="text-xs text-muted">total completed paid orders</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          Figures are platform-wide and update automatically — we don&apos;t publish
          per-seller dispute details to protect both buyers&apos; and sellers&apos; privacy
          during an active case.
        </p>
      </section>
    </main>
  );
}
