/**
 * Bot / link-preview / uptime-monitor detection (Batch 9 minimal, Batch 10 extended).
 * Used so that crawlers and chat-app previews never inflate click counts, never
 * burn a click-limited link, and never pollute analytics.
 * A missing user agent counts as a bot: real browsers always send one.
 */
const BOT_RE = new RegExp(
  [
    "bot", "crawl", "spider", "slurp", "preview", "facebookexternalhit", "whatsapp", "telegram", "discord",
    "slack", "skype", "linkedin", "pinterest", "embedly", "quora", "vkshare", "headless", "lighthouse",
    "curl\\/", "wget\\/", "python-requests", "python-urllib", "aiohttp", "httpx", "axios", "node-fetch", "undici",
    "go-http-client", "okhttp", "java\\/", "libwww", "scrapy", "postman", "insomnia", "http-client",
    "ahrefs", "semrush", "mj12", "dotbot", "petalbot", "bytespider", "gptbot", "claudebot", "ccbot",
    "yandex", "baidu", "duckduck", "applebot", "bingpreview", "feedfetcher", "mediapartners", "apis-google",
    "pingdom", "uptime", "monitor", "statuscake", "datadog", "newrelic", "checkly",
  ].join("|"),
  "i"
);

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 8) return true;
  return BOT_RE.test(userAgent);
}
