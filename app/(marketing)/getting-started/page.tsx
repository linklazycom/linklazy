import type { Metadata } from "next";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Getting started",
  description: "Three steps to buy backlinks or sell placements on LinkLazy, and where to find the free tools.",
  alternates: { canonical: "/getting-started" },
};

const BUYER = [
  { title: "Create a free account", text: "Sign up with your email. There is no monthly fee to join." },
  { title: "Find sites that fit", text: "Browse listings and filter by niche, DA, price and link type, or paste your website on the recommendations page to see sites in your niche. Then propose an exchange or pay for a placement, whichever the seller accepts." },
  { title: "Confirm the link and release payment", text: "The seller places the link and submits the live address as proof. You check it. For paid orders, payment is released to the seller only when you confirm. Then leave a review." },
] as const;

const SELLER = [
  { title: "Create an account and add your site", text: "Add your site with its metrics and choose what you accept: link exchange, paid placement, or pay-per-view." },
  { title: "Prove ownership and get approved", text: "Every listing goes through an ownership check and approval before buyers can see it." },
  { title: "Deliver and get paid", text: "When an order arrives, place the link within the agreed time and submit the live address. Once the buyer confirms, your earnings are added to your wallet and you can request a withdrawal." },
] as const;

function Steps({ title, steps, cta }: { title: string; steps: readonly { title: string; text: string }[]; cta: { href: string; label: string } }) {
  return (
    <section className="rounded-chip border border-line bg-white p-6">
      <h2 className="mb-5 font-display text-xl font-medium">{title}</h2>
      <ol className="space-y-5">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-medium text-brand-violet">{i + 1}</span>
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <Link href={cta.href} className="mt-6 inline-block rounded-chip bg-brand-violet px-4 py-2 text-sm font-medium text-white">{cta.label}</Link>
    </section>
  );
}

export default function GettingStartedPage() {
  return (
    <main>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Getting started", path: "/getting-started" }])} />
      <PageHero eyebrow="Getting started" eyebrowIcon={Rocket} title="Three steps, whichever side you are on" description="Buying a link or selling a placement: here is the short version." />
      <div className="mx-auto max-w-3xl space-y-8 px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          <Steps title="If you want links" steps={BUYER} cta={{ href: "/browse", label: "Browse listings" }} />
          <Steps title="If you own a site" steps={SELLER} cta={{ href: "/register", label: "Create an account" }} />
        </div>
        <section className="rounded-chip border border-line bg-paper p-6 text-sm">
          <h2 className="mb-2 font-display text-lg font-medium">Not ready to sign up?</h2>
          <p className="text-muted">
            Try the <Link href="/tools" className="text-brand-violet underline">free tools</Link> or{" "}
            <Link href="/recommendations" className="text-brand-violet underline">see which sites match your website</Link>, no account needed. For the full picture, read{" "}
            <Link href="/how-it-works" className="text-brand-violet underline">how it works</Link>, or{" "}
            <Link href="/support" className="text-brand-violet underline">ask us a question</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
