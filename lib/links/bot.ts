/**
 * Minimal bot / link-preview detection (Batch 9). It exists so that chat apps
 * and crawlers that pre-fetch a link do NOT use up a click-limited link.
 * Batch 10 extends this with the full analytics bot filter and tests.
 */
const BOT_RE =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|skype|linkedin|pinterest|embedly|quora|vkshare|headless|curl\/|wget\/|python-requests|axios|go-http-client|okhttp|java\//i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true; // real browsers always send a UA
  return BOT_RE.test(userAgent);
}
