"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/components/links/api";

/** Reply-alert switch and the "Open in Saleshandy" link template (Admin > Outreach > Replies). */
export function ReplySettingsForm({ notify: initialNotify, template: initialTemplate }: { notify: boolean; template: string }) {
  const router = useRouter();
  const [notify, setNotify] = useState(initialNotify);
  const [template, setTemplate] = useState(initialTemplate);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await apiRequest("/api/admin/outreach/reply-settings", "POST", { notify, inbox_link_template: template });
    setBusy(false);
    if (!res.ok) return setMessage({ ok: false, text: res.error ?? "Could not save." });
    setMessage({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-3 rounded-chip border border-line bg-white p-4 text-sm">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-1" />
        <span>
          <strong>Email me when someone replies.</strong> <span className="text-muted">Goes to the site&apos;s contact email. Automatic answers (out of office) are not announced.</span>
        </span>
      </label>
      <div>
        <label htmlFor="inbox-template" className="mb-1 block font-medium">Saleshandy conversation link (optional)</label>
        <input id="inbox-template" value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="https://…/{conversation_id}" className="w-full rounded-chip border border-line px-3 py-2 font-mono text-xs" />
        <p className="mt-1 text-xs text-muted">
          How to set it: open any conversation in your Saleshandy Unified Inbox and copy its address from the browser. Replace the part that identifies the conversation with <code>{"{conversation_id}"}</code> (or the person&apos;s address with <code>{"{email}"}</code>) and paste it here. Then open one ticket and check the button opens the right conversation. Leave empty for no button.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        {message && <span role="status" className={`text-xs ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
    </form>
  );
}
