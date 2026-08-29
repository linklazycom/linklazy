import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  ShieldCheck,
  BarChart3,
  Wallet,
  Layers,
  Gift,
  CheckCircle2,
  ArrowRight,
  Compass,
  Route,
  Newspaper,
  Megaphone,
} from "lucide-react";
import { searchPexelsPhoto } from "@/lib/pexels";
import { PageHero } from "@/components/marketing/page-hero";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "About LinkLazy — Verified Backlink Marketplace",
  description:
    "LinkLazy is a vetted marketplace for buying and exchanging backlinks: ownership-verified listings, Ahrefs-checked Domain Rating, escrow-protected payments, and transparent pricing.",
  openGraph: {
    title: "About LinkLazy — Verified Backlink Marketplace",
    description:
      "Ownership-verified listings, escrow-protected payments, and transparent pricing — how LinkLazy makes link building trustworthy.",
  },
};

const DIFFERENTIATORS = [
  {
    title: "Ownership verification",
    body: "Every listing goes through an ownership check before it's approved — no anonymous domains, no borrowed metrics.",
    icon: ShieldCheck,
  },
  {
    title: "Ahrefs-verified Domain Rating",
    body: "DR can be checked directly against Ahrefs' own API, not just a self-reported number a seller typed in.",
    icon: BarChart3,
  },
  {
    title: "Escrow-protected payments",
    body: "Paid orders hold funds in escrow until you confirm the link is live and correct — sellers are paid after delivery, not before.",
    icon: ShieldCheck,
  },
  {
    title: "Pay-Per-View pricing",
    body: "List or buy placements priced by delivered views instead of a flat fee — pay in proportion to what a page actually earns.",
    icon: Wallet,
  },
  {
    title: "Bulk ordering",
    body: "Buyers can select several vetted sites and check out in one order instead of negotiating each placement separately.",
    icon: Layers,
  },
  {
    title: "Referral earnings",
    body: "Refer a buyer or seller and earn 50% of LinkLazy's commission on every completed order they make, credited automatically.",
    icon: Gift,
  },
];

const PRICING_ROWS = [
  { who: "Everyone", item: "Creating an account & browsing listings", cost: "Free" },
  { who: "Sellers", item: "Listing a site on the marketplace", cost: "Free" },
  { who: "Sellers", item: "Commission on a completed paid order", cost: "20% → 15% → 10%, tiered by monthly sales volume" },
  { who: "Buyers", item: "A direct link exchange", cost: "Free — no payment involved" },
  { who: "Buyers", item: "A paid placement order", cost: "The listing's stated price, held in escrow until delivery" },
  { who: "Buyers", item: "Unlocking a Pay-Per-View listing's full details", cost: "Priced per view, set by the seller" },
];

const FLOW_STEPS = [
  "List or browse",
  "Request a link",
  "Delivery & proof",
  "Confirm & release",
  "Review",
];

const EXPLORE_LINKS = [
  { href: "/browse", label: "Browse listings", body: "See what's live on the marketplace right now.", icon: Compass },
  { href: "/niches", label: "Niches", body: "Every content niche represented on LinkLazy.", icon: Layers },
  { href: "/how-it-works", label: "How it works", body: "The full order flow, step by step.", icon: Route },
  { href: "/trust", label: "Trust & payment protection", body: "How escrow and dispute review work.", icon: ShieldCheck },
  { href: "/blog", label: "Blog", body: "Guides on link building and organic growth.", icon: Newspaper },
  { href: "/press-releases", label: "Press releases", body: "Distribute an announcement to real, indexed sites.", icon: Megaphone },
];

export default async function AboutPage() {
  const supabase = await createClient();

  const [heroPhoto, secondPhoto, { count: siteCount }, { data: nicheRows }] = await Promise.all([
    searchPexelsPhoto("team working office collaboration"),
    searchPexelsPhoto("handshake business deal agreement"),
    supabase.from("sites").select("id", { count: "exact", head: true }).eq("status", "approved"),
    supabase.from("sites").select("niche").eq("status", "approved"),
  ]);

  const nicheCount = new Set((nicheRows ?? []).map((r) => r.niche.trim())).size;

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com" },
      {
        "@type": "ListItem",
        position: 2,
        name: "About",
        item: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://linklazy.com"}/about`,
      },
    ],
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <PageHero
        eyebrow="Our story"
        eyebrowIcon={Users}
        title="About LinkLazy"
        description="A vetted marketplace built so link building doesn't require blind trust."
      />

      <div className="mx-auto max-w-3xl px-6 py-16">
        {heroPhoto && (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-chip shadow-sm">
            <Image src={heroPhoto.url} alt={heroPhoto.alt} fill className="object-cover" unoptimized />
          </div>
        )}

        <div className="space-y-4 text-[15px] leading-7 text-ink">
          <p>
            Link building is one of the most time-consuming parts of SEO —
            and one of the easiest places to get scammed by inflated
            metrics, dead sites, or links that quietly disappear a week
            after you pay for them.
          </p>
          <p>
            LinkLazy exists to fix that. Every site on the platform goes
            through an ownership check before it&apos;s listed, metrics are
            shown transparently up front, and every order — whether it&apos;s
            a direct exchange or a paid placement — goes through a delivery
            and confirmation flow before money or links change hands.
          </p>
          <p>
            We&apos;re built for site owners and marketers who want link
            building to be straightforward: clear metrics, verified
            sellers, and a paper trail for every transaction.
          </p>
        </div>

        {/* By the numbers — real, live counts, not marketing copy */}
        <div className="my-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-chip border border-line bg-paper p-4 text-center">
            <p className="font-display text-2xl font-semibold text-brand-violet">
              {siteCount ?? 0}+
            </p>
            <p className="mt-1 text-xs text-muted">Verified listings</p>
          </div>
          <div className="rounded-chip border border-line bg-paper p-4 text-center">
            <p className="font-display text-2xl font-semibold text-brand-violet">{nicheCount}</p>
            <p className="mt-1 text-xs text-muted">Niches covered</p>
          </div>
          <div className="rounded-chip border border-line bg-paper p-4 text-center">
            <p className="font-display text-2xl font-semibold text-brand-violet">10–20%</p>
            <p className="mt-1 text-xs text-muted">Seller commission, tiered down with volume</p>
          </div>
          <div className="rounded-chip border border-line bg-paper p-4 text-center">
            <p className="font-display text-2xl font-semibold text-brand-violet">৳0</p>
            <p className="mt-1 text-xs text-muted">To join & list a site</p>
          </div>
        </div>

        <div className="space-y-4 text-[15px] leading-7 text-ink">
          <p>
            Since launch, we&apos;ve added ways to make that easier at
            scale — Domain Rating verified directly against Ahrefs&apos;
            own data, a Pay-Per-View option for buyers who&apos;d rather pay
            for delivered traffic than a flat fee, and bulk ordering for
            running a full campaign across multiple sites in one checkout.
            The core promise hasn&apos;t changed: what you see on a listing
            is what you get.
          </p>
        </div>

        {/* What makes LinkLazy different */}
        <section className="mt-14">
          <h2 className="mb-6 font-display text-2xl font-medium tracking-tight">
            What makes LinkLazy different
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {DIFFERENTIATORS.map((d) => {
              const Icon = d.icon;
              return (
                <div key={d.title} className="rounded-chip border border-line bg-white p-5">
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-chip bg-brand-soft text-brand-violet">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="mb-1.5 font-display text-base font-medium">{d.title}</p>
                  <p className="text-sm leading-relaxed text-muted">{d.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pricing summary table */}
        <section className="mt-14">
          <h2 className="mb-2 font-display text-2xl font-medium tracking-tight">How pricing works</h2>
          <p className="mb-6 text-sm text-muted">
            No subscriptions, no listing fees. LinkLazy only makes money
            when a paid order actually completes.
          </p>
          <div className="overflow-x-auto rounded-chip border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Who</th>
                  <th className="px-4 py-3 font-medium">What</th>
                  <th className="px-4 py-3 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-white">
                {PRICING_ROWS.map((row) => (
                  <tr key={row.item}>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{row.who}</td>
                    <td className="px-4 py-3">{row.item}</td>
                    <td className="px-4 py-3 font-medium">{row.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {secondPhoto && (
          <div className="relative my-14 aspect-[16/9] overflow-hidden rounded-chip shadow-sm">
            <Image src={secondPhoto.url} alt={secondPhoto.alt} fill className="object-cover" unoptimized />
          </div>
        )}

        {/* Condensed flow + link out to the full page */}
        <section className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              From listing to a confirmed link
            </h2>
            <Link
              href="/how-it-works"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-violet"
            >
              See the full flow
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ol className="grid gap-3 sm:grid-cols-5">
            {FLOW_STEPS.map((step, i) => (
              <li
                key={step}
                className="flex items-center gap-2 rounded-chip border border-line bg-white p-3 text-sm sm:flex-col sm:items-start sm:gap-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-gradient font-display text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span className="font-medium">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Trust callout */}
        <section className="mt-14 rounded-chip border border-line bg-paper p-6">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-signal" />
            <h2 className="font-display text-xl font-medium">Built-in payment protection</h2>
          </div>
          <ul className="mb-4 space-y-2 text-sm text-ink">
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              Paid orders hold funds in escrow until you confirm delivery.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              Disputes that can&apos;t be resolved directly get an admin review.
            </li>
            <li className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-signal" />
              Reviews from every completed order build a visible trust record for each seller.
            </li>
          </ul>
          <Link href="/trust" className="inline-flex items-center gap-1 text-sm font-medium text-brand-violet">
            Read the full trust & payment protection policy
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        {/* Explore the site — internal links */}
        <section className="mt-14">
          <h2 className="mb-6 font-display text-2xl font-medium tracking-tight">Explore LinkLazy</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {EXPLORE_LINKS.map((l) => {
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group flex items-start gap-3 rounded-chip border border-line bg-white p-4 transition-colors hover:border-brand-violet"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-chip bg-brand-soft text-brand-violet">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <p className="font-medium group-hover:text-brand-violet">{l.label}</p>
                    <p className="mt-0.5 text-sm text-muted">{l.body}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-14 rounded-chip border border-line bg-white p-6 text-center">
          <p className="mb-1 font-display text-lg font-medium">Ready to see it for yourself?</p>
          <p className="mb-4 text-sm text-muted">
            Browse live listings, or create a free account to list your own site.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/browse"
              className="inline-flex h-10 items-center justify-center rounded-chip border border-line bg-white px-5 text-sm font-medium text-ink transition-colors hover:border-ink"
            >
              Browse listings
            </Link>
            <Link
              href="/register"
              className="inline-flex h-10 items-center justify-center rounded-chip bg-ink px-5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Create free account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
