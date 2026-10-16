import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyBrowser, classifyDevice } from "@/lib/analytics/ua";
import { isLikelyBot } from "@/lib/links/bot";

const CHROME_WIN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const EDGE = CHROME_WIN + " Edg/120.0.0.0";
const OPERA = CHROME_WIN + " OPR/105.0.0.0";
const FIREFOX = "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0";
const SAFARI_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const ANDROID_TABLET = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const SAMSUNG = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36";

test("browser classification", () => {
  assert.equal(classifyBrowser(CHROME_WIN), "chrome");
  assert.equal(classifyBrowser(EDGE), "edge");
  assert.equal(classifyBrowser(OPERA), "opera");
  assert.equal(classifyBrowser(FIREFOX), "firefox");
  assert.equal(classifyBrowser(SAFARI_MAC), "safari");
  assert.equal(classifyBrowser(IPHONE), "safari");
  assert.equal(classifyBrowser(SAMSUNG), "samsung");
  assert.equal(classifyBrowser(""), "other");
  assert.equal(classifyBrowser(null), "other");
});

test("device classification", () => {
  assert.equal(classifyDevice(CHROME_WIN), "desktop");
  assert.equal(classifyDevice(SAFARI_MAC), "desktop");
  assert.equal(classifyDevice(FIREFOX), "desktop");
  assert.equal(classifyDevice(IPHONE), "mobile");
  assert.equal(classifyDevice(ANDROID_PHONE), "mobile");
  assert.equal(classifyDevice(IPAD), "tablet");
  assert.equal(classifyDevice(ANDROID_TABLET), "tablet");
  assert.equal(classifyDevice("something odd"), "other");
  assert.equal(classifyDevice(undefined), "other");
});

test("bot detection: crawlers, previews, tools and missing UA", () => {
  for (const ua of [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0)",
    "facebookexternalhit/1.1",
    "WhatsApp/2.23.20 A",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "TelegramBot (like TwitterBot)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
    "curl/8.4.0",
    "python-requests/2.31.0",
    "Mozilla/5.0 (compatible; UptimeRobot/2.0)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0)",
    "",
    null,
    "x",
  ]) {
    assert.equal(isLikelyBot(ua), true, String(ua));
  }
});

test("bot detection: real browsers are not bots", () => {
  for (const ua of [CHROME_WIN, EDGE, FIREFOX, SAFARI_MAC, IPHONE, ANDROID_PHONE, SAMSUNG]) {
    assert.equal(isLikelyBot(ua), false, ua);
  }
});
