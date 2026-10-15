"use client";

import { useState } from "react";
import { qrColorsOk } from "@/lib/links/qr";

/** QR preview + PNG/SVG download. The image is rendered by /api/links/[id]/qr (owner-only). */
export function QrPanel({ id, slug }: { id: string; slug: string }) {
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");
  const [size, setSize] = useState("512");

  const ok = qrColorsOk(fg, bg);
  const qs = (format: "png" | "svg", download: boolean) =>
    `/api/links/${id}/qr?format=${format}&size=${size}&fg=${fg.slice(1)}&bg=${bg.slice(1)}${download ? "&download=1" : ""}`;

  return (
    <div className="rounded-chip border border-line bg-white p-5">
      <h2 className="mb-1 font-display text-lg font-medium">QR code</h2>
      <p className="mb-4 text-xs text-muted">
        The code points to your short link, so you can change the destination later without reprinting it. Always test-scan before printing.
      </p>
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-chip border border-line bg-paper p-2">
          {ok ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`${fg}${bg}`} src={qs("svg", false)} alt={`QR code for ${slug}`} className="h-full w-full" />
          ) : (
            <p className="text-center text-xs text-red-600">Choose a dark code colour on a light background.</p>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              Code colour
              <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} />
            </label>
            <label className="flex items-center gap-2">
              Background
              <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2">
            PNG size
            <select value={size} onChange={(e) => setSize(e.target.value)} className="rounded-chip border border-line bg-white px-2 py-1">
              <option value="256">256 px</option>
              <option value="512">512 px</option>
              <option value="1024">1024 px</option>
              <option value="2048">2048 px (print)</option>
            </select>
          </label>
          <div className="flex gap-3">
            <a
              href={ok ? qs("png", true) : undefined}
              aria-disabled={!ok}
              className={`rounded-chip border border-line px-3 py-1.5 text-sm ${ok ? "bg-white hover:bg-paper" : "pointer-events-none opacity-50"}`}
            >
              Download PNG
            </a>
            <a
              href={ok ? qs("svg", true) : undefined}
              aria-disabled={!ok}
              className={`rounded-chip border border-line px-3 py-1.5 text-sm ${ok ? "bg-white hover:bg-paper" : "pointer-events-none opacity-50"}`}
            >
              Download SVG
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
