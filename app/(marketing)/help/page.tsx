import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { PageHero } from "@/components/marketing/page-hero";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema } from "@/lib/seo";
import { getFlags } from "@/lib/feature-flags";
import { TOOL_FLAG_KEYS, toolForPath } from "@/lib/features/registry";
import { USER_HELP, USER_HELP_AREAS } from "@/lib/help/user-help";

export const metadata: Metadata = {
  title: "Help center",
  description: "Plain-English guides to every page of the LinkLazy dashboard: what it is, why you would use it and how to use it.",
  alternates: { canonical: "/help" },
};

export const revalidate = 300;

/** The dashboard path a help key describes, with "[id]" replaced by a sample segment so the tool registry can place it. */
const samplePath = (key: string) => key.replace(/\[id\]/g, "x");
const slug = (area: string) => area.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export default async function HelpCenterPage() {
  const flags = await getFlags(TOOL_FLAG_KEYS);
  // A tool an admin switched off is left out, so the page never describes something members cannot open.
  const entries = Object.entries(USER_HELP).filter(([key]) => {
    const hit = toolForPath(samplePath(key));
    return !hit || flags[hit.tool.flagKey] !== false;
  });

  return (
    <main>
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Help center", path: "/help" }])} />
      <PageHero eyebrow="Help center" eyebrowIcon={LifeBuoy} title="How every page works" description="What each part of your dashboard is for, and how to use it. The same text opens from the ? button at the top of each dashboard page." />
      <div className="mx-auto max-w-3xl space-y-10 px-6 py-12">
        <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
          {USER_HELP_AREAS.map((area) => (
            <a key={area} href={`#${slug(area)}`} className="rounded-chip border border-line bg-white px-3 py-1 hover:border-brand-violet">{area}</a>
          ))}
        </nav>
        {USER_HELP_AREAS.map((area) => {
          const inArea = entries.filter(([, e]) => e.area === area);
          if (!inArea.length) return null;
          return (
            <section key={area} id={slug(area)} className="space-y-4">
              <h2 className="font-display text-2xl font-medium">{area}</h2>
              {inArea.map(([key, e]) => (
                <details key={key} className="rounded-chip border border-line bg-white p-4">
                  <summary className="cursor-pointer font-medium">{e.title}</summary>
                  <div className="mt-3 space-y-3 text-sm">
                    <p className="text-muted">{e.what}</p>
                    <p><strong>Why use it:</strong> <span className="text-muted">{e.why}</span></p>
                    <div>
                      <strong>How to use it</strong>
                      <ol className="mt-1 list-decimal space-y-1 pl-5 text-muted">{e.how.map((s, i) => <li key={i}>{s}</li>)}</ol>
                    </div>
                    {e.watch && e.watch.length > 0 && (
                      <div>
                        <strong>Good to know</strong>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">{e.watch.map((s, i) => <li key={i}>{s}</li>)}</ul>
                      </div>
                    )}
                  </div>
                </details>
              ))}
            </section>
          );
        })}
        <section className="rounded-chip border border-line bg-paper p-6 text-sm">
          <h2 className="mb-2 font-display text-lg font-medium">Still stuck?</h2>
          <p className="text-muted">
            Open a ticket from <Link href="/dashboard/support" className="text-brand-violet underline">your dashboard</Link> or use the{" "}
            <Link href="/contact" className="text-brand-violet underline">contact page</Link>. New here? Start with{" "}
            <Link href="/getting-started" className="text-brand-violet underline">Getting started</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
