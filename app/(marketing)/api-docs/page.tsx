import type { Metadata } from "next";
import { Code2 } from "lucide-react";
import { siteUrl } from "@/lib/links/server";
import { PageHero } from "@/components/marketing/page-hero";

export const metadata: Metadata = {
  alternates: { canonical: "/api-docs" },
  title: "API documentation",
  description: "Create and manage LinkLazy short links and read click statistics from your own tools.",
};

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-chip bg-ink p-4 text-xs leading-relaxed text-white">{children}</pre>;
}

export default function ApiDocsPage() {
  const base = `${siteUrl()}/api/v1`;
  return (
    <>
      <PageHero eyebrow="For developers" eyebrowIcon={Code2} title="LinkLazy API" description="Create short links and read click statistics from your own tools." />
      <div className="mx-auto max-w-3xl space-y-10 px-4 pb-20 text-sm leading-relaxed">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Authentication</h2>
          <p>
            Create a key under Dashboard → API keys, then send it as a bearer token. Keys are shown once, can be limited to read-only, and can be revoked at any time.
          </p>
          <Code>{`curl ${base}/links \\\n  -H "Authorization: Bearer ll_live_xxxxxxxxxxxx"`}</Code>
          <p>
            Every response is JSON. Errors look like <code>{`{ "error": { "code": "invalid_key", "message": "…" } }`}</code>.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Limits and errors</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Each key has a per-minute request limit (shown on the API keys page). Over the limit you get <code>429</code> with a <code>Retry-After</code> header.</li>
            <li>Creating links follows the same account limits as the dashboard (total links, links per hour).</li>
            <li><code>401</code> missing, invalid, expired or revoked key · <code>403</code> key lacks the needed scope, or the account is disabled · <code>404</code> not found (also for links that belong to someone else) · <code>400</code> invalid request · <code>409</code> slug already taken.</li>
            <li>Scopes: <code>links:read</code> (GET) and <code>links:write</code> (POST, PATCH, DELETE).</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">List links</h2>
          <p>
            <code>GET /links</code> — query: <code>page</code>, <code>per_page</code> (max 100), <code>q</code>, <code>folder</code>, <code>tag</code>.
          </p>
          <Code>{`{ "data": [ { "id": "…", "slug": "sale", "short_url": "${siteUrl()}/l/sale",\n    "destination_url": "https://example.com/sale", "click_count": 12, … } ],\n  "page": 1, "per_page": 25, "total": 1 }`}</Code>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Create a link</h2>
          <p>
            <code>POST /links</code> — only <code>destination_url</code> is required. Optional: <code>slug</code>, <code>title</code>, <code>folder</code>, <code>tags</code>, <code>expires_at</code> (ISO date), <code>max_clicks</code>, <code>password</code>, <code>is_active</code>. Unknown fields are rejected.
          </p>
          <Code>{`curl -X POST ${base}/links \\\n  -H "Authorization: Bearer ll_live_xxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"destination_url":"https://example.com/sale","slug":"sale","tags":["promo"]}'`}</Code>
          <p>Returns <code>201</code> with the new link. Destinations must be public http(s) URLs; other URL shorteners and blocked domains are refused.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Get, update, delete</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><code>GET /links/{"{id}"}</code></li>
            <li><code>PATCH /links/{"{id}"}</code> — any creation field except <code>slug</code> (slugs never change); <code>clear_password: true</code> removes the password.</li>
            <li><code>DELETE /links/{"{id}"}</code> — also deletes its click history.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-medium">Click statistics</h2>
          <p>
            <code>GET /links/{"{id}"}/stats?days=30</code> (1–365). Counts exclude bots and link-preview fetchers. Days are UTC. &quot;Uniques&quot; are summed per day (one person on two days counts twice).
          </p>
          <Code>{`{ "data": { "days": 30, "from": "2026-09-17",\n    "totals": { "clicks": 120, "uniques": 87, "qr": 14 },\n    "daily": [ { "day": "2026-10-15", "clicks": 9, "uniques": 7 } ],\n    "countries": [ { "key": "BD", "clicks": 60 } ],\n    "devices": [], "browsers": [], "referrers": [], "sources": [] } }`}</Code>
        </section>
      </div>
    </>
  );
}
