"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

const STATUSES = ["pending_review", "awaiting_content", "in_progress", "submitted_to_media", "published", "cancelled"];
export function AdminOrderStatus({ orderId, currentStatus, currentAdminNote }: { orderId: string; currentStatus: string; currentAdminNote: string | null }) {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState(currentAdminNote ?? "");
  const [message, setMessage] = useState("");
  async function save() {
    setMessage("");
    const response = await fetch(`/api/admin/press-releases/${orderId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, admin_note: note }) });
    setMessage(response.ok ? "Saved." : "Could not update this order.");
  }
  return <div className="space-y-3 rounded-chip border border-line bg-white p-5"><h2 className="font-medium">Admin controls</h2><label className="block text-sm text-muted">Status<select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-ink">{STATUSES.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm text-muted">Client update<textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 min-h-28 w-full rounded-chip border border-line px-3 py-2 text-ink" placeholder="Visible to the client in their order panel" /></label><Button onClick={save}>Save update</Button>{message && <p className="text-sm text-muted">{message}</p>}</div>;
}
