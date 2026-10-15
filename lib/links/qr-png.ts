import { deflateSync } from "node:zlib";
import type { QrMatrix } from "@/lib/links/qr";

/** Minimal PNG writer (indexed colour, 2-entry palette) — no image library needed. */
let CRC_TABLE: Uint32Array | null = null;
function crc32(buf: Uint8Array): number {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function rgb(hex: string): number[] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

/** Largest integer scale so the image is at most `targetPx` wide (min 1 px per module). */
export function qrToPng(
  matrix: QrMatrix,
  opts: { targetPx?: number; fg?: string; bg?: string; border?: number } = {}
): Buffer {
  const border = opts.border ?? 4;
  const n = matrix.length;
  const modules = n + border * 2;
  const scale = Math.max(1, Math.floor((opts.targetPx ?? 512) / modules));
  const px = modules * scale;

  const raw = Buffer.alloc((px + 1) * px); // filter byte + 1 byte/pixel
  for (let y = 0; y < px; y++) {
    const my = Math.floor(y / scale) - border;
    const rowStart = y * (px + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - border;
      const dark = my >= 0 && my < n && mx >= 0 && mx < n && matrix[my][mx];
      raw[rowStart + 1 + x] = dark ? 1 : 0;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // indexed colour
  const plte = Buffer.from([...rgb(opts.bg ?? "#ffffff"), ...rgb(opts.fg ?? "#000000")]);

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("PLTE", plte),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
