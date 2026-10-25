import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { isFeatureEnabled } from "@/lib/feature-flags";

export interface ToolCrumb {
  name: string;
  path: string;
}

/**
 * The common frame of every public tool page (Batch 18): hero, breadcrumb data, and a polite notice instead of the tool when an
 * admin has switched the tool off (public visitors are not covered by the dashboard gate, so the page checks the switch itself).
 */
export async function ToolShell({
  flag,
  eyebrow,
  icon,
  title,
  description,
  trail,
  children,
}: {
  flag: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  description: string;
  trail: ToolCrumb[];
  children: React.ReactNode;
}) {
  const enabled = await isFeatureEnabled(flag);
  return (
    <main>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, ...trail])} />
      <PageHero eyebrow={eyebrow} eyebrowIcon={icon} title={title} description={description} />
      <div className="mx-auto max-w-2xl px-6 py-12">
        {enabled ? (
          children
        ) : (
          <p role="status" className="rounded-chip border border-line bg-paper p-5 text-sm text-muted">
            This tool is switched off right now. Please check back later, or <Link href="/browse" className="text-brand-violet underline">browse listings</Link> in the meantime.
          </p>
        )}
        <p className="mt-10 text-center text-sm text-muted">
          <Link href="/tools" className="underline">All free tools</Link> · <Link href="/getting-started" className="underline">Getting started</Link>
        </p>
      </div>
    </main>
  );
}
