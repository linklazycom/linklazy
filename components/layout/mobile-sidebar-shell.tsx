"use client";

import { useState } from "react";

export function MobileSidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar with hamburger — only visible below md */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-chip border border-line"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 1H18M0 7H18M0 13H18" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>

      {/* Desktop sidebar — always visible at md+ */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-white p-6 md:flex">
        {children}
      </aside>

      {/* Mobile off-canvas drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto bg-white p-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="mb-4 flex h-9 w-9 items-center justify-center self-end rounded-chip border border-line"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
            <div onClick={() => setOpen(false)}>{children}</div>
          </aside>
        </div>
      )}
    </>
  );
}
