"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function MessageSellerButton({ siteId }: { siteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId }),
    });
    setBusy(false);
    if (!res.ok) return;
    const { id } = await res.json();
    router.push(`/dashboard/inquiries/${id}`);
  }

  return (
    <Button size="sm" variant="secondary" onClick={start} disabled={busy}>
      {busy ? "Opening…" : "Message seller (pre-sale question)"}
    </Button>
  );
}
