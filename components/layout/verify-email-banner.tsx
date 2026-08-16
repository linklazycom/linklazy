"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function VerifyEmailBanner({ email }: { email: string }) {
  const supabase = createClient();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setBusy(true);
    setError(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (resendError) {
      setError(resendError.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-chip border border-red-300 bg-red-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-red-700">
        <span className="font-medium">Please verify your email</span> — check {email} for a
        confirmation link. Some actions (unlocking listings, paid orders, withdrawals) are
        limited until you verify.
      </p>
      <div className="flex shrink-0 items-center gap-3">
        {sent ? (
          <span className="text-xs text-red-700">Verification email sent.</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={busy}
            className="whitespace-nowrap rounded-chip border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {busy ? "Sending…" : "Resend email"}
          </button>
        )}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}
