import type { Metadata } from "next";
import Link from "next/link";
import { Gift, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  title: "Referral Program",
  description: "Earn 50% of LinkLazy's commission by referring new members.",
};

const STEPS = [
  {
    n: "1",
    title: "Get your link",
    body: "Every LinkLazy account has a unique referral link, found under Dashboard → Referrals.",
  },
  {
    n: "2",
    title: "Share it",
    body: "Send it to anyone who might buy or sell backlinks — a fellow SEO, agency, or site owner.",
  },
  {
    n: "3",
    title: "Earn automatically",
    body: "When someone you referred completes a paid order, 50% of LinkLazy's commission on that order is credited to your account — no manual claiming needed.",
  },
];

const FAQS = [
  {
    q: "Is there a limit to how much I can earn?",
    a: "No — every completed paid order from your referrals earns a credit, with no cap on the number of referrals or total earnings.",
  },
  {
    q: "When do I get credited?",
    a: "Automatically, as soon as a referred user's paid order is marked complete. You can track every credit under Dashboard → Referrals.",
  },
];

export default async function ReferralsMarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main>
      <PageHero
        eyebrow="Referral program"
        eyebrowIcon={Gift}
        title="Earn 50% of our commission, for every order your referrals complete"
        wide
      />
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10 text-center">
        <p className="mb-8 text-muted">
          No cap, no expiry — every completed paid order from someone you
          referred earns you a credit, automatically.
        </p>
        {user ? (
          <Link href="/dashboard/referrals">
            <Button size="lg">Get my referral link</Button>
          </Link>
        ) : (
          <Link href="/register">
            <Button size="lg">Sign up to get your link</Button>
          </Link>
        )}
      </div>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-10 text-center font-display text-2xl font-medium tracking-tight">
          How it works
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-chip border border-line bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="brand-gradient-text font-display text-3xl font-semibold">{s.n}</span>
              <p className="mb-2 mt-2 font-display text-lg font-medium">{s.title}</p>
              <p className="text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-8 flex items-center justify-center gap-2">
          <HelpCircle className="h-5 w-5 text-brand-violet" />
          <h2 className="font-display text-2xl font-medium tracking-tight">FAQ</h2>
        </div>
        <div className="flex flex-col divide-y divide-line">
          {FAQS.map((f) => (
            <div key={f.q} className="py-5 first:pt-0">
              <p className="font-medium text-ink">{f.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.a}</p>
            </div>
          ))}
          <div className="py-5">
            <p className="font-medium text-ink">How do I withdraw my earnings?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              Credits currently accumulate as a running balance in your
              dashboard. A withdrawal process is coming soon — see our{" "}
              <Link href="/terms" className="text-brand-violet underline">
                Terms &amp; Conditions
              </Link>{" "}
              for the current program terms.
            </p>
          </div>
          <div className="py-5 last:pb-0">
            <p className="font-medium text-ink">Can I refer myself or use fake accounts?</p>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              No — self-referrals and fraudulent signups don&apos;t earn
              credits, and abuse of the program can result in forfeited
              credits or account suspension.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
