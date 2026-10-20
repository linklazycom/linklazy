import test from "node:test";
import assert from "node:assert/strict";
import { buildImportPayload, FIELD_DEFS, parseImportResponse, parseSequences, validateFieldMap } from "@/lib/outreach/saleshandy";
import { buildOutreachTemplate, SUBJECT_OPTIONS } from "@/lib/outreach/template";

const MAP = { email: "Y7PWZEW7wo", first_name: "GlPYv8WvaV", listing_name: "LnAbc12345", listing_price: "PrAbc12345" };

test("field map needs the email id and rejects malformed ids", () => {
  assert.equal(validateFieldMap({ first_name: "GlPYv8WvaV" }).ok, false);
  assert.equal(validateFieldMap({ email: "x" }).ok, false);
  assert.equal(validateFieldMap({ email: "bad id!" }).ok, false);
  assert.equal(validateFieldMap(null).ok, false);
  const ok = validateFieldMap({ email: " Y7PWZEW7wo ", first_name: "", listing_url: "LuAbc12345", junk: "zzzzzz" });
  assert.ok(ok.ok);
  if (ok.ok) assert.deepEqual(ok.value, { email: "Y7PWZEW7wo", listing_url: "LuAbc12345" });
});

test("import payload follows Saleshandy's documented shape and skips unmapped or empty fields", () => {
  const p = buildImportPayload({
    stepId: "STEPabc12",
    fieldMap: MAP,
    rows: [{ email: "a@site.com", firstName: " Ann ", lastName: "Lee", listingName: "ex****.com (tech)", listingPrice: "$80", listingUrl: "https://x/y" }, { email: "b@site.com" }],
  });
  assert.equal(p.stepId, "STEPabc12");
  assert.equal(p.verifyProspects, false);
  assert.equal(p.conflictAction, "overwrite");
  assert.equal(p.prospectList.length, 2);
  assert.deepEqual(p.prospectList[0].fields, [
    { id: "Y7PWZEW7wo", value: "a@site.com" },
    { id: "GlPYv8WvaV", value: "Ann" },
    { id: "LnAbc12345", value: "ex****.com (tech)" },
    { id: "PrAbc12345", value: "$80" },
  ]);
  assert.deepEqual(p.prospectList[1].fields, [{ id: "Y7PWZEW7wo", value: "b@site.com" }]);
});

test("long values are clipped and whitespace is collapsed", () => {
  const p = buildImportPayload({ stepId: "STEPabc12", fieldMap: MAP, rows: [{ email: "a@b.com", firstName: "x".repeat(900) + "\n  y" }] });
  assert.equal(p.prospectList[0].fields[1].value.length, 500);
});

test("sequence lists are read from several envelope shapes", () => {
  const items = [{ id: "139223", name: "Outreach A" }, { id: 7, sequenceName: "Outreach B" }, { id: "x" }, null];
  const want = [{ id: "139223", name: "Outreach A" }, { id: "7", name: "Outreach B" }];
  assert.deepEqual(parseSequences({ sequences: items }), want);
  assert.deepEqual(parseSequences({ payload: { sequences: items } }), want);
  assert.deepEqual(parseSequences({ payload: items }), want);
  assert.deepEqual(parseSequences(items), want);
  assert.deepEqual(parseSequences({ nothing: true }), []);
  assert.deepEqual(parseSequences("x"), []);
});

test("import replies: success, refusal and HTTP errors", () => {
  assert.deepEqual(parseImportResponse(200, { payload: { requestId: "req_abc123" }, message: "Prospect import has started." }), { ok: true, requestRef: "req_abc123", message: "Prospect import has started." });
  assert.equal(parseImportResponse(200, {}).ok, true);
  assert.equal(parseImportResponse(200, { error: true, message: "Bad step" }).ok, false);
  assert.equal(parseImportResponse(200, { success: false }).ok, false);
  const e = parseImportResponse(401, { message: "Invalid API key" });
  assert.equal(e.ok, false);
  assert.equal(e.message, "Invalid API key");
  assert.equal(parseImportResponse(500, null).message, "Saleshandy answered HTTP 500.");
});

test("template uses only merge tags that match the Saleshandy field names, in the brand colours", () => {
  const t = buildOutreachTemplate({ senderName: "LinkLazy <Ltd>", senderAddress: "12 Road\nDhaka 1205", siteUrl: "https://linklazy.com/" });
  const allowed = new Set(FIELD_DEFS.map((f) => f.saleshandyName));
  for (const blob of [t.html, t.text, ...SUBJECT_OPTIONS]) {
    for (const m of blob.matchAll(/\{\{([^}]+)\}\}/g)) assert.ok(allowed.has(m[1]), `unknown merge tag {{${m[1]}}}`);
  }
  assert.ok(t.html.includes("{{Listing Price}}") && t.html.includes("{{Listing Metrics}}") && t.html.includes('href="{{Listing URL}}"'));
  for (const colour of ["#0A0E27", "#2C75FC", "#6D35F9", "#B23CFC", "#E8A33D"]) assert.ok(t.html.includes(colour), colour);
  assert.ok(t.html.includes("LinkLazy &lt;Ltd&gt;"));
  assert.ok(!t.html.includes("LinkLazy <Ltd>"));
  assert.ok(t.html.includes("12 Road<br>Dhaka 1205"));
  assert.ok(t.text.includes("12 Road\nDhaka 1205"));
});
