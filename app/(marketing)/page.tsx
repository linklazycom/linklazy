import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <section className="mb-16">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted">
          Verified backlink exchange
        </p>
        <h1 className="max-w-3xl font-display text-5xl font-medium leading-[1.1] tracking-tight">
          Trade backlinks with sites whose numbers you can actually check.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted">
          Every listing carries verified metrics and an ownership check. Exchange
          links directly, or pay for placement — either way, delivery is proven
          before money or links move.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <Link href="/register">
            <Button size="lg">List your site</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="secondary">
              Browse sites
            </Button>
          </Link>
        </div>
      </section>

      <section className="rounded-chip border border-line bg-white p-8">
        <p className="mb-4 text-sm text-muted">A listing looks like this:</p>
        <div className="flex flex-wrap items-center gap-2">
          <MetricChip label="DA" value="42" />
          <MetricChip label="DR" value="38" />
          <MetricChip label="Traffic" value="12.4K/mo" />
          <MetricChip label="Niche" value="Home & Garden" />
          <MetricChip label="Ownership" value="Verified" tone="verified" />
          <MetricChip label="Placement" value="৳1,200" tone="price" />
        </div>
      </section>
    </main>
  );
}
