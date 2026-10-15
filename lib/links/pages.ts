/**
 * Tiny server-rendered HTML pages for the /l/<slug> route (Batch 9).
 * They are plain strings (no React render) so redirects stay fast, and every
 * dynamic value is escaped. Pure; tested in tests/link-pages.test.ts.
 */
export function escapeHtml(v: string): string {
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${escapeHtml(title)} · LinkLazy</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAFAFC;color:#0A0E27;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
main{max-width:420px;padding:32px 24px;text-align:center}
h1{font-size:22px;margin:0 0 10px}p{color:#6B7280;font-size:14px;line-height:1.5;margin:0 0 16px}
a{color:#6D35F9}input{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #E4E1F0;border-radius:6px;font-size:14px;margin-bottom:12px}
button{padding:10px 18px;border:0;border-radius:6px;background:#6D35F9;color:#fff;font-size:14px;font-weight:600;cursor:pointer}
.err{color:#B42318}.small{font-size:12px;margin-top:24px}
</style></head><body><main>${body}</main></body></html>`;
}

export type StatePage = "not_found" | "taken_down" | "inactive" | "expired" | "limit_reached" | "unavailable";

const STATE_COPY: Record<StatePage, { title: string; message: string }> = {
  not_found: { title: "Link not found", message: "This short link doesn't exist. Check the address and try again." },
  taken_down: { title: "Link removed", message: "This link was removed because it may violate our acceptable-use policy." },
  inactive: { title: "Link turned off", message: "The owner has turned this link off." },
  expired: { title: "Link expired", message: "This link has expired and no longer redirects." },
  limit_reached: { title: "Link limit reached", message: "This link has reached its maximum number of visits." },
  unavailable: { title: "Temporarily unavailable", message: "Short links are paused right now. Please try again later." },
};

export function renderStatePage(state: StatePage, slug?: string): string {
  const c = STATE_COPY[state];
  const report =
    slug && state !== "not_found" && state !== "unavailable"
      ? `<p class="small"><a href="/report-link?slug=${encodeURIComponent(slug)}">Report this link</a></p>`
      : "";
  return shell(c.title, `<h1>${escapeHtml(c.title)}</h1><p>${escapeHtml(c.message)}</p><p><a href="/">Go to LinkLazy</a></p>${report}`);
}

export function stateHttpStatus(state: StatePage): number {
  if (state === "not_found") return 404;
  if (state === "unavailable") return 503;
  return 410;
}

export function renderPasswordPage(slug: string, error?: string): string {
  return shell(
    "Password required",
    `<h1>This link is password-protected</h1><p>Enter the password to continue.</p>` +
      (error ? `<p class="err">${escapeHtml(error)}</p>` : "") +
      `<form method="post" action="/l/${encodeURIComponent(slug)}"><input type="password" name="password" autocomplete="off" autofocus required maxlength="100" placeholder="Password"><button type="submit">Continue</button></form>` +
      `<p class="small"><a href="/report-link?slug=${encodeURIComponent(slug)}">Report this link</a></p>`
  );
}
