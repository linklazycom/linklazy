import test from "node:test";
import assert from "node:assert/strict";
import { cleanBody, exportFileName, isUuid, validateDocumentPatch, validateNewDocument } from "@/lib/content/documents";
import { DOC_BODY_MAX } from "@/lib/content/kinds";

const OK_UUID = "3f2b1c4e-5a6d-4e7f-8a9b-0c1d2e3f4a5b";

test("a valid new document is accepted and cleaned", () => {
  const r = validateNewDocument({ kind: "bio", title: "  My   bio ", body: "Line one\r\nLine two", project_id: OK_UUID });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.title, "My bio");
    assert.equal(r.value.body, "Line one\nLine two");
    assert.equal(r.value.projectId, OK_UUID);
  }
});

test("bad kind, empty title, empty body and bad project id are refused", () => {
  assert.equal(validateNewDocument({ kind: "x", title: "T", body: "b" }).ok, false);
  assert.equal(validateNewDocument({ kind: "bio", title: " ", body: "b" }).ok, false);
  assert.equal(validateNewDocument({ kind: "bio", title: "T", body: "   " }).ok, false);
  assert.equal(validateNewDocument({ kind: "bio", title: "T", body: "b", project_id: "123" }).ok, false);
});

test("body is capped and stripped of control characters", () => {
  assert.equal(cleanBody("a\u0000b"), "ab");
  assert.equal(cleanBody("x".repeat(DOC_BODY_MAX + 50))?.length, DOC_BODY_MAX);
  assert.equal(cleanBody(5), null);
});

test("patch needs at least one valid change", () => {
  assert.equal(validateDocumentPatch({}).ok, false);
  assert.equal(validateDocumentPatch({ title: "" }).ok, false);
  assert.equal(validateDocumentPatch({ body: "" }).ok, false);
  const r = validateDocumentPatch({ title: "New", body: "Text" });
  assert.ok(r.ok);
});

test("uuid check and export file names", () => {
  assert.equal(isUuid(OK_UUID), true);
  assert.equal(isUuid("../../etc/passwd"), false);
  assert.equal(exportFileName("My Great Post! ../x", "md"), "my-great-post-x.md");
  assert.equal(exportFileName("!!!", "txt"), "document.txt");
});
