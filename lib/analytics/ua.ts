/**
 * Coarse user-agent classification for click analytics (Batch 10).
 * Deliberately coarse (6 browsers, 4 device classes): enough for charts,
 * far too little to fingerprint anyone.
 */
export type DeviceClass = "desktop" | "mobile" | "tablet" | "other";
export type BrowserClass = "chrome" | "safari" | "firefox" | "edge" | "opera" | "samsung" | "other";

export function classifyDevice(ua: string | null | undefined): DeviceClass {
  const s = ua ?? "";
  if (/ipad|tablet|playbook|silk/i.test(s)) return "tablet";
  if (/android/i.test(s) && !/mobile/i.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android|windows phone/i.test(s)) return "mobile";
  if (/windows nt|macintosh|mac os x|x11|linux|cros/i.test(s)) return "desktop";
  return "other";
}

export function classifyBrowser(ua: string | null | undefined): BrowserClass {
  const s = ua ?? "";
  if (/edg(e|a|ios)?\//i.test(s)) return "edge";
  if (/opr\/|opera/i.test(s)) return "opera";
  if (/samsungbrowser/i.test(s)) return "samsung";
  if (/firefox|fxios/i.test(s)) return "firefox";
  if (/chrome|crios|chromium/i.test(s)) return "chrome";
  if (/safari/i.test(s)) return "safari";
  return "other";
}
