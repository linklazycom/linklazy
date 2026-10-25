"use client";

import { useMemo, useState } from "react";
import { encodeQr, qrColorsOk, qrToSvg, QrTooLongError } from "@/lib/links/qr";

export function QrGenerator() {
  const [text, setText] = useState("");
  const [fg, setFg] = useState("#000000");
  const [bg, setBg] = useState("#ffffff");

  const colorsOk = qrColorsOk(fg, bg);
  const { svg, error } = useMemo(() => {
    const value = text.trim();
    if (!value) return { svg: null as string | null, error: null as string | null };
    if (!qrColorsOk(fg, bg)) return { svg: null, error: "Choose a dark code colour on a light background so phones can scan it." };
    try {
      return { svg: qrToSvg(encodeQr(value, "M"), { fg, bg, border: 4 }), error: null };
    } catch (e) {
      return { svg: null, error: e instanceof QrTooLongError ? "That text is too long for a QR code." : "Could not make a QR code from that." };
    }
  }, [text, fg, bg]);

  function save(blob: Blob, name: string) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function downloadSvg() {
    if (svg) save(new Blob([svg], { type: "image/svg+xml" }), "qr-code.svg");
  }

  function downloadPng() {
    if (!svg) return;
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob((b) => b && save(b, "qr-code.png"), "image/png");
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-chip border border-line bg-white p-5">
        <label htmlFor="qr-text" className="block text-sm font-medium">Link or text</label>
        <textarea id="qr-text" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1000} placeholder="https://example.com" className="w-full rounded-chip border border-line px-3 py-2 text-sm outline-none focus:border-signal" />
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <label className="flex items-center gap-2">Code colour <input type="color" value={fg} onChange={(e) => setFg(e.target.value)} /></label>
          <label className="flex items-center gap-2">Background <input type="color" value={bg} onChange={(e) => setBg(e.target.value)} /></label>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {svg && colorsOk && (
        <div className="rounded-chip border border-line bg-paper p-5 text-center">
          <div className="mx-auto h-56 w-56" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-4 flex justify-center gap-3">
            <button type="button" onClick={downloadPng} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm hover:bg-paper">Download PNG</button>
            <button type="button" onClick={downloadSvg} className="rounded-chip border border-line bg-white px-3 py-1.5 text-sm hover:bg-paper">Download SVG</button>
          </div>
        </div>
      )}
      <p className="text-xs text-muted">The code is made in your browser; nothing you type is sent to us. This code points straight to what you typed, so it cannot be changed later. Always test-scan before printing. For a code you can re-point later, use a LinkLazy short link (free account).</p>
    </div>
  );
}
