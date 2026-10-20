"use client";

import { useState } from "react";

export function UnsubscribeForm({ token, email }: { token: string; email: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function confirm() {
    setState("busy");
    try {
      const res = await fetch("/api/outreach/unsubscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p role="status" className="rounded-chip border border-line bg-white p-4 text-sm">
        Done. {email} will not receive any more emails from us.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm">Stop all emails from us to <strong>{email}</strong>?</p>
      <button type="button" onClick={confirm} disabled={state === "busy"} className="rounded-chip bg-ink px-4 py-2 text-sm text-white disabled:opacity-60">
        {state === "busy" ? "Please wait…" : "Yes, unsubscribe me"}
      </button>
      {state === "error" && <p role="alert" className="text-sm text-red-700">Something went wrong. Please try again in a moment.</p>}
    </div>
  );
}
