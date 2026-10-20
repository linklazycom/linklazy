"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/components/links/api";
import { FINAL_STATUSES } from "@/lib/outreach/rules";

export function ContactRowActions({ id, status, tags }: { id: string; status: string; tags: string[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const final = FINAL_STATUSES.includes(status);

  async function call(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await apiRequest(`/api/admin/outreach/contacts/${id}`, method, body);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.refresh();
  }

  function editTags() {
    const next = window.prompt("Tags (comma separated, up to 10)", tags.join(", "));
    if (next !== null) void call("PATCH", { tags: next });
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {!final && status !== "active" && <button type="button" disabled={busy} className="underline" onClick={() => call("PATCH", { status: "active" })}>Activate</button>}
      {!final && status === "active" && <button type="button" disabled={busy} className="underline" onClick={() => call("PATCH", { status: "held" })}>Hold</button>}
      {!final && status !== "blocked" && <button type="button" disabled={busy} className="underline" onClick={() => call("PATCH", { status: "blocked" })}>Block</button>}
      <button type="button" disabled={busy} className="underline" onClick={editTags}>Tags</button>
      <button
        type="button"
        disabled={busy}
        className="underline"
        onClick={() => {
          if (window.confirm("Delete this contact? Their address is NOT removed from the do-not-email list.")) void call("DELETE");
        }}
      >
        Delete
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </span>
  );
}
