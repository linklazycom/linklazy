import { createServiceClient } from "@/lib/supabase/service";
import { canMoveSendStatus, eventEffect, type ParsedWebhook } from "@/lib/outreach/webhook";

/**
 * Applies one Saleshandy webhook event (Batch 16B-2): records it once (a repeat delivery is ignored), moves the send forward,
 * and puts bounces and unsubscribes on the do-not-email list (the database then stops the contact being mailed again).
 * Replies are stored with their text; turning them into tickets comes in 16B-3.
 */
export type EventOutcome = "recorded" | "duplicate" | "unknown_contact";

export async function applySaleshandyEvent(p: ParsedWebhook): Promise<EventOutcome> {
  const service = createServiceClient();

  const { data: contact } = await service.from("outreach_contacts").select("id").eq("email", p.email).maybeSingle();
  if (!contact) return "unknown_contact";

  // Pick the send this event belongs to: the one in the same Saleshandy sequence if we can tell, else the latest.
  const { data: sends } = await service.from("outreach_sends").select("id, status, campaign_id").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(10);
  let send = sends?.[0] ?? null;
  if (p.sequenceId && sends && sends.length > 1) {
    const { data: camps } = await service.from("outreach_campaigns").select("id").in("id", sends.map((s) => s.campaign_id)).eq("sequence_id", p.sequenceId);
    const match = new Set((camps ?? []).map((c) => c.id as string));
    send = sends.find((s) => match.has(s.campaign_id as string)) ?? send;
  }

  const { data: inserted, error } = await service
    .from("outreach_events")
    .upsert(
      { dedupe_key: p.dedupeKey, event: p.event, email: p.email, contact_id: contact.id, send_id: send?.id ?? null, sequence_id: p.sequenceId, occurred_at: p.occurredAt, detail: p.detail },
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    )
    .select("id");
  if (error) throw new Error("Could not record the event");
  if (!inserted || inserted.length === 0) return "duplicate";

  const effect = eventEffect(p.event);
  if (send) {
    const update: Record<string, unknown> = { last_event: p.event, last_event_at: p.occurredAt ?? new Date().toISOString() };
    if (effect.sendStatus && canMoveSendStatus(send.status as string, effect.sendStatus)) update.status = effect.sendStatus;
    await service.from("outreach_sends").update(update).eq("id", send.id);
  }
  if (effect.suppression) {
    await service
      .from("outreach_suppressions")
      .upsert({ email: p.email, reason: effect.suppression, note: "from Saleshandy" }, { onConflict: "email", ignoreDuplicates: true });
  }
  return "recorded";
}
