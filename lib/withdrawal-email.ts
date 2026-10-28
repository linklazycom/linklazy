import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { maskAccount, payoutLabel, payoutAccount, isPayoutMethod, type PayoutRow } from "@/lib/payout-methods";

export type WithdrawalMailStatus = "approved" | "paid" | "rejected";

export interface WithdrawalMailInput extends PayoutRow {
  status: WithdrawalMailStatus;
  amount: number;
  transaction_id?: string | null;
  proof_url?: string | null;
  admin_note?: string | null;
  siteUrl: string;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function destination(row: PayoutRow): string {
  const method = isPayoutMethod(row.method) ? row.method : "bkash";
  const account = payoutAccount(row);
  return `${payoutLabel(method)} ${maskAccount(account)}`.trim();
}

/** Pure: builds the subject and HTML of the status email (no sending). */
export function buildWithdrawalEmail(input: WithdrawalMailInput): { subject: string; html: string } {
  const amount = `\u09f3${Number(input.amount).toLocaleString("en-US")}`;
  const where = escapeHtml(destination(input));
  const wallet = `${input.siteUrl}/dashboard/wallet`;
  const note = input.admin_note ? `<p><strong>Note from our team:</strong> ${escapeHtml(input.admin_note)}</p>` : "";

  if (input.status === "approved") {
    return {
      subject: `Your withdrawal of ${amount} was approved`,
      html: `<p>Your withdrawal request of <strong>${amount}</strong> was approved. We will send it to <strong>${where}</strong> and email you again with the transaction ID once it is sent.</p>${note}<p><a href="${wallet}">View your wallet</a></p>`,
    };
  }
  if (input.status === "paid") {
    const txn = input.transaction_id ? `<p>Transaction ID: <strong>${escapeHtml(input.transaction_id)}</strong></p>` : "";
    const proof = input.proof_url ? `<p><a href="${escapeHtml(input.proof_url)}">View payment proof</a></p>` : "";
    return {
      subject: `Your withdrawal of ${amount} was sent`,
      html: `<p>We sent <strong>${amount}</strong> to <strong>${where}</strong>.</p>${txn}${proof}${note}<p><a href="${wallet}">View your wallet</a></p>`,
    };
  }
  return {
    subject: `Your withdrawal request of ${amount} was not approved`,
    html: `<p>Your withdrawal request of <strong>${amount}</strong> was not approved. The amount is available again in your wallet.</p>${note}<p><a href="${wallet}">View your wallet</a></p>`,
  };
}

/** Best-effort: looks up the user's email and sends the status mail. Never throws. */
export async function notifyWithdrawalStatus(
  service: SupabaseClient,
  userId: string,
  input: WithdrawalMailInput
): Promise<boolean> {
  try {
    const { data } = await service.auth.admin.getUserById(userId);
    const email = data?.user?.email;
    if (!email) return false;
    const mail = buildWithdrawalEmail(input);
    const result = await sendEmail({ to: email, subject: mail.subject, html: mail.html });
    return result.ok;
  } catch {
    return false;
  }
}
