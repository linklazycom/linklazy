"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ReferralLinkBox({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 rounded-chip border border-line bg-white p-3">
      <input
        readOnly
        value={link}
        className="flex-1 truncate bg-transparent text-sm text-muted outline-none"
      />
      <Button type="button" size="sm" variant="secondary" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy"}
      </Button>
    </div>
  );
}
