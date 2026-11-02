"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

/** Revoke button for one API key (Admin > API keys). */
export function AdminApiKeyActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function revoke() {
    const note = window.prompt("কী বাতিল করছেন; কারণ লিখুন (মালিককে ইমেইলে জানানো হবে। বাতিল কী আর চালু করা যায় না):", "Misuse");
    if (note === null) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/api-keys/${id}`, "PATCH", { action: "revoke", note });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" type="button" disabled={busy} onClick={revoke}>Revoke</Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
