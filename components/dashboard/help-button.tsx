"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { pickUserHelpKey, type UserHelpEntry } from "@/lib/help/user-help";

/**
 * The round "?" at the top of every dashboard page. Opens a small window that explains the page: what it is, why you would use it,
 * how to use it. The texts live in lib/help/user-help.ts (longest matching path wins); a page without text says so politely.
 */
export function UserHelpButton({ entries }: { entries: Record<string, UserHelpEntry> }) {
  const path = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const key = pickUserHelpKey(path, Object.keys(entries));
  const entry = key ? entries[key] : null;

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
        title="What is this page? (Help)"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-white text-base font-medium shadow-sm hover:bg-paper"
      >
        ?
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-labelledby="user-help-title" className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-chip bg-white p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h2 id="user-help-title" className="font-display text-lg font-medium">{entry?.title ?? "Help for this page"}</h2>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="rounded-chip border border-line px-2 py-1">Close</button>
            </div>
            {entry ? (
              <div className="mt-3 space-y-3">
                <section>
                  <h3 className="font-medium">What is this?</h3>
                  <p className="text-muted">{entry.what}</p>
                </section>
                <section>
                  <h3 className="font-medium">Why use it?</h3>
                  <p className="text-muted">{entry.why}</p>
                </section>
                <section>
                  <h3 className="font-medium">How to use it</h3>
                  <ol className="list-decimal space-y-1 pl-5 text-muted">{entry.how.map((s, i) => <li key={i}>{s}</li>)}</ol>
                </section>
                {entry.watch && entry.watch.length > 0 && (
                  <section>
                    <h3 className="font-medium">Good to know</h3>
                    <ul className="list-disc space-y-1 pl-5 text-muted">{entry.watch.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  </section>
                )}
              </div>
            ) : (
              <p className="mt-3 text-muted">There is no help text for this page yet.</p>
            )}
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              More answers in the <Link href="/help" className="underline">Help center</Link> or by <Link href="/dashboard/support" className="underline">opening a ticket</Link>.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
