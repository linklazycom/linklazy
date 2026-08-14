"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"buyer" | "seller" | "both">("buyer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refCode = searchParams.get("ref");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // The `handle_new_user` trigger creates the profiles row automatically.
    // We update its role (and optionally referred_by) here after the fact.
    if (data.user) {
      const updates: { role: typeof role; referred_by?: string } = { role };

      if (refCode) {
        const res = await fetch(`/api/referral/resolve?code=${encodeURIComponent(refCode)}`);
        const { referrerId } = await res.json();

        // Ignore a self-referral or an invalid/unknown code silently —
        // signup still succeeds either way.
        if (referrerId && referrerId !== data.user.id) {
          updates.referred_by = referrerId;
        }
      }

      await supabase.from("profiles").update(updates).eq("id", data.user.id);
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-medium">Create an account</h1>
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
          {loading ? "Creating account…" : "Create account"}
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
// above so this default export can provide that boundary.
export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
