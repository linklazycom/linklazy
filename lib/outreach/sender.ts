import { cleanLine, cleanMultiline } from "@/lib/projects/rules";

/**
 * Sender identity for outreach mail (Batch 16B-1 stores it; 16B-2 refuses to send until it is complete).
 * Marketing email law in most countries requires the sender's real name and a postal address in every message.
 */
export const OUTREACH_SENDER_NAME_KEY = "outreach_sender_name";
export const OUTREACH_SENDER_ADDRESS_KEY = "outreach_sender_address";

export interface SenderIdentity {
  name: string;
  address: string;
}

export function validateSenderIdentity(input: Record<string, unknown>): { ok: true; value: SenderIdentity } | { ok: false; message: string; field: string } {
  const name = cleanLine(input.name, 80);
  if (!name || name.length < 2) return { ok: false, message: "Enter the business or sender name.", field: "name" };
  const address = cleanMultiline(input.address, 300, 5);
  if (!address || address.length < 10) return { ok: false, message: "Enter a full postal address (street, city, country).", field: "address" };
  return { ok: true, value: { name, address } };
}

export const senderIsComplete = (v: { name?: string | null; address?: string | null }): boolean => !!v.name && v.name.length >= 2 && !!v.address && v.address.length >= 10;
