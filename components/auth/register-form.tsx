"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  // A plan must be chosen on /pricing first — that page links here with
  // these params. If they're missing (e.g. someone bookmarked /register
  // directly), we bounce back to /pricing so nobody can create an account
  // without going through plan selection first.
  const planGroup = searchParams.get("group") as "buyer" | "seller" | null;
  const planSlug = searchParams.get("plan");
  const planName = searchParams.get("name");
  const planPrice = searchParams.get("price");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller" | "both">(planGroup ?? "buyer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "creating" | "purchasing">("form");

  const refCode = searchParams.get("ref");

  useEffect(() => {
    if (!planGroup || !planSlug) router.replace("/pricing");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planGroup, planSlug]);

  if (!planGroup || !planSlug) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setStep("creating");

    // Step 1 — create the account. Supabase signs the user in immediately
    // (even before their email is confirmed) — the dashboard shows a
    // verification reminder banner until they click the email link.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      setStep("form");
      return;
    }

    if (!data.user) {
      setError("Could not create account. Please try again.");
      setLoading(false);
      setStep("form");
      return;
    }

    // The `handle_new_user` trigger creates the profiles row automatically.
    // We update its role (and optionally referred_by) here after the fact.
    const updates: { role: typeof role; referred_by?: string } = { role };

    if (refCode) {
      const res = await fetch(`/api/referral/resolve?code=${encodeURIComponent(refCode)}`);
      const { referrerId } = await res.json();
      if (referrerId && referrerId !== data.user.id) {
        updates.referred_by = referrerId;
      }
    }

    await supabase.from("profiles").update(updates).eq("id", data.user.id);

    // Step 2 — "purchase" the plan they picked on /pricing. Free plans are
    // activated instantly server-side; paid plans redirect to the gateway.
    // The account already exists and is logged in either way.
    setStep("purchasing");
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: planGroup, plan: planSlug }),
      });
      const body = await res.json();

      if (res.ok && body.redirectUrl) {
        window.location.href = body.redirectUrl;
        return;
      }
      // Free plan (or subscribe failed silently) — either way the account
      // exists and is logged in, so send them into the dashboard rather
      // than stranding them on an error screen.
      router.push("/dashboard?welcome=1");
      router.refresh();
    } catch {
      router.push("/dashboard?welcome=1");
      router.refresh();
    }
  }

  return (
    <div>
      <h1 className="mb-2 font-display text-xl font-medium">Create an account</h1>

      <div className="mb-6 rounded-chip border border-brand-violet/30 bg-brand-soft px-4 py-3 text-sm">
        <p className="font-medium">
          Selected plan: {planName ?? planSlug} · {planGroup === "buyer" ? "Buyer" : "Seller"}
        </p>
        {planPrice && Number(planPrice) > 0 ? (
          <p className="mt-0.5 text-xs text-muted">
            ৳{Number(planPrice).toLocaleString()}/mo — you'll be taken to payment right after
            creating your account.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">Free — no payment needed.</p>
        )}
        <Link href="/pricing" className="mt-1 inline-block text-xs text-brand-blue underline">
          Change plan
        </Link>
      </div>

      {refCode && (
        <p className="mb-4 rounded-chip border border-brand-violet/30 bg-brand-soft px-3 py-2 text-xs text-ink">
          You were referred by a LinkLazy member — thanks for signing up!
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="fullName" className="mb-1 block text-sm text-muted">
            Full name
          </label>
          <input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted">I want to</label>
          <div className="grid grid-cols-3 gap-2">
            {(["buyer", "seller", "both"] as const).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRole(r)}
                className={`rounded-chip border px-2 py-2 text-sm capitalize ${
                  role === r ? "border-ink bg-ink text-paper" : "border-line text-ink"
                }`}
              >
                {r === "buyer" ? "Buy links" : r === "seller" ? "Sell links" : "Both"}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {step === "creating"
            ? "Creating account…"
            : step === "purchasing"
              ? "Setting up your plan…"
              : "Create account & continue"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline">
          Log in
        </Link>
      </p>
    </div>
  );
}

// FIX: useSearchParams() must be wrapped in <Suspense> in Next.js App
// Router, or the build fails with "useSearchParams() should be wrapped
// in a suspense boundary" — the form logic was moved into RegisterForm
// above so this wrapper can provide that boundary.
export function RegisterFormWithSuspense() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
