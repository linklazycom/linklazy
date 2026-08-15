"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeletePlanButton({ planId, planName }: { planId: string; planName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${planName}"? This removes it from the public pricing page immediately.`)) {
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("pricing_plans").delete().eq("id", planId);
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      className="rounded-chip border border-line px-3 py-1.5 text-sm text-red-600 hover:border-red-300"
    >
      {busy ? "…" : "Delete"}
    </button>
  );
}
