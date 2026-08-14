"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { NavLink } from "@/lib/site-settings";

export function MobileNav({ navLinks }: { navLinks: NavLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
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

      {open &&
        // FIX: previously rendered inline here, nested inside <SiteHeader>
        // which has `backdrop-blur`. backdrop-filter/filter/transform on an
        // ancestor creates a new containing block for `position: fixed`
        // descendants — so this "fullscreen" overlay was actually being
        // sized/positioned relative to the ~64px header box, not the
        // viewport. createPortal renders it directly under <body>,
        // completely outside that containing block.
        createPortal(
          <div className="fixed inset-0 z-[100] bg-paper">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <span className="font-display text-lg font-semibold text-ink">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-chip border border-line"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 px-6 py-6">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-chip px-3 py-3 text-base text-ink hover:bg-white"
                >
                  {link.label}
                </Link>
              ))}
              {!navLinks.some((link) => link.href === "/press-releases") && (
                <Link href="/press-releases" onClick={() => setOpen(false)} className="rounded-chip px-3 py-3 text-base text-ink hover:bg-white">
                  Press releases
                </Link>
              )}
            </nav>
            <div className="flex flex-col gap-3 border-t border-line px-6 py-6">
              <Link href="/login" onClick={() => setOpen(false)}>
                <Button variant="secondary" className="w-full">
                  Log in
                </Button>
              </Link>
              <Link href="/register" onClick={() => setOpen(false)}>
                <Button className="w-full">Get started</Button>
              </Link>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
