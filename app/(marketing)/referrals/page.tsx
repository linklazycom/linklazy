import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

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

export default async function ReferralsMarketingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main>
      <section className="relative overflow-hidden border-b border-line bg-white text-center">
        <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-[0.05]" />
        <div className="mx-auto max-w-2xl px-6 py-16">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-violet">
            Referral program
          </p>
          <h1 className="mb-3 font-display text-3xl font-medium">
            Earn 50% of our commission, for every order your referrals complete
          </h1>
          <p className="mb-8 text-muted">
            No cap, no expiry — every completed paid order from someone you
            referred earns you a credit, automatically.
          </p>
          {user ? (
            <Link href="/dashboard/referrals">
              <Button size="lg">Get my referral link</Button>
            </Link>
          ) : (
            <Link href="/pricing">
              <Button size="lg">Sign up to get your link</Button>
            </Link>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-10 text-center font-display text-2xl font-medium">How it works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-chip border border-line bg-white p-6">
              <span className="brand-gradient-text font-display text-3xl font-semibold">{s.n}</span>
              <p className="mb-2 mt-2 font-display text-lg font-medium">{s.title}</p>
              <p className="text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-16">
        <h2 className="mb-8 text-center font-display text-2xl font-medium">FAQ</h2>
        <div className="flex flex-col gap-6">
          <div>
            <p className="font-medium">Is there a limit to how much I can earn?</p>
            <p className="mt-1 text-sm text-muted">
              No — every completed paid order from your referrals earns a
              credit, with no cap on the number of referrals or total
              earnings.
            </p>
          </div>
          <div>
            <p className="font-medium">When do I get credited?</p>
            <p className="mt-1 text-sm text-muted">
              Automatically, as soon as a referred user's paid order is
              marked complete. You can track every credit under Dashboard →
              Referrals.
            </p>
          </div>
          <div>
            <p className="font-medium">How do I withdraw my earnings?</p>
            <p className="mt-1 text-sm text-muted">
              Credits currently accumulate as a running balance in your
              dashboard. A withdrawal process is coming soon — see our{" "}
              <Link href="/terms" className="underline">
                Terms &amp; Conditions
              </Link>{" "}
              for the current program terms.
            </p>
          </div>
          <div>
            <p className="font-medium">Can I refer myself or use fake accounts?</p>
            <p className="mt-1 text-sm text-muted">
              No — self-referrals and fraudulent signups don't earn credits,
              and abuse of the program can result in forfeited credits or
              account suspension.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
