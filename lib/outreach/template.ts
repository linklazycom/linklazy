import { FIELD_DEFS } from "@/lib/outreach/saleshandy";

/**
 * Ready-to-paste outreach email for a Saleshandy sequence step (Batch 16B-2), in the LinkLazy brand colours
 * (ink #0A0E27, blue→violet→magenta gradient, amber price badge, line #E4E1F0). Table layout and inline styles, as email clients need.
 * Merge tags use the names of the Saleshandy prospect fields in FIELD_DEFS, so the field names there must match.
 */
const C = { ink: "#0A0E27", inkSoft: "#1C2242", blue: "#2C75FC", violet: "#6D35F9", magenta: "#B23CFC", soft: "#F1EEFE", amber: "#E8A33D", amberSoft: "#FBEEDA", line: "#E4E1F0", muted: "#6B7280", paper: "#FAFAFC" };

const tag = (key: string) => `{{${FIELD_DEFS.find((f) => f.key === key)?.saleshandyName ?? key}}}`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface TemplateInput {
  senderName: string;
  senderAddress: string;
  siteUrl: string;
}

export const SUBJECT_OPTIONS = [
  `${tag("listing_name")}: a backlink opportunity`,
  `Quick question, ${tag("first_name")}`,
  `A site worth a look, ${tag("first_name")}`,
  `Guest post / link placement on ${tag("listing_name")}?`,
  `${tag("first_name")}, one placement worth a look`,
];

export function buildOutreachTemplate(input: TemplateInput): { subjects: string[]; html: string; text: string } {
  const name = esc(input.senderName);
  const address = esc(input.senderAddress).replace(/\n/g, "<br>");
  const site = input.siteUrl.replace(/\/+$/, "");
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LinkLazy</title></head>
<body style="margin:0;padding:0;background:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper};"><tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${C.line};border-radius:10px;overflow:hidden;font-family:${font};color:${C.ink};">
    <tr><td style="background:${C.violet};background-image:linear-gradient(135deg,${C.blue} 0%,${C.violet} 55%,${C.magenta} 100%);padding:18px 28px;">
      <span style="font-size:20px;font-weight:700;letter-spacing:-0.3px;color:#ffffff;">LinkLazy</span>
    </td></tr>
    <tr><td style="padding:28px 28px 8px 28px;font-size:16px;line-height:1.6;color:${C.ink};">
      <p style="margin:0 0 14px 0;">Hi ${tag("first_name")},</p>
      <p style="margin:0 0 14px 0;">I run LinkLazy, a marketplace where site owners sell guest posts and link placements and buyers pay through a protected checkout. Since you work with backlinks, I thought this one might be relevant:</p>
    </td></tr>
    <tr><td style="padding:0 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.soft};border:1px solid ${C.line};border-radius:8px;">
        <tr><td style="padding:18px 20px;">
          <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:${C.violet};font-weight:700;">Available now</div>
          <div style="font-size:18px;font-weight:700;color:${C.ink};margin:6px 0 4px 0;">${tag("listing_name")}</div>
          <div style="font-size:14px;color:${C.muted};margin:0 0 12px 0;">${tag("listing_metrics")}</div>
          <span style="display:inline-block;background:${C.amberSoft};color:#8A5A0B;border:1px solid ${C.amber};border-radius:999px;padding:4px 14px;font-size:15px;font-weight:700;">${tag("listing_price")}</span>
        </td></tr>
      </table>
    </td></tr>
    <tr><td align="left" style="padding:22px 28px 6px 28px;">
      <a href="${tag("listing_url")}" style="display:inline-block;background:${C.violet};background-image:linear-gradient(135deg,${C.blue},${C.violet});color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:6px;">See this and similar sites</a>
    </td></tr>
    <tr><td style="padding:14px 28px 8px 28px;font-size:15px;line-height:1.6;color:${C.inkSoft};">
      <p style="margin:0 0 12px 0;">Payment is held by LinkLazy until you accept the delivered link, so you only pay for what goes live. If this is not the right fit, tell me what you are looking for (niche, budget, metrics) and I will send better matches.</p>
      <p style="margin:0 0 4px 0;">Thanks,<br>${name}</p>
    </td></tr>
    <tr><td style="padding:18px 28px 24px 28px;border-top:1px solid ${C.line};font-size:12px;line-height:1.6;color:${C.muted};">
      Not interested? Just reply &ldquo;no thanks&rdquo; and we will not email you again, or use the unsubscribe link below.<br><br>
      ${name}<br>${address}
    </td></tr>
  </table>
  <p style="margin:12px 0 0 0;font-family:${font};font-size:11px;color:${C.muted};">${site.replace(/^https?:\/\//, "")}</p>
</td></tr></table>
</body></html>`;

  const text = `Hi ${tag("first_name")},

I run LinkLazy, a marketplace where site owners sell guest posts and link placements and buyers pay through a protected checkout. Since you work with backlinks, I thought this one might be relevant:

AVAILABLE NOW
${tag("listing_name")}
${tag("listing_metrics")}
Price: ${tag("listing_price")}

See this and similar sites: ${tag("listing_url")}

Payment is held by LinkLazy until you accept the delivered link, so you only pay for what goes live. If this is not the right fit, tell me what you are looking for (niche, budget, metrics) and I will send better matches.

Thanks,
${input.senderName}

Not interested? Just reply "no thanks" and we will not email you again, or use the unsubscribe link.
${input.senderName}
${input.senderAddress}`;

  return { subjects: SUBJECT_OPTIONS, html, text };
}
