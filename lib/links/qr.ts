/**
 * Dependency-free QR Code encoder (byte mode, versions 1–40, ECC L/M/Q/H).
 * Written for LinkLazy so Batch 9 needs no new npm package (package-lock.json
 * stays untouched — see the GitHub drag-and-drop note in the plan).
 *
 * Pure: no imports, no I/O. Verified by tests/link-qr.test.ts and by decoding
 * generated codes with an independent QR reader during development.
 */
export type QrEcc = "L" | "M" | "Q" | "H";
export type QrMatrix = boolean[][];

const ECC_INDEX: Record<QrEcc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<QrEcc, number> = { L: 1, M: 0, Q: 3, H: 2 };

// Index = version (0 unused).
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver: number, ecc: QrEcc): number {
  const e = ECC_INDEX[ecc];
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver]
  );
}

function utf8Bytes(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const size = ver * 4 + 17;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

// ---- Reed–Solomon over GF(2^8), polynomial 0x11D ----
function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result: number[] = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= rsMultiply(coef, factor);
    });
  }
  return result;
}

function appendBits(bits: number[], value: number, len: number) {
  for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
}

function buildCodewords(bytes: number[], ver: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  appendBits(bits, 0x4, 4); // byte mode
  appendBits(bits, bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) appendBits(bits, b, 8);

  const capacityBits = numDataCodewords(ver, ecc) * 8;
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);

  const data: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((b, i) => {
    data[i >>> 3] |= b << (7 - (i & 7));
  });

  // Split into blocks, add ECC, interleave.
  const e = ECC_INDEX[ecc];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const divisor = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1);
    const dat = data.slice(k, k + datLen);
    k += datLen;
    const eccBytes = rsRemainder(dat, divisor);
    if (i < numShortBlocks) dat.push(0); // placeholder so all blocks align when interleaving
    blocks.push(dat.concat(eccBytes));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      // Skip the placeholder byte of short blocks.
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ---- Matrix construction ----
class Grid {
  ver: number;
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];
  constructor(ver: number) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }
  setFn(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }
  drawFunctionPatterns(ecc: QrEcc) {
    const { size, ver } = this;
    for (let i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const x = cx + dx;
          const y = cy + dy;
          if (x < 0 || y < 0 || x >= size || y >= size) continue;
          const dist = Math.max(Math.abs(dx), Math.abs(dy));
          this.setFn(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
    const pos = alignmentPositions(ver);
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            this.setFn(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
          }
        }
      }
    }
    this.drawFormat(ecc, 0); // reserve; redrawn with the real mask later
    this.drawVersion();
  }
  drawFormat(ecc: QrEcc, mask: number) {
    const { size } = this;
    const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) this.setFn(8, i, bit(i));
    this.setFn(8, 7, bit(6));
    this.setFn(8, 8, bit(7));
    this.setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(i));
    this.setFn(8, size - 8, true);
  }
  drawVersion() {
    const { ver, size } = this;
    if (ver < 7) return;
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) !== 0;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFn(a, b, dark);
      this.setFn(b, a, dark);
    }
  }
  drawCodewords(data: number[]) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
        }
        if (!this.isFunction[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }
  penalty(): number {
    const { size, modules: m } = this;
    let result = 0;
    const lines: boolean[][] = [];
    for (let y = 0; y < size; y++) lines.push(m[y]);
    for (let x = 0; x < size; x++) lines.push(m.map((row) => row[x]));
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else {
          if (run >= 5) result += 3 + (run - 5);
          run = 1;
        }
      }
      const s = line.map((d) => (d ? "1" : "0")).join("");
      for (const pat of ["10111010000", "00001011101"]) {
        let at = s.indexOf(pat);
        while (at !== -1) {
          result += 40;
          at = s.indexOf(pat, at + 1);
        }
      }
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) result += 3;
      }
    }
    let dark = 0;
    for (const row of m) for (const c of row) if (c) dark++;
    const total = size * size;
    result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return result;
  }
}

export class QrTooLongError extends Error {
  constructor() {
    super("Text is too long to fit in a QR code.");
    this.name = "QrTooLongError";
  }
}

/** Encodes `text` (UTF-8) and returns the module matrix (true = dark), without quiet zone. */
export function encodeQr(text: string, ecc: QrEcc = "M"): QrMatrix {
  const bytes = utf8Bytes(text);
  let ver = 1;
  for (; ; ver++) {
    if (ver > 40) throw new QrTooLongError();
    const countBits = ver < 10 ? 8 : 16;
    if (bytes.length >= 1 << countBits) continue;
    if (4 + countBits + bytes.length * 8 <= numDataCodewords(ver, ecc) * 8) break;
  }

  const codewords = buildCodewords(bytes, ver, ecc);
  const grid = new Grid(ver);
  grid.drawFunctionPatterns(ecc);
  grid.drawCodewords(codewords);

  let bestMask = 0;
  let bestPenalty = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    grid.applyMask(mask);
    grid.drawFormat(ecc, mask);
    const p = grid.penalty();
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = mask;
    }
    grid.applyMask(mask); // XOR again = undo
  }
  grid.applyMask(bestMask);
  grid.drawFormat(ecc, bestMask);
  return grid.modules;
}

// ---- Rendering ----
export interface QrStyle {
  fg?: string; // "#rrggbb"
  bg?: string;
  border?: number; // quiet zone in modules (spec says 4)
}

export function isHexColor(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** Scanners need dark-on-light with strong contrast; inverted/low-contrast codes often fail. */
export function qrColorsOk(fg: string, bg: string): boolean {
  if (!isHexColor(fg) || !isHexColor(bg)) return false;
  const lf = luminance(fg);
  const lb = luminance(bg);
  if (lf >= lb) return false;
  return (lb + 0.05) / (lf + 0.05) >= 4;
}

export function qrToSvg(matrix: QrMatrix, style: QrStyle = {}): string {
  const fg = style.fg ?? "#000000";
  const bg = style.bg ?? "#ffffff";
  const border = style.border ?? 4;
  const n = matrix.length;
  const dim = n + border * 2;
  let d = "";
  for (let y = 0; y < n; y++) {
    let x = 0;
    while (x < n) {
      if (!matrix[y][x]) { x++; continue; }
      let len = 0;
      while (x + len < n && matrix[y][x + len]) len++;
      d += `M${x + border},${y + border}h${len}v1h-${len}z`;
      x += len;
    }
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `<rect width="${dim}" height="${dim}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`
  );
}
