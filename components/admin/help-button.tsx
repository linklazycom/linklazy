"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { HelpEntry } from "@/lib/help/admin-help";

/**
 * The round "?" at the top of every admin page. Opens a small window that explains the page: what it is, why it exists,
 * how to use it. The texts come from lib/help/admin-help.ts (matched by the longest path prefix); a page without text says so.
 */
export function AdminHelpButton({ entries }: { entries: Record<string, HelpEntry> }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  let entry: HelpEntry | null = null;
  let best = -1;
  for (const [key, value] of Object.entries(entries)) {
    if ((path === key || path.startsWith(`${key}/`)) && key.length > best) {
      entry = value;
      best = key.length;
    }
  }

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help about this page"
        title="এই পেজ কী কাজ করে? (Help)"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-white text-base font-medium shadow-sm hover:bg-paper"
      >
        ?
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="admin-help-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-chip bg-white p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="admin-help-title" className="font-display text-lg font-medium">{entry?.title ?? "এই পেজের সাহায্য"}</h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="rounded-chip border border-line px-2 py-1">Close</button>
            </div>
            {entry ? (
              <div className="mt-3 space-y-3">
                <section>
                  <h3 className="font-medium">এটি কী?</h3>
                  <p className="text-muted">{entry.what}</p>
                </section>
                <section>
                  <h3 className="font-medium">কেন দরকার?</h3>
                  <p className="text-muted">{entry.why}</p>
                </section>
                <section>
                  <h3 className="font-medium">কীভাবে ব্যবহার করবেন?</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-muted">{entry.how.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </section>
                {entry.watch && entry.watch.length > 0 && (
                  <section>
                    <h3 className="font-medium">খেয়াল রাখুন</h3>
                    <ul className="list-disc space-y-1 pl-5 text-muted">{entry.watch.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </section>
                )}
              </div>
            ) : (
              <p className="mt-3 text-muted">এই পেজের সাহায্য-লেখা এখনো যোগ করা হয়নি। প্রতিটি নতুন ব্যাচের সাথে ধীরে ধীরে সব পেজে যোগ হচ্ছে।</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
