import type { Metadata } from "next";
import Link from "next/link";
import { Coins, Gauge, Link2, QrCode, Wrench } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { PUBLIC_TOOLS_FLAG } from "@/lib/growth/rules";

export const metadata: Metadata = {
  title: "Free SEO and link tools",
  description: "Free tools: a Domain Rating checker, a backlink price check based on live listings, a UTM link builder and a QR code generator.",
  alternates: { canonical: "/tools" },
};

const TOOLS = [
  { href: "/tools/dr-checker", icon: Gauge, title: "Domain Rating checker", text: "See the Ahrefs Domain Rating of any website." },
  { href: "/tools/price-check", icon: Coins, title: "Backlink price check", text: "Compare prices of listed sites with a similar Domain Rating. Based only on live LinkLazy listings." },
  { href: "/tools/utm-builder", icon: Link2, title: "UTM link builder", text: "Tag your links so analytics shows where visitors came from." },
  { href: "/tools/qr-code", icon: QrCode, title: "QR code generator", text: "Make a QR code for a link and download it as PNG or SVG." },
] as const;

export default async function ToolsIndexPage() {
  const enabled = await isFeatureEnabled(PUBLIC_TOOLS_FLAG);
  return (
    <main>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Tools", path: "/tools" }])} />
      <PageHero eyebrow="Free tools" eyebrowIcon={Wrench} title="Free SEO and link tools" description="Small, useful tools you can use without an account." />
      <div className="mx-auto max-w-3xl px-6 py-12">
        {!enabled ? (
          <p role="status" className="rounded-chip border border-line bg-paper p-5 text-sm text-muted">These tools are switched off right now. Please check back later.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="flex h-full flex-col gap-2 rounded-chip border border-line bg-white p-5 hover:bg-paper">
                  <t.icon className="h-5 w-5 text-brand-violet" />
                  <span className="font-display text-lg font-medium">{t.title}</span>
                  <span className="text-sm text-muted">{t.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-10 text-center text-sm text-muted">
          Want sites for your own backlinks? <Link href="/recommendations" className="text-brand-violet underline">Find sites for your website</Link> · <Link href="/getting-started" className="text-brand-violet underline">Getting started</Link>
        </p>
      </div>
    </main>
  );
}
