/**
 * The user-facing tools an admin can switch on and off (Batch 16C). Pure: used by the admin Features page, the sidebar,
 * and the request gate in proxy middleware. Each tool has ONE switch (a site_settings key). The four older switches keep
 * their original keys so nothing already saved changes.
 *
 * Switched off means: hidden from the sidebar, its pages and its API refuse ordinary users, admins can still open it to test.
 * It never deletes anything the users saved. Marketplace essentials (browse, orders, wallet, support, messages) are NOT
 * switchable here on purpose.
 */
export type ToolGroup = "SEO workspace" | "Link tools";

export interface ToolInfo {
  id: string;
  /** site_settings key holding "on" / "off". Missing = on. */
  flagKey: string;
  label: string;
  group: ToolGroup;
  /** One sentence: what it is. Shown to the admin (Bengali, the admin's working language). */
  what: string;
  /** Why a user would want it. */
  why: string;
  /** How a user uses it, in order. */
  steps: string[];
  /** What the admin must set up or know. */
  adminNotes: string[];
  /** What happens when this switch is OFF, in plain words. */
  whenOff: string;
  userHref: string;
  adminHref: string | null;
  /** Dashboard pages that belong to the tool (matched as path prefixes). */
  pagePrefixes: string[];
  /** API routes that belong to the tool. */
  apiPrefixes: string[];
}

export const TOOLS: ToolInfo[] = [
  {
    id: "projects",
    flagKey: "feature_tool_projects",
    label: "Projects",
    group: "SEO workspace",
    what: "ব্যবহারকারী নিজের ওয়েবসাইট/ব্র্যান্ডকে একটি \"প্রজেক্ট\" হিসেবে যোগ করে: ঠিকানা, niche (বিষয়), কিওয়ার্ড ও প্রতিযোগীর তালিকা।",
    why: "বাকি SEO টুলগুলো (Opportunity Finder, Backlink monitor, AI Content Studio) জানতে চায় ব্যবহারকারী কোন সাইট নিয়ে কাজ করছে। প্রজেক্ট একবার বানালে সব টুলে সেই তথ্য কাজে লাগে, বারবার লিখতে হয় না।",
    steps: [
      "Dashboard > Projects > New project",
      "সাইটের ঠিকানা, niche ও ২–৩টি কিওয়ার্ড লিখুন (চাইলে \"Suggest niche & keywords\" বোতামে AI সাহায্য নিন)",
      "সংরক্ষণ করুন; এখন অন্য টুলে এই প্রজেক্টটি বেছে নেওয়া যাবে",
    ],
    adminNotes: [
      "AI সাজেশন কাজ করতে Admin > API Providers-এ একটি AI প্রোভাইডার চালু থাকতে হয় (না থাকলে বোতামটি \"unavailable\" দেখায়, বাকি সবই চলে)।",
      "প্রজেক্ট ও কিওয়ার্ডের সংখ্যার সীমা Admin > Settings-এ বদলানো যায়।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী প্রজেক্ট বানাতে/দেখতে পারবে না, ফলে Opportunity Finder, Backlink monitor ও AI Content Studio-তে প্রজেক্ট বাছাই করা যাবে না। এগুলোও একসাথে বন্ধ করার কথা ভাবুন।",
    userHref: "/dashboard/projects",
    adminHref: null,
    pagePrefixes: ["/dashboard/projects"],
    apiPrefixes: ["/api/projects"],
  },
  {
    id: "opportunities",
    flagKey: "feature_opportunity_finder",
    label: "Opportunity Finder",
    group: "SEO workspace",
    what: "প্রজেক্টের niche ও কিওয়ার্ড ধরে ওয়েবে খুঁজে দেখায় কোথায় লিংক পাওয়ার সুযোগ থাকতে পারে: গেস্ট-পোস্ট পেজ, ডিরেক্টরি, রিসোর্স পেজ, কমিউনিটি, ব্লগ কমেন্ট।",
    why: "ব্যাকলিংক বানানোর সবচেয়ে সময়সাপেক্ষ কাজ হলো \"কাকে বলব?\" খোঁজা। এই টুল সেই তালিকা বানিয়ে প্রতিটির পাশে স্কোর ও কারণ দেয়, ব্যবহারকারী নিজে বেছে যোগাযোগ করে।",
    steps: [
      "প্রথমে একটি প্রজেক্ট বানান (niche ও কিওয়ার্ডসহ)",
      "Dashboard > Opportunity Finder খুলে প্রজেক্ট ও কী ধরনের সুযোগ চান তা টিক দিন",
      "\"Find opportunities\" চাপুন; ফলাফলে স্কোর, কারণ ও স্ট্যাটাস দেখা যায়, নোট রাখা ও CSV নামানো যায়",
    ],
    adminNotes: [
      "চালানোর জন্য Admin > API Providers-এ একটি **Web search** প্রোভাইডার (Tavily/Google/SearXNG) যোগ ও Enable করতে হবে; না থাকলে পেজে \"not set up\" দেখায়।",
      "প্রতি সার্চ রানে সার্চ-সার্ভিসের কোটা খরচ হয়; একই সার্চ ৭ দিন ক্যাশ থাকে। দাম/ফ্রি-সংখ্যা Admin > Usage pricing-এ।",
      "এটি গ্লোবাল \"external APIs\" সুইচেরও অধীন।",
    ],
    whenOff: "বন্ধ করলে নতুন সার্চ চলে না এবং ব্যবহারকারী পেজটি খুলতে পারে না (সংরক্ষিত ফলাফল মোছা হয় না)।",
    userHref: "/dashboard/opportunities",
    adminHref: "/admin/api-providers",
    pagePrefixes: ["/dashboard/opportunities"],
    apiPrefixes: ["/api/opportunities"],
  },
  {
    id: "backlinks",
    flagKey: "feature_backlink_monitor",
    label: "Backlink monitor",
    group: "SEO workspace",
    what: "ব্যবহারকারী যেসব ব্যাকলিংক পেয়েছে তা তালিকায় রাখে; সিস্টেম নিয়মিত দেখে লিংকটি এখনো পেজে আছে কিনা, follow না nofollow, অ্যাঙ্কর ঠিক আছে কিনা।",
    why: "লিংক বসানোর পর অনেক সময় পেজ থেকে সরে যায় বা nofollow হয়ে যায়। ব্যবহারকারী না জানলে টাকা/পরিশ্রম নষ্ট; এই টুল সেটি ধরে দেয়।",
    steps: [
      "Dashboard > Backlink monitor > Add backlink (বা CSV ইমপোর্ট)",
      "যে পেজে লিংক আছে (source) ও যে সাইটে লিংক যাচ্ছে (target) লিখুন",
      "সিস্টেম দৈনিক চেক করে; চাইলে \"Check now\" চাপা যায়; স্ট্যাটাস Active / Missing ইত্যাদি দেখায়",
    ],
    adminNotes: [
      "দৈনিক চেক Vercel cron-এ চলে (Settings > Cron Jobs-এ ফল দেখা যায়)।",
      "ব্যাকলিংক-সংখ্যার সীমা ও ঘণ্টায় ম্যানুয়াল চেকের সীমা Admin > Links-এ বদলানো যায় (সীমা `0` = ফিচার বন্ধ)।",
      "এটি গ্লোবাল \"external APIs\" সুইচেরও অধীন।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারীরা পেজটি খুলতে পারে না এবং স্বয়ংক্রিয় চেকও থামে; সংরক্ষিত তালিকা থাকে।",
    userHref: "/dashboard/backlinks",
    adminHref: "/admin/links",
    pagePrefixes: ["/dashboard/backlinks"],
    apiPrefixes: ["/api/backlinks"],
  },
  {
    id: "content",
    flagKey: "feature_ai_content",
    label: "AI Content Studio",
    group: "SEO workspace",
    what: "AI দিয়ে লেখা তৈরি: আউটরিচ ইমেইল, বায়ো, আর্টিকেলের আইডিয়া/আউটলাইন/ড্রাফট, টাইটেল, কমেন্ট, alt text; সাথে স্টক ছবি খোঁজা।",
    why: "ব্যবহারকারী লিংক-বিল্ডিংয়ের জন্য যা লিখতে হয় (ইমেইল, গেস্ট পোস্ট) তার প্রথম খসড়া দ্রুত পায়। ড্রাফট সংরক্ষণ করে পরে এডিট করা যায়।",
    steps: [
      "Dashboard > AI Content Studio খুলে কী ধরনের লেখা চান বাছুন",
      "প্রজেক্ট ও বিষয় দিন, \"Generate\" চাপুন",
      "ফল কপি বা ডকুমেন্ট হিসেবে সংরক্ষণ করুন; ছবি লাগলে ছবি-খোঁজা ট্যাব ব্যবহার করুন",
    ],
    adminNotes: [
      "Admin > API Providers-এ অন্তত একটি **AI** প্রোভাইডার (OpenAI/Anthropic/অন্য) Enable করতে হয়। ছবির জন্য Pexels/Pixabay-র মতো **image** প্রোভাইডার ঐচ্ছিক।",
      "প্রতিটি জেনারেশনে প্রোভাইডারের খরচ হয়; Admin > Usage pricing-এ ফ্রি-সংখ্যা/দাম ঠিক করে ওয়ালেট থেকে চার্জ নেওয়া যায় (এখন চার্জ বন্ধ থাকতে পারে)।",
      "এটি গ্লোবাল \"external APIs\" সুইচেরও অধীন; একই সুইচ প্রজেক্টের AI সাজেশনেও কাজ করে।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী Content Studio খুলতে পারে না; সংরক্ষিত ডকুমেন্ট মোছা হয় না।",
    userHref: "/dashboard/content",
    adminHref: "/admin/api-providers",
    pagePrefixes: ["/dashboard/content"],
    apiPrefixes: ["/api/content"],
  },
  {
    id: "links",
    flagKey: "feature_link_management",
    label: "Short links & QR",
    group: "Link tools",
    what: "ব্যবহারকারী লম্বা লিংককে linklazy.com/l/… ধরনের ছোট লিংক বানায়, ক্লিক গোনে, UTM যোগ করে, QR কোড নামায়, CSV ইমপোর্ট/এক্সপোর্ট করে।",
    why: "প্রচারের লিংক ছোট ও ট্র্যাকযোগ্য হয়; কোন লিংকে কত ক্লিক এল তা দেখা যায়। LinkLazy-র ভিজিটর বাড়ানোর একটি পথও।",
    steps: [
      "Dashboard > Short links & QR > New link",
      "গন্তব্য ঠিকানা দিন (চাইলে নিজের slug, মেয়াদ, UTM)",
      "ছোট লিংক কপি করুন বা QR নামান; ক্লিকের পরিসংখ্যান লিংকের পাতায়",
    ],
    adminNotes: [
      "অপব্যবহারের রিপোর্ট ও ব্লকলিস্ট Admin > Links-এর নিচের পাতায় সামলানো হয়।",
      "সীমা (ইউজার-প্রতি লিংক সংখ্যা ইত্যাদি) Admin > Links-এ।",
    ],
    whenOff: "⚠️ গুরুত্বপূর্ণ: এটি বন্ধ করলে জনসাধারণের জন্য **সব ছোট লিংক (/l/…) কাজ করা বন্ধ** হয়ে যায় (৫০৩), শুধু ড্যাশবোর্ডই নয়। জরুরি অবস্থা (অপব্যবহার) ছাড়া বন্ধ করবেন না।",
    userHref: "/dashboard/links",
    adminHref: "/admin/links",
    pagePrefixes: ["/dashboard/links"],
    apiPrefixes: ["/api/links"],
  },
  {
    id: "bio",
    flagKey: "feature_tool_bio",
    label: "Bio pages",
    group: "Link tools",
    what: "ব্যবহারকারী একটি \"লিংক-ইন-বায়ো\" পেজ বানায়: নাম, ছোট পরিচিতি ও লিংকের তালিকা, একটি পাবলিক ঠিকানায়।",
    why: "সোশ্যাল প্রোফাইলে একটি মাত্র লিংক দেওয়ার সুযোগ থাকে; এক পেজে সব দরকারি লিংক রাখা যায় এবং প্রতিটির ক্লিক গোনা যায়।",
    steps: [
      "Dashboard > Bio pages > Create",
      "নাম, বর্ণনা ও লিংক যোগ করুন, ক্রম ঠিক করুন",
      "পাবলিক ঠিকানা (/bio/…) সোশ্যাল প্রোফাইলে বসান",
    ],
    adminNotes: ["অপব্যবহার হলে Admin > Bio pages থেকে \"Take down\" করা যায়।"],
    whenOff: "বন্ধ করলে ব্যবহারকারীর এডিটর (ড্যাশবোর্ড) বন্ধ হয়। **যে পাবলিক বায়ো পেজ আগেই চালু আছে সেগুলো দেখা যেতে থাকে** — একটি নির্দিষ্ট পেজ নামাতে Admin > Bio pages-এর \"Take down\" ব্যবহার করুন।",
    userHref: "/dashboard/bio",
    adminHref: "/admin/bio",
    pagePrefixes: ["/dashboard/bio"],
    apiPrefixes: ["/api/bio"],
  },
  {
    id: "domains",
    flagKey: "feature_tool_domains",
    label: "Custom domains",
    group: "Link tools",
    what: "ব্যবহারকারী নিজের ডোমেইন (যেমন go.তার-সাইট.com) যুক্ত করে তাতে নিজের ছোট লিংক চালায়।",
    why: "ব্র্যান্ডেড লিংক বেশি বিশ্বাসযোগ্য দেখায় এবং ক্লিক রেট বাড়ায়।",
    steps: [
      "Dashboard > Custom domains > Add domain",
      "সিস্টেমের দেওয়া TXT ও CNAME রেকর্ড ডোমেইনের DNS-এ বসান",
      "\"Check again\" চাপুন; Active হলে ছোট লিংক ঐ ডোমেইনেও চলে",
    ],
    adminNotes: [
      "Vercel টোকেন (env) দিলে স্বয়ংক্রিয়, না দিলে ম্যানুয়াল মোড: আপনি Vercel-এ ডোমেইন যোগ করে Admin > Custom domains-এ \"Mark active\" চাপবেন।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী নতুন ডোমেইন যোগ বা যাচাই করতে পারে না। **আগে থেকে সক্রিয় ডোমেইনের রিডাইরেক্ট চলতেই থাকে।**",
    userHref: "/dashboard/domains",
    adminHref: "/admin/domains",
    pagePrefixes: ["/dashboard/domains"],
    apiPrefixes: ["/api/domains"],
  },
  {
    id: "api_keys",
    flagKey: "feature_tool_api_keys",
    label: "API keys",
    group: "Link tools",
    what: "ব্যবহারকারী API কী বানায়, যা দিয়ে নিজের প্রোগ্রাম থেকে ছোট লিংক তৈরি/দেখা যায় (/api/v1)।",
    why: "যারা নিজের সফটওয়্যার বা স্ক্রিপ্ট থেকে লিংক তৈরি করতে চান তাদের জন্য। বেশিরভাগ ব্যবহারকারীর এটি লাগবে না।",
    steps: [
      "Dashboard > API keys > Create key (শুধু পড়া বা পড়া+লেখা)",
      "কীটি তখনই কপি করুন (পরে আর দেখা যায় না)",
      "অনুরোধে Authorization: Bearer <কী> হেডার দিন; নির্দেশিকা /api-docs পেজে",
    ],
    adminNotes: ["কী ব্যবহারকারী নিজে বাতিল করতে পারে।"],
    whenOff: "বন্ধ করলে ব্যবহারকারী নতুন কী বানাতে বা পরিচালনা করতে পারে না। **আগের কীগুলো দিয়ে /api/v1 চলতেই থাকে** (সেটি এই সুইচের বাইরে)।",
    userHref: "/dashboard/api-keys",
    adminHref: null,
    pagePrefixes: ["/dashboard/api-keys"],
    apiPrefixes: ["/api/api-keys"],
  },
];

export const TOOL_FLAG_KEYS: string[] = TOOLS.map((t) => t.flagKey);
export const toolById = (id: string): ToolInfo | undefined => TOOLS.find((t) => t.id === id);
export const toolByFlagKey = (key: string): ToolInfo | undefined => TOOLS.find((t) => t.flagKey === key);

const matchesPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Which tool a request path belongs to, and whether it is one of its pages or its API. Null for everything else. */
export function toolForPath(path: string): { tool: ToolInfo; surface: "page" | "api" } | null {
  for (const tool of TOOLS) {
    if (tool.pagePrefixes.some((p) => matchesPrefix(path, p))) return { tool, surface: "page" };
    if (tool.apiPrefixes.some((p) => matchesPrefix(path, p))) return { tool, surface: "api" };
  }
  return null;
}

export type GateDecision = { action: "allow" } | { action: "redirect"; to: string } | { action: "block" };

/**
 * Whether a request may proceed. `flags` maps flag keys to on/off (a missing key counts as on). Admins always pass, so they can test a
 * tool while it is off. Everything unknown is allowed: this gate may only ever take a tool away deliberately.
 */
export function decideGate(path: string, role: string | null | undefined, flags: Record<string, boolean>): GateDecision {
  const hit = toolForPath(path);
  if (!hit) return { action: "allow" };
  if (flags[hit.tool.flagKey] !== false) return { action: "allow" };
  if (role === "admin") return { action: "allow" };
  return hit.surface === "page" ? { action: "redirect", to: `/dashboard/unavailable?tool=${hit.tool.id}` } : { action: "block" };
}
