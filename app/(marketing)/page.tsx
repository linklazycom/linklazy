import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { searchPexelsPhoto } from "@/lib/pexels";

// Each feature now carries its own tone so the row isn't three identical
// gradient squares — reuses the existing brand/signal/amber tokens already
// defined in tailwind.config.ts, nothing new introduced.
const FEATURES = [
  {
    title: "Ownership verified",
    body: "Every listing proves control of the site — a meta tag, DNS record, or file check — before it goes live.",
    iconBg: "bg-signal-soft",
    iconColor: "text-signal",
  },
  {
    title: "Metrics you can trust",
    body: "DA, DR, traffic, referring domains, and spam score shown up front, re-checked over time.",
    iconBg: "bg-brand-soft",
    iconColor: "text-brand-violet",
  },
  {
    title: "Escrow-protected orders",
    body: "Payment is held until you confirm the link is live and correct — never released blind.",
    iconBg: "bg-amber-soft",
    iconColor: "text-amber",
  },
];

export default async function HomePage() {
  const heroPhoto = await searchPexelsPhoto("web analytics dashboard laptop");

  return (
    <main>
      <section className="relative overflow-hidden">
        {/* Was a single radial-gradient at opacity-[0.06] — nearly invisible.
            Now three overlapping brand-color blobs at a visible-but-still-
            subtle opacity, echoing the logo's blue→violet→magenta gradient
            without touching body text/background colors. */}
        <div className="pointer-events-none absolute inset-0">
          <div
            className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full opacity-[0.18] blur-3xl"
            style={{ background: "#2C75FC" }}
          />
          <div
            className="absolute -top-10 right-0 h-[380px] w-[380px] rounded-full opacity-[0.16] blur-3xl"
            style={{ background: "#6D35F9" }}
          />
          <div
            className="absolute bottom-[-140px] left-1/3 h-[360px] w-[360px] rounded-full opacity-[0.14] blur-3xl"
            style={{ background: "#B23CFC" }}
          />
        </div>
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-6 py-20 md:grid-cols-2">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-brand-violet">
              Verified backlink exchange
            </p>
            <h1 className="font-display text-5xl font-medium leading-[1.1] tracking-tight">
              Trade backlinks with sites whose numbers you can{" "}
              <span className="brand-gradient-text">actually check</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Every listing carries verified metrics and an ownership check.
              Exchange links directly, or pay for placement — either way,
              delivery is proven before money or links move.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link href="/register">
                <Button size="lg">List your site</Button>
              </Link>
              <Link href="/browse">
                <Button size="lg" variant="secondary">
                  Browse sites
                </Button>
              </Link>
            </div>
          </div>

          {heroPhoto && (
            <div className="relative aspect-[4/3] overflow-hidden rounded-chip shadow-lg ring-1 ring-brand-violet/10">
              <Image
                src={heroPhoto.url}
                alt={heroPhoto.alt}
                fill
                className="object-cover"
                unoptimized
                priority
              />
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-chip border border-line bg-white p-8 shadow-sm">
          <p className="mb-4 text-sm text-muted">A listing looks like this:</p>
          <div className="flex flex-wrap items-center gap-2">
            <MetricChip label="DA" value="42" />
            <MetricChip label="DR" value="38" />
            <MetricChip label="Traffic" value="12.4K/mo" />
            <MetricChip label="Niche" value="Home & Garden" />
            <MetricChip label="Ownership" value="Verified" tone="verified" />
            <MetricChip label="Placement" value="৳1,200" tone="price" />
          </div>
        </div>
      </section>

      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-chip ${f.iconBg} ${f.iconColor} font-display text-lg font-semibold`}
                >
                  ✓
                </div>
                <p className="mb-2 font-display text-lg font-medium">{f.title}</p>
                <p className="text-sm text-muted">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl overflow-hidden px-6 py-16 text-center">
        <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.05]" />
        <h2 className="mb-3 font-display text-2xl font-medium">
          Ready to build cleaner backlinks?
        </h2>
        <p className="mb-6 text-muted">
          Free to browse metrics. List your first site in a few minutes.
        </p>
        <Link href="/register">
          <Button size="lg">Get started</Button>
        </Link>
      </section>
    </main>
  );
}
