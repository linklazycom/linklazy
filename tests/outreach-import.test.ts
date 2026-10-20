import test from "node:test";
import assert from "node:assert/strict";
import { IMPORT_MAX_ROWS, parseContactsCsv, planImport, type RawRow } from "@/lib/outreach/import";

const opts = { source: "past_customers" as const, defaultCountry: null, tags: [] as string[] };
const none = new Set<string>();

function rows(csv: string): RawRow[] {
  const p = parseContactsCsv(csv);
  assert.ok(p.ok, p.ok ? "" : p.error);
  return p.ok ? p.rows : [];
}

test("header with aliases, quoted cells and first/last name", () => {
  const r = rows('E-mail,first_name,last_name,Organization,Site,Country\n"a@site.com",Ann,Lee,"Acme, Inc",acme.com,us\n');
  assert.equal(r.length, 1);
  assert.equal(r[0].email, "a@site.com");
  assert.equal(r[0].name, "Ann Lee");
  assert.equal(r[0].company, "Acme, Inc");
  assert.equal(r[0].line, 2);
});

test("a plain list of addresses without a header works", () => {
  const r = rows("a@site.com\nb@site.org\n");
  assert.equal(r.length, 2);
  assert.equal(r[0].line, 1);
  const p = planImport(r, opts, none, none);
  assert.equal(p.counts.toAdd, 2);
});

test("missing email column, empty file and oversized files give clear errors", () => {
  assert.equal(parseContactsCsv("name,company\nAnn,Acme").ok, false);
  assert.equal(parseContactsCsv("").ok, false);
  assert.equal(parseContactsCsv("email\n").ok, false);
  const big = "email\n" + Array.from({ length: IMPORT_MAX_ROWS + 1 }, (_, i) => `u${i}@site.com`).join("\n");
  assert.equal(parseContactsCsv(big).ok, false);
});

test("invalid, duplicate, existing and suppressed rows are skipped with reasons", () => {
  const r = rows("email\nok@site.com\nbad\nOK@site.com\nhave@site.com\nstop@site.com\nnoreply@site.com\n");
  const p = planImport(r, opts, new Set(["have@site.com"]), new Set(["stop@site.com"]));
  assert.deepEqual(p.counts, { rows: 6, toAdd: 1, held: 0, invalid: 2, duplicateInFile: 1, alreadyExisting: 1, suppressed: 1 });
  assert.equal(p.contacts[0].email, "ok@site.com");
  assert.equal(p.contacts[0].status, "active");
  assert.equal(p.problems.length, 5);
});

test("EU/UK/CH contacts are held, from the file, the default or the domain", () => {
  const fromFile = planImport(rows("email,country\na@site.com,DE\nb@site.com,US\n"), opts, none, none);
  assert.equal(fromFile.contacts[0].status, "held");
  assert.equal(fromFile.contacts[0].hold_reason, "restricted_region");
  assert.equal(fromFile.contacts[1].status, "active");
  const fromTld = planImport(rows("email\na@shop.fr\nb@shop.com\n"), opts, none, none);
  assert.equal(fromTld.contacts[0].country, "FR");
  assert.equal(fromTld.contacts[0].country_source, "tld");
  assert.equal(fromTld.contacts[0].status, "held");
  assert.equal(fromTld.contacts[1].status, "active");
  const byDefault = planImport(rows("email\na@site.com\n"), { ...opts, defaultCountry: "GB" }, none, none);
  assert.equal(byDefault.contacts[0].country_source, "default");
  assert.equal(byDefault.contacts[0].status, "held");
  assert.equal(planImport(rows("email,country\na@site.de,BD\n"), opts, none, none).contacts[0].status, "active"); // a stated country wins over the domain
});

test("a bought or collected list is held for source review, region first", () => {
  const p = planImport(rows("email,country\na@site.com,US\nb@site.com,DE\n"), { ...opts, source: "purchased_or_scraped" }, none, none);
  assert.equal(p.contacts[0].hold_reason, "source_review");
  assert.equal(p.contacts[1].hold_reason, "restricted_region");
  assert.equal(p.counts.held, 2);
});

test("tags merge import-wide and per-row, text is cleaned, websites are normalised", () => {
  const p = planImport(rows('email,name,website,tags\na@site.com,"  Ann\u0000  Lee ",Acme.com/blog/,"VIP; Buyers"\nb@site.com,Bob,javascript:alert(1),\n'), { ...opts, tags: ["2026"] }, none, none);
  assert.deepEqual(p.contacts[0].tags, ["2026", "vip", "buyers"]);
  assert.equal(p.contacts[0].full_name, "Ann Lee");
  assert.equal(p.contacts[0].website, "https://acme.com/blog");
  assert.equal(p.contacts[1].website, null);
  assert.deepEqual(p.contacts[1].tags, ["2026"]);
});

test("wrapped addresses are matched against existing and suppressed lists in their normalised form", () => {
  const r = rows("email\n<Stop@Site.com>\nmailto:HAVE@site.com\n");
  const p = planImport(r, opts, new Set(["have@site.com"]), new Set(["stop@site.com"]));
  assert.equal(p.counts.suppressed, 1);
  assert.equal(p.counts.alreadyExisting, 1);
  assert.equal(p.counts.toAdd, 0);
});
