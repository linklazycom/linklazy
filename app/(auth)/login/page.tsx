"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function safeNext(next: string | null): string {
  // Only ever redirect within the app — an absolute/external `next` value
  // would make this an open redirect.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = safeNext(searchParams.get("next"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-6 font-display text-xl font-medium">Log in</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        No account?{" "}
        <Link href={next !== "/dashboard" ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="text-ink underline">
          Register
        </Link>
      </p>
    </div>
  );
}

// useSearchParams() must be wrapped in <Suspense> in Next.js App Router,
// or the build fails with "useSearchParams() should be wrapped in a
// suspense boundary" (see the same fix in register-form.tsx).
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
