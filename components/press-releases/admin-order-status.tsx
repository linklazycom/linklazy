"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PRESS_STATUSES, PRESS_TRANSITIONS, marginOf, type PressStatus } from "@/lib/press-release-flow";

interface Props {
  orderId: string;
  currentStatus: string;
  currentAdminNote: string | null;
  totalAmount: number;
  deliveryUrl: string | null;
  expectedDate: string; // YYYY-MM-DD or ""
  supplierName: string | null;
  supplierCost: number | null;
  internalNote: string | null;
}

const field = "mt-1 w-full rounded-chip border border-line bg-white px-3 py-2 text-sm text-ink";

export function AdminOrderStatus(p: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(p.currentStatus);
  const [note, setNote] = useState(p.currentAdminNote ?? "");
  const [deliveryUrl, setDeliveryUrl] = useState(p.deliveryUrl ?? "");
  const [expectedDate, setExpectedDate] = useState(p.expectedDate);
  const [supplierName, setSupplierName] = useState(p.supplierName ?? "");
  const [supplierCost, setSupplierCost] = useState(p.supplierCost === null ? "" : String(p.supplierCost));
  const [internalNote, setInternalNote] = useState(p.internalNote ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // Only the current status and the allowed next steps are offered.
  const options = PRESS_STATUSES.filter((s) => s === p.currentStatus || PRESS_TRANSITIONS[p.currentStatus as PressStatus]?.includes(s));
  const margin = marginOf(p.totalAmount, supplierCost === "" ? null : Number(supplierCost));
  const final = p.currentStatus === "published" || p.currentStatus === "cancelled";

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/press-releases/${p.orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status,
        admin_note: note,
        delivery_url: deliveryUrl,
        expected_delivery_date: expectedDate,
        supplier_name: supplierName,
        supplier_cost: supplierCost === "" ? null : Number(supplierCost),
        internal_note: internalNote,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(typeof body.error === "string" ? body.error : "Could not update this order.");
      return;
    }
    if (typeof body.warning === "string") setMessage(body.warning);
    else if (body.emailSent === false) setMessage("Saved. The email to the client could not be sent (check Resend), so tell them yourself.");
    else if (body.emailSent === true) setMessage("Saved. The client was emailed.");
    else setMessage("Saved.");
    router.refresh();
  }

  return (
    <div className="space-y-3 rounded-chip border border-line bg-white p-5">
      <h2 className="font-medium">Admin controls</h2>
      <label className="block text-sm text-muted">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={field} disabled={final}>
          {options.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-muted">
        Client update (emailed when the status changes)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={`${field} min-h-24`} placeholder="Visible to the client" />
      </label>
      <label className="block text-sm text-muted">
        Delivery link (https, required for Published)
        <input value={deliveryUrl} onChange={(e) => setDeliveryUrl(e.target.value)} className={field} placeholder="https://…" />
      </label>
      <label className="block text-sm text-muted">
        Expected delivery date
        <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className={field} />
      </label>

      <div className="rounded-chip border border-brand-violet/30 bg-brand-soft p-3">
        <p className="mb-2 text-xs font-medium">Admin only — the client never sees this</p>
        <label className="block text-sm text-muted">
          Supplier
          <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={field} />
        </label>
        <label className="mt-2 block text-sm text-muted">
          Supplier cost (৳)
          <input type="number" min="0" value={supplierCost} onChange={(e) => setSupplierCost(e.target.value)} className={field} />
        </label>
        {margin && (
          <p className="mt-2 text-sm">
            Margin: <strong>৳{margin.margin.toLocaleString()}</strong> ({margin.percent}%)
          </p>
        )}
        <label className="mt-2 block text-sm text-muted">
          Internal note
          <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)} className={`${field} min-h-16`} />
        </label>
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save update"}
      </Button>
      {message && <p className="text-sm text-muted">{message}</p>}
    </div>
  );
}
