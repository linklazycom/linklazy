import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeQr, qrToSvg, qrColorsOk, QrTooLongError } from "@/lib/links/qr";
import { qrToPng } from "@/lib/links/qr-png";

test("QR size follows the version formula and finder patterns are present", () => {
  const m = encodeQr("https://linklazy.com/l/abc", "M");
  assert.equal((m.length - 17) % 4, 0);
  // top-left finder: 7x7 dark ring
  for (let i = 0; i < 7; i++) {
    assert.equal(m[0][i], true);
    assert.equal(m[6][i], true);
    assert.equal(m[i][0], true);
    assert.equal(m[i][6], true);
  }
  assert.equal(m[3][3], true); // finder centre
  assert.equal(m[1][1], false);
});

test("encoding is deterministic and grows with input", () => {
  const a = encodeQr("hello", "L");
  assert.deepEqual(a, encodeQr("hello", "L"));
  assert.equal(a.length, 21); // version 1
  assert.ok(encodeQr("x".repeat(300), "M").length > 21);
});

test("too-long input throws QrTooLongError", () => {
  assert.throws(() => encodeQr("x".repeat(3000), "L"), QrTooLongError);
});

test("SVG output is well-formed and honours colours", () => {
  const svg = qrToSvg(encodeQr("a", "M"), { fg: "#112233", bg: "#ffeedd" });
  assert.ok(svg.startsWith("<svg"));
  assert.ok(svg.includes('fill="#112233"') && svg.includes('fill="#ffeedd"'));
  assert.ok(svg.endsWith("</svg>"));
});

test("PNG has a valid signature, IHDR and IEND", () => {
  const png = qrToPng(encodeQr("hello", "M"), { targetPx: 300 });
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.equal(png.subarray(png.length - 8, png.length - 4).toString("ascii"), "IEND");
});

test("qrColorsOk demands dark-on-light with strong contrast", () => {
  assert.equal(qrColorsOk("#000000", "#ffffff"), true);
  assert.equal(qrColorsOk("#1a1a6e", "#f5f5f5"), true);
  assert.equal(qrColorsOk("#ffffff", "#000000"), false); // inverted
  assert.equal(qrColorsOk("#777777", "#888888"), false); // low contrast
  assert.equal(qrColorsOk("red", "#ffffff"), false);
});
