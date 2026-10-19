import test from "node:test";
import assert from "node:assert/strict";
import { buildImageSearchRequest, cleanImageQuery, creditLine, isImageAdapter, parseImageResponse, safeProviderUrl } from "@/lib/providers/images";

test("query cleaning keeps search words and drops symbols", () => {
  assert.equal(cleanImageQuery("  laptop <script> on   desk  "), "laptop script on desk");
  assert.equal(cleanImageQuery("a"), null);
  assert.equal(cleanImageQuery(5), null);
  assert.equal(cleanImageQuery("x".repeat(200))?.length, 80);
});

test("pexels request uses the Authorization header; pixabay puts the key in the query", () => {
  const p = buildImageSearchRequest({ adapter: "pexels", apiKey: "K1", query: "dog food" });
  assert.ok(p.url.startsWith("https://api.pexels.com/v1/search?query=dog%20food"));
  assert.equal(p.headers.Authorization, "K1");
  const x = buildImageSearchRequest({ adapter: "pixabay", apiKey: "K 2", query: "dog" });
  assert.ok(x.url.startsWith("https://pixabay.com/api/?key=K%202&q=dog"));
  assert.ok(x.url.includes("safesearch=true"));
  assert.equal(x.headers.Authorization, undefined);
});

test("only https URLs on the provider's own hosts are accepted", () => {
  assert.ok(safeProviderUrl("pexels", "https://images.pexels.com/photos/1/a.jpg"));
  assert.equal(safeProviderUrl("pexels", "http://images.pexels.com/photos/1/a.jpg"), null);
  assert.equal(safeProviderUrl("pexels", "https://evil.example/a.jpg"), null);
  assert.equal(safeProviderUrl("pexels", "https://pexels.com.evil.example/a.jpg"), null);
  assert.equal(safeProviderUrl("pexels", "javascript:alert(1)"), null);
  assert.equal(safeProviderUrl("pixabay", "https://user:pw@pixabay.com/x"), null);
  assert.equal(safeProviderUrl("pixabay", "https://pixabay.com/photos/x-1/"), "https://pixabay.com/photos/x-1/");
});

test("pexels response is parsed and unsafe items are skipped", () => {
  const imgs = parseImageResponse("pexels", {
    photos: [
      { id: 1, url: "https://www.pexels.com/photo/a-1/", alt: "A dog", photographer: "Ann", photographer_url: "https://www.pexels.com/@ann", src: { medium: "https://images.pexels.com/photos/1/m.jpg" } },
      { id: 2, url: "https://evil.example/p", photographer: "Bob", src: { medium: "https://images.pexels.com/photos/2/m.jpg" } },
      { id: 3, url: "https://www.pexels.com/photo/c-3/", photographer: "", src: { medium: "https://images.pexels.com/photos/3/m.jpg" } },
      null,
    ],
  });
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].id, "pexels-1");
  assert.equal(imgs[0].creator, "Ann");
  assert.equal(creditLine(imgs[0]), "Photo by Ann on Pexels");
});

test("pixabay response is parsed; tags become the alt hint", () => {
  const imgs = parseImageResponse("pixabay", {
    hits: [{ id: 9, pageURL: "https://pixabay.com/photos/cat-9/", tags: "cat, pet, animal", user: "Zed", user_id: 77, webformatURL: "https://pixabay.com/get/x_640.jpg" }],
  });
  assert.equal(imgs.length, 1);
  assert.equal(imgs[0].alt, "cat, pet, animal");
  assert.equal(imgs[0].source, "Pixabay");
  assert.ok(imgs[0].creatorUrl?.startsWith("https://pixabay.com/users/"));
});

test("garbage replies give an empty list, never a throw", () => {
  assert.deepEqual(parseImageResponse("pexels", null), []);
  assert.deepEqual(parseImageResponse("pexels", { photos: "x" }), []);
  assert.deepEqual(parseImageResponse("pixabay", { hits: {} }), []);
  assert.equal(isImageAdapter("pexels"), true);
  assert.equal(isImageAdapter("openai_compatible"), false);
});
