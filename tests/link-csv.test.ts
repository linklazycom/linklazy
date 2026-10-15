import { test } from "node:test";
import assert from "node:assert/strict";
import { csvCell, toCsv, parseImportCsv } from "@/lib/links/csv";

test("csvCell escapes quotes/commas and neutralizes formulas", () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell("=HYPERLINK(1)"), "'=HYPERLINK(1)");
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell("@x"), "'@x");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(12), "12");
});

test("toCsv joins with CRLF", () => {
  assert.equal(toCsv(["a", "b"], [[1, "x,y"]]), 'a,b\r\n1,"x,y"\r\n');
});

test("parseImportCsv reads rows, tags, limits", () => {
  const r = parseImportCsv("destination_url,slug,tags,max_clicks\nhttps://a.com,promo,a|b,10\nhttps://b.com,,,\n", 100);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.rows.length, 2);
    assert.equal(r.rows[0].line, 2);
    assert.deepEqual(r.rows[0].tags, ["a", "b"]);
    assert.equal(r.rows[0].max_clicks, 10);
    assert.equal(r.rows[1].slug, null);
    assert.equal(r.rows[1].max_clicks, null);
  }
});

test("parseImportCsv marks bad max_clicks and accepts 'url' header", () => {
  const r = parseImportCsv("url,max_clicks\nhttps://a.com,abc\n", 10);
  assert.equal(r.ok && r.rows[0].max_clicks, "invalid");
});

test("parseImportCsv errors", () => {
  assert.equal(parseImportCsv("", 10).ok, false);
  assert.equal(parseImportCsv("slug,title\nx,y\n", 10).ok, false);
  assert.equal(parseImportCsv("destination_url\n", 10).ok, false);
  const many = "destination_url\n" + Array.from({ length: 5 }, () => "https://a.com").join("\n");
  const r = parseImportCsv(many, 3);
  assert.equal(r.ok, false);
});
