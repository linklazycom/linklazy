import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { searchPexelsPhoto } from "@/lib/pexels";

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

const STEPS = [
  {
    n: "1",
    title: "Browse or list",
    body: "Browse verified sites for free, or list your own in a few minutes — no cost to get approved.",
  },
  {
    n: "2",
    title: "Exchange or order",
    body: "Trade links directly with a relevant site, or place a paid order with escrow protection.",
  },
  {
    n: "3",
    title: "Confirm delivery",
    body: "Payment releases to the seller only after you confirm the link is live and matches the order.",
  },
];

const FAQS = [
  {
    q: "How is LinkLazy different from a regular backlink seller?",
    a: "Every listing goes through an ownership check before it's approved, and metrics are shown transparently. Paid orders are escrow-protected, so funds only release once delivery is confirmed — you're not paying blind.",
  },
  {
    q: "Is it free to list my site?",
    a: "Yes. Listing is free under the Commission plan — LinkLazy only takes a percentage when you complete a paid order. A flat Monthly plan is also available if you'd rather pay 0% commission.",
  },
  {
    q: "What happens if a seller doesn't deliver?",
    a: "Escrow protects you — funds are only released once you confirm the link is live and correct. If there's a dispute, our moderation team reviews it before any payout.",
  },
  {
    q: "Can I exchange links without paying?",
    a: "Yes — many listings accept direct exchanges alongside or instead of paid placements. You can filter for exchange-only sites when browsing.",
  },
];

export default async function HomePage() {
  const heroPhoto = await searchPexelsPhoto("web analytics dashboard laptop");

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Hero */}
      <section className="relative overflow-hidden">
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
              delivery is proven before money or links move. No guessing
              whether a "DA 50" site is real or an expired-domain shell.
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

      {/* Sample listing */}
      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-chip border border-line bg-white p-8 shadow-sm">
          <p className="mb-4 text-sm text-muted">A listing looks like this:</p>
          <div className="flex flex-wrap items-center gap-2">
            <MetricChip label="DA" value="42" />
            <MetricChip label="DR" value="38" />
            <MetricChip label="Traffic" value="12.4K/mo" />
            <MetricChip label="Niche" value="Home & Garden" />
            <MetricChip label="Ownership" value="Verified" tone="verified" />
            <MetricChip label="Placement" value={1200} tone="price" />
          </div>
        </div>
      </section>

      {/* Features */}
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

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-2 text-center font-display text-2xl font-medium">How it works</h2>
        <p className="mx-auto mb-10 max-w-md text-center text-muted">
          From browsing to a live link, in three steps.
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-chip border border-line bg-white p-6">
              <span className="brand-gradient-text font-display text-3xl font-semibold">
                {s.n}
              </span>
              <p className="mb-2 mt-2 font-display text-lg font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16 text-center">
          <p className="mb-8 font-mono text-xs uppercase tracking-widest text-muted">
            Built for people who actually check before they buy
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-chip border border-line p-6">
              <p className="font-display text-3xl font-semibold text-brand-violet">100%</p>
              <p className="mt-1 text-sm text-muted">Ownership-verified listings</p>
            </div>
            <div className="rounded-chip border border-line p-6">
              <p className="font-display text-3xl font-semibold text-signal">Escrow</p>
              <p className="mt-1 text-sm text-muted">Protected on every paid order</p>
            </div>
            <div className="rounded-chip border border-line p-6">
              <p className="font-display text-3xl font-semibold text-amber">Free</p>
              <p className="mt-1 text-sm text-muted">To browse and list your site</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-medium">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-6">
          {FAQS.map((f) => (
            <div key={f.q}>
              <p className="font-medium">{f.q}</p>
              <p className="mt-1 text-sm text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
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
