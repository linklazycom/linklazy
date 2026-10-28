/** Pure rules for press-release orders (no database access, easy to test). */
export type PressStatus =
  | "pending_review"
  | "awaiting_content"
  | "in_progress"
  | "submitted_to_media"
  | "published"
  | "cancelled";

export const PRESS_STATUSES: PressStatus[] = [
  "pending_review",
  "awaiting_content",
  "in_progress",
  "submitted_to_media",
  "published",
  "cancelled",
];

/** Allowed admin moves. "published" and "cancelled" are final. */
export const PRESS_TRANSITIONS: Record<PressStatus, PressStatus[]> = {
  pending_review: ["awaiting_content", "in_progress", "cancelled"],
  awaiting_content: ["in_progress", "cancelled"],
  in_progress: ["awaiting_content", "submitted_to_media", "cancelled"],
  submitted_to_media: ["in_progress", "published", "cancelled"],
  published: [],
  cancelled: [],
};

export function canMovePress(from: string, to: string): boolean {
  if (from === to) return true; // saving notes/fields without a status change
  const allowed = PRESS_TRANSITIONS[from as PressStatus];
  return !!allowed && allowed.includes(to as PressStatus);
}

export const PRESS_STATUS_LABEL: Record<PressStatus, string> = {
  pending_review: "Pending review",
  awaiting_content: "Waiting for your content",
  in_progress: "In progress",
  submitted_to_media: "Submitted to media",
  published: "Published",
  cancelled: "Cancelled",
};

/** Orders that still need work (shown in the admin "open" queue). */
export function isOpenPress(status: string): boolean {
  return status !== "published" && status !== "cancelled";
}

/** Expected delivery = the slowest selected package (in days) counted from `from`. Null when no package has a time. */
export function expectedDeliveryAt(from: Date, deliveryDays: (number | null | undefined)[]): Date | null {
  const days = deliveryDays.filter((d): d is number => typeof d === "number" && d > 0);
  if (days.length === 0) return null;
  return new Date(from.getTime() + Math.max(...days) * 86_400_000);
}

export function isOverdue(order: { status: string; expected_delivery_at?: string | null }, now: Date): boolean {
  if (!isOpenPress(order.status) || !order.expected_delivery_at) return false;
  const due = new Date(order.expected_delivery_at).getTime();
  return Number.isFinite(due) && due < now.getTime();
}

/** Admin-only money view: what the client paid vs what the supplier charged. */
export function marginOf(total: number, supplierCost: number | null | undefined) {
  if (supplierCost === null || supplierCost === undefined || !Number.isFinite(Number(supplierCost))) return null;
  const margin = Number(total) - Number(supplierCost);
  const percent = Number(total) > 0 ? Math.round((margin / Number(total)) * 1000) / 10 : 0;
  return { margin, percent };
}

export function validateSupplierCost(raw: unknown): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return { ok: false, error: "Supplier cost must be a number from 0 to 10,000,000." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}

/** Delivery link: required to mark published; must be a plain https address. */
export function validateDeliveryUrl(raw: string | null | undefined): { ok: true; value: string } | { ok: false; error: string } {
  const text = (raw ?? "").trim();
  if (!text) return { ok: false, error: "Add the link to the published article before marking this as published." };
  if (text.length > 600) return { ok: false, error: "The delivery link is too long." };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "The delivery link must be a full https:// address." };
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return { ok: false, error: "The delivery link must be a full https:// address." };
  }
  return { ok: true, value: url.toString() };
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pure: subject + HTML of the client email for a status change. */
export function buildPressEmail(input: {
  status: PressStatus;
  headline: string;
  note?: string | null;
  deliveryUrl?: string | null;
  expectedAt?: string | null;
  siteUrl: string;
}): { subject: string; html: string } {
  const headline = escapeHtml(input.headline);
  const note = input.note ? `<p><strong>Note from our team:</strong> ${escapeHtml(input.note)}</p>` : "";
  const panel = `${input.siteUrl}/dashboard/press-releases`;
  const view = `<p><a href="${panel}">View your press release request</a></p>`;
  const lines: Record<PressStatus, string> = {
    pending_review: "We received your request and will review it shortly.",
    awaiting_content: "We need something from you to continue. Please read the note below and reply.",
    in_progress: "Your press release is now being prepared.",
    submitted_to_media: "Your press release was submitted to the media outlets. Publication usually follows soon.",
    published: "Your press release is live.",
    cancelled: "This request was cancelled.",
  };
  let extra = "";
  if (input.status === "published" && input.deliveryUrl) {
    extra = `<p><a href="${escapeHtml(input.deliveryUrl)}">View the published article</a></p>`;
  }
  if (input.status === "in_progress" && input.expectedAt) {
    const d = new Date(input.expectedAt);
    if (Number.isFinite(d.getTime())) extra = `<p>Expected delivery: <strong>${d.toISOString().slice(0, 10)}</strong></p>`;
  }
  return {
    subject: `Press release update: ${PRESS_STATUS_LABEL[input.status]}`,
    html: `<p><strong>${headline}</strong></p><p>${lines[input.status]}</p>${extra}${note}${view}`,
  };
}
