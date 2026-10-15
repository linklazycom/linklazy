"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {
      window.prompt("Copy this link:", text);
    }
  }
  return (
    <Button type="button" size="sm" variant="secondary" onClick={copy}>
      {done ? "Copied ✓" : label}
    </Button>
  );
}
