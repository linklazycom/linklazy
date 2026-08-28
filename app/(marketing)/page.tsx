import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  BarChart3,
  Lock,
  Wallet,
  Layers,
  Repeat,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  Newspaper,
  Compass,
  Rocket,
  TrendingUp,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MetricChip } from "@/components/ui/metric-chip";
import { SiteCard, type SiteCardData } from "@/components/sites/site-card";
import { ArticleCardGrid } from "@/components/blog/article-card-grid";
import { searchPexelsPhoto } from "@/lib/pexels";
import { maskDomain } from "@/lib/mask-domain";
import { createClient } from "@/lib/supabase/server";

const FEATURES = [
  {
    title: "Ownership verified",
    body: "Every listing proves control of the site — a meta tag, DNS record, or file check — before it goes live.",
    icon: ShieldCheck,
    tint: "blue",
  },
  {
    title: "Metrics you can trust",
    body: "DR is pulled straight from Ahrefs' own API and refreshed weekly — not a screenshot, not a seller's word.",
    icon: BarChart3,
    tint: "violet",
  },
  {
    title: "Escrow-protected orders",
    body: "Payment is held until you confirm the link is live and correct — never released blind.",
    icon: Lock,
    tint: "magenta",
  },
  {
    title: "Pay for what performs",
    body: "Skip the flat fee. Pay-Per-View pricing charges your wallet only as the linked content actually gets views.",
    icon: Wallet,
    tint: "signal",
  },
  {
    title: "Built for real campaigns",
    body: "Select several vetted sites, review the batch, and check out once — no repeating the same flow ten times.",
    icon: Layers,
    tint: "amber",
  },
  {
    title: "Trade or transact, your call",
    body: "Exchange links directly with a relevant site at no cost, or place a paid order when a straight trade doesn't fit.",
    icon: Repeat,
    tint: "blue",
  },
];

const TINTS: Record<string, { bg: string; text: string }> = {
  blue: { bg: "bg-[#EAF1FF]", text: "text-brand-blue" },
  violet: { bg: "bg-brand-soft", text: "text-brand-violet" },
  magenta: { bg: "bg-[#FBEAFE]", text: "text-brand-magenta" },
  signal: { bg: "bg-signal-soft", text: "text-signal" },
  amber: { bg: "bg-amber-soft", text: "text-amber" },
};

const STEPS = [
  {
    n: "1",
    title: "Browse or list",
    body: "Browse verified sites for free, or list your own in a few minutes — no cost to get approved.",
  },
  {
    n: "2",
    title: "Exchange or order",
    body: "Trade links directly with a relevant site, place a flat-fee order with escrow, or go Pay-Per-View.",
  },
  {
    n: "3",
    title: "Confirm delivery",
    body: "Payment releases to the seller only after you confirm the link is live and matches the order.",
  },
];

const USE_CASES = [
  {
    title: "Testing a new niche",
    body: "Start with a handful of relevant exchanges before committing real budget to a niche you haven't worked in yet.",
    icon: Compass,
    tint: "blue",
    bullets: ["No upfront cost — start with free exchanges", "Validate relevance before spending", "Scale up once it's working"],
  },
  {
    title: "Running a real campaign",
    body: "Bulk order across a shortlist of vetted sites in one checkout, then track the whole batch from a single dashboard view.",
    icon: Rocket,
    tint: "violet",
    bullets: ["Bulk-select across vetted listings", "One checkout for the whole batch", "Track every order from one dashboard"],
  },
  {
    title: "Content that lives on traffic",
    body: "Put a listicle or resource page on Pay-Per-View pricing and pay in proportion to the views it actually earns.",
    icon: TrendingUp,
    tint: "signal",
    bullets: ["Pay only as real views accrue", "Set a budget cap up front", "No flat fee if it underperforms"],
  },
];

const FAQS = [
  {
    q: "How is LinkLazy different from a regular backlink seller?",
    a: "Every listing goes through an ownership check before it's approved, and Domain Rating is verified directly against Ahrefs — not typed in by the seller. Paid orders are escrow-protected, so funds only release once delivery is confirmed.",
  },
  {
    q: "Is it free to list my site?",
    a: "Yes. Listing is free under the Commission plan — LinkLazy only takes a percentage when you complete a paid order. A flat Monthly plan with 0% commission is also available for established sellers — contact support to switch.",
  },
  {
    q: "What happens if a seller doesn't deliver?",
    a: "Escrow protects you — funds are only released once you confirm the link is live and correct. If there's a dispute, our moderation team reviews it before any payout.",
  },
  {
    q: "What's the difference between flat-fee and Pay-Per-View pricing?",
    a: "Flat-fee is a fixed price, paid once. Pay-Per-View draws from a prepaid wallet as the linked content earns real views, up to a budget cap you set — better suited to traffic-dependent content or testing a new seller relationship.",
  },
  {
    q: "Can I exchange links without paying?",
    a: "Yes — many listings accept direct exchanges alongside or instead of paid placements. You can filter for exchange-only sites when browsing.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();

  const [heroPhoto, { data: freshSites }, { data: nicheSites }, { data: articles }] = await Promise.all([
    searchPexelsPhoto("web analytics dashboard laptop"),
    // Real, changing marketplace content — freshly-approved listings, not
    // static copy. Gives the homepage something new for search engines to
    // crawl on every visit and links straight into individual /browse/[id]
    // pages, which helps those get indexed too.
    supabase
      .from("sites")
      .select(
        "id, owner_id, domain, niche, da, dr, dr_verified, organic_traffic, price_amount, link_type, accepts_exchange, accepts_paid, is_featured, created_at"
      )
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("sites").select("niche").eq("status", "approved"),
    supabase
      .from("articles")
      .select("slug, title, meta_description, target_keyword, category, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(4),
  ]);

  const nicheCounts = new Map<string, number>();
  for (const s of nicheSites ?? []) {
    const key = s.niche.trim();
    nicheCounts.set(key, (nicheCounts.get(key) ?? 0) + 1);
  }
  const topNiches = [...nicheCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

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
            className="absolute -top-20 -left-20 h-[460px] w-[460px] rounded-full opacity-[0.20] blur-3xl"
            style={{ background: "#2C75FC" }}
          />
          <div
            className="absolute -top-10 right-0 h-[420px] w-[420px] rounded-full opacity-[0.18] blur-3xl"
            style={{ background: "#6D35F9" }}
          />
          <div
            className="absolute bottom-[-160px] left-1/3 h-[400px] w-[400px] rounded-full opacity-[0.16] blur-3xl"
            style={{ background: "#B23CFC" }}
          />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-brand-violet/20 bg-brand-soft px-3 py-1 font-mono text-xs uppercase tracking-widest text-brand-violet">
              <Sparkles className="h-3.5 w-3.5" />
              Verified backlink marketplace
            </p>
            <h1 className="font-display text-5xl font-medium leading-[1.08] tracking-tight md:text-6xl">
              Trade backlinks with sites whose numbers you can{" "}
              <span className="brand-gradient-text">actually check</span>.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              Every listing carries an ownership check and Ahrefs-verified Domain
              Rating, refreshed weekly. Exchange links directly, pay a flat fee
              with escrow, or go Pay-Per-View — either way, delivery is proven
              before money or links move.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link href="/register">
                <Button size="lg">List your site</Button>
              </Link>
              <Link href="/browse">
                <Button size="lg" variant="secondary">
                  Browse sites
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-signal" />
                Ownership verified
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-brand-violet" />
                Escrow protected
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BarChart3 className="h-4 w-4 text-brand-blue" />
                DR via Ahrefs
              </span>
            </div>
          </div>

          <div className="relative">
            {heroPhoto && (
              <div className="relative aspect-[4/3] overflow-hidden rounded-chip shadow-xl ring-1 ring-brand-violet/10">
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
            {/* Floating verified-metrics card — the recurring "verified ledger"
                motif used on site cards elsewhere, surfaced here for depth. */}
            <div className="absolute -bottom-6 -left-6 hidden max-w-[240px] rounded-chip border border-line bg-white p-4 shadow-lg sm:block">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-signal">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ownership verified
              </div>
              <div className="flex flex-wrap gap-1.5">
                <MetricChip label="DR" value="38" />
                <MetricChip label="Traffic" value="12.4K/mo" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sample listing */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="relative overflow-hidden rounded-chip border border-line bg-white p-8 shadow-sm">
          <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
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

      {/* Fresh listings — real, changing marketplace content */}
      {freshSites && freshSites.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-medium tracking-tight sm:text-3xl">
                Freshly listed sites
              </h2>
              <p className="mt-2 text-muted">Newest ownership-verified listings on the marketplace.</p>
            </div>
            <Link href="/browse" className="inline-flex items-center gap-1 text-sm font-medium text-brand-violet">
              Browse all sites
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(freshSites as SiteCardData[]).map((site) => (
              <SiteCard
                key={site.id}
                site={site}
                href={`/browse/${site.id}`}
                sellerTier={null}
                displayDomain={maskDomain(site.domain)}
                ctaLabel="View listing"
              />
            ))}
          </div>
        </section>
      )}

      {/* Popular niches — internal links into topically-matched listings */}
      {topNiches.length > 0 && (
        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mx-auto mb-10 max-w-lg text-center">
              <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-brand-violet">
                <LayoutGrid className="h-3.5 w-3.5" />
                Directory
              </p>
              <h2 className="font-display text-3xl font-medium tracking-tight">Popular niches</h2>
              <p className="mt-3 text-muted">Find sites that already talk to your audience.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5">
              {topNiches.map(([niche, count]) => (
                <Link
                  key={niche}
                  href={`/browse?niche=${encodeURIComponent(niche)}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-2 text-sm transition-colors hover:border-brand-violet hover:text-brand-violet"
                >
                  {niche}
                  <span className="text-xs text-muted">{count}</span>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/niches"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-violet"
              >
                See every niche
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Features */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-lg text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight">
              Everything you&apos;d want to check, already checked
            </h2>
            <p className="mt-3 text-muted">
              Built so you can move fast without trading away the diligence a
              real backlink deal deserves.
            </p>
          </div>
          <div className="grid gap-x-8 gap-y-10 md:grid-cols-3">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              const tint = TINTS[f.tint];
              return (
                <div key={f.title}>
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-chip ${tint.bg} ${tint.text}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mb-2 font-display text-lg font-medium">{f.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-2 text-center font-display text-3xl font-medium tracking-tight">
          How it works
        </h2>
        <p className="mx-auto mb-12 max-w-md text-center text-muted">
          From browsing to a live link, in three steps.
        </p>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className="group relative rounded-chip border border-line bg-white p-6 transition-shadow hover:shadow-md"
            >
              <span className="brand-gradient-text font-display text-4xl font-semibold">
                {s.n}
              </span>
              <p className="mb-2 mt-3 font-display text-lg font-medium">{s.title}</p>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-line md:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="border-t border-line bg-paper">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto mb-12 max-w-lg text-center">
            <h2 className="font-display text-3xl font-medium tracking-tight">
              Whatever stage your link building is at
            </h2>
            <p className="mt-3 text-muted">
              The marketplace flexes to the goal, not the other way around.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {USE_CASES.map((u) => {
              const Icon = u.icon;
              const tint = TINTS[u.tint];
              return (
                <div
                  key={u.title}
                  className="rounded-chip bg-white p-6 shadow-sm ring-1 ring-line"
                >
                  <div
                    className={`mb-4 flex h-11 w-11 items-center justify-center rounded-chip ${tint.bg} ${tint.text}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mb-2 font-display text-base font-medium">{u.title}</p>
                  <p className="mb-4 text-sm leading-relaxed text-muted">{u.body}</p>
                  <ul className="space-y-1.5">
                    {u.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2 text-sm text-muted">
                        <Check className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tint.text}`} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <p className="mb-10 font-mono text-xs uppercase tracking-widest text-muted">
            Built for people who actually check before they buy
          </p>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="rounded-chip border border-line p-6">
              <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-brand-blue" />
              <p className="font-display text-3xl font-semibold text-brand-blue">
                {(nicheSites?.length ?? 0) > 0 ? `${nicheSites!.length}+` : "100%"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {(nicheSites?.length ?? 0) > 0
                  ? "Ownership-verified listings live now"
                  : "Ownership-verified listings"}
              </p>
            </div>
            <div className="rounded-chip border border-line p-6">
              <Lock className="mx-auto mb-2 h-6 w-6 text-signal" />
              <p className="font-display text-3xl font-semibold text-signal">Escrow</p>
              <p className="mt-1 text-sm text-muted">Protected on every paid order</p>
            </div>
            <div className="rounded-chip border border-line p-6">
              <Sparkles className="mx-auto mb-2 h-6 w-6 text-amber" />
              <p className="font-display text-3xl font-semibold text-amber">Free</p>
              <p className="mt-1 text-sm text-muted">To browse and list your site</p>
            </div>
          </div>
        </div>
      </section>

      {/* From the blog */}
      {articles && articles.length > 0 && (
        <section className="border-t border-line bg-paper">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="mb-3 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-brand-violet">
                  <Newspaper className="h-3.5 w-3.5" />
                  From the blog
                </p>
                <h2 className="font-display text-3xl font-medium tracking-tight">
                  Guides on link building &amp; organic growth
                </h2>
              </div>
              <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-brand-violet">
                All articles
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <ArticleCardGrid articles={articles} />
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="mb-10 text-center font-display text-3xl font-medium tracking-tight">
          Frequently asked questions
        </h2>
        <div className="flex flex-col divide-y divide-line">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5 first:pt-0 last:pb-0">
              <p className="font-medium text-ink">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative mx-auto max-w-6xl overflow-hidden px-6 py-20 text-center">
        <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.06]" />
        <div
          className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[300px] w-[600px] -translate-x-1/2 rounded-full opacity-[0.12] blur-3xl"
          style={{ background: "#6D35F9" }}
        />
        <h2 className="mb-3 font-display text-3xl font-medium tracking-tight">
          Ready to build cleaner backlinks?
        </h2>
        <p className="mx-auto mb-8 max-w-md text-muted">
          Free to browse metrics. List your first site in a few minutes — no
          cost to get approved.
        </p>
        <Link href="/register">
          <Button size="lg">
            Get started
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        </Link>
      </section>
    </main>
  );
}
