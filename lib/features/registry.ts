/**
 * The user-facing tools an admin can switch on and off (Batch 16C). Pure: used by the admin Features page, the sidebar,
 * and the request gate in proxy middleware. Each tool has ONE switch (a site_settings key). The four older switches keep
 * their original keys so nothing already saved changes.
 *
 * Switched off means: hidden from the sidebar, its pages and its API refuse ordinary users, admins can still open it to test.
 * It never deletes anything the users saved. Marketplace essentials (browse, orders, wallet, support, messages) are NOT
 * switchable here on purpose.
 */
export type ToolGroup = "SEO workspace" | "Link tools" | "Marketplace extras" | "Public tools";

export interface ToolInfo {
  id: string;
  /** site_settings key holding "on" / "off". Missing = on. */
  flagKey: string;
  label: string;
  group: ToolGroup;
  /** "public" tools live outside the dashboard (anyone can open them); their pages and API also check the switch themselves for visitors who are not logged in. */
  surface?: "dashboard" | "public";
  /** One plain English sentence shown to the public on the About page (only while the tool is switched on). */
  publicSummary: string;
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
  /** Pages that belong to the tool (matched as path prefixes): /dashboard/... for dashboard tools, e.g. /tools for public ones. */
  pagePrefixes: string[];
  /** Exact-shape pages that a plain prefix cannot describe (e.g. /dashboard/sites/<id>/matches, because /dashboard/sites itself is never switchable). */
  pagePatterns?: RegExp[];
  /** API routes that belong to the tool. */
  apiPrefixes: string[];
}

export const TOOLS: ToolInfo[] = [
  {
    id: "projects",
    publicSummary: "Projects: save your websites with their niche, keywords and competitors once, and use them across every SEO tool.",
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
      "প্রজেক্ট ও কিওয়ার্ডের সংখ্যার সীমা Admin > Links-এর সীমা-সেটিংসে বদলানো যায় (সীমা `0` = ব্যবহারকারীদের জন্য ফিচার বন্ধ)।",
      "Admin > SEO tools > Projects-এ মোট প্রজেক্ট, জনপ্রিয় niche ও সর্বশেষ প্রজেক্ট দেখা যায় (শুধু দেখা, বদলানো নয়)।",
      "অপব্যবহার হলে Admin > Projects থেকে কোনো প্রজেক্ট Pause করা যায়: তখন সেটি নতুন Opportunity সার্চ, AI খসড়া ও নতুন ব্যাকলিংক-মনিটর চালাতে পারে না, দৈনিক ব্যাকলিংক চেক থামে এবং প্রজেক্টটি মোছাও যায় না; মালিক ইমেইল পান ও প্রজেক্টে \"Paused\" দেখেন। তথ্য মোছে না। গুরুতর অপব্যবহারে ব্যবহারকারীর অ্যাকাউন্টই সাসপেন্ড করুন (Pause শুধু একটি প্রজেক্টকে থামায়)। (SQL 071 লাগে।)",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী প্রজেক্ট বানাতে/দেখতে পারবে না, ফলে Opportunity Finder, Backlink monitor ও AI Content Studio-তে প্রজেক্ট বাছাই করা যাবে না। এগুলোও একসাথে বন্ধ করার কথা ভাবুন।",
    userHref: "/dashboard/projects",
    adminHref: "/admin/projects",
    pagePrefixes: ["/dashboard/projects"],
    apiPrefixes: ["/api/projects"],
  },
  {
    id: "opportunities",
    publicSummary: "Opportunity Finder: search the web for places that may link to you (guest-post pages, directories, resource pages), each with a transparent score and reasons.",
    flagKey: "feature_opportunity_finder",
    label: "Opportunity Finder",
    group: "SEO workspace",
    what: "ব্যবহারকারীর প্রজেক্টের niche ও কিওয়ার্ড ধরে ওয়েবে খুঁজে দেখায় কোথায় লিংক পাওয়ার সুযোগ থাকতে পারে: গেস্ট-পোস্ট পেজ, ডিরেক্টরি, রিসোর্স পেজ, কমিউনিটি/প্রোফাইল, ব্লগ কমেন্ট। এটি কাউকে ইমেইল করে না, কোনো সাইট স্ক্র্যাপ করে না; শুধু আপনার যোগ করা অফিসিয়াল সার্চ-সার্ভিস (Tavily/Google/SearXNG) থেকে ফল আনে।",
    why: "ব্যাকলিংক বানানোর সবচেয়ে সময়সাপেক্ষ কাজ \"কাকে বলব?\" খোঁজা। এই টুল সেই তালিকা বানিয়ে প্রতিটির পাশে ০–১০০ স্কোর ও কারণ দেয়, আর \"Likely / Possible / Not confirmed\" লেবেল দেয়। ব্যবহারকারী নিজে বেছে যোগাযোগ করে। ফলে নতুন ব্যবহারকারী প্ল্যাটফর্মে এসেই কাজের তালিকা পায়।",
    steps: [
      "প্রথমে Dashboard > Projects-এ একটি প্রজেক্ট বানান (niche ও ২–৩টি কিওয়ার্ডসহ); প্রজেক্ট না থাকলে ফর্মই দেখা যায় না",
      "Dashboard > Opportunity Finder খুলে প্রজেক্ট ও কী ধরনের সুযোগ চান তা টিক দিন",
      "\"Find opportunities\" চাপুন; কয়েক সেকেন্ডে ফল আসে (প্রতি রানে সর্বোচ্চ ৬টি সার্চ)",
      "ফলাফলে \"Why this score?\" খুলে কারণ দেখুন; স্ট্যাটাস (Saved/Contacted/Done/Ignored) ও নোট রাখুন; CSV নামান",
    ],
    adminNotes: [
      "চালানোর জন্য Admin > API Providers-এ একটি Web search প্রোভাইডার (Tavily/Google/SearXNG) যোগ ও Enable করতে হবে; না থাকলে ব্যবহারকারী পেজে \"not set up\" দেখে।",
      "Admin > SEO tools > Opportunity Finder পেজে দেখা যায়: টুল চালু কিনা, প্রোভাইডারের আজ/এই মাসের ব্যবহার, কে কত রান করল, ব্যর্থ রানের কারণ; সেখান থেকে আপনি নিজেও চালিয়ে পরীক্ষা করতে পারেন।",
      "প্রতি নতুন সার্চ-বাক্য সার্চ-সার্ভিসের ১টি কোটা খরচ করে; একই বাক্য ৭ দিন ক্যাশ থাকে। দাম/ফ্রি-সংখ্যা (ডিফল্ট দিনে ৩টি ফ্রি রান) Admin > Usage pricing-এ; চার্জ বন্ধ থাকলে সব ফ্রি।",
      "ব্যবহারকারী প্রতি ঘণ্টায় ১০ রান, প্রতি প্রজেক্টে ১,০০০ সুযোগ পর্যন্ত। এটি গ্লোবাল \"external APIs\" সুইচেরও অধীন।",
      "স্কোর শুধু সার্চ-ফলাফলের লেখা থেকে (DA/ট্রাফিক নেই), তাই \"Likely\" মানে প্রমাণ নয়; ব্যবহারকারীকে পেজ নিজে দেখে নিতে বলা হয়।",
    ],
    whenOff: "বন্ধ করলে নতুন সার্চ চলে না এবং ব্যবহারকারী পেজটি খুলতে পারে না (সংরক্ষিত ফলাফল মোছা হয় না, ON করলে ফিরে আসে)।",
    userHref: "/dashboard/opportunities",
    adminHref: "/admin/opportunities",
    pagePrefixes: ["/dashboard/opportunities"],
    apiPrefixes: ["/api/opportunities"],
  },
  {
    id: "backlinks",
    publicSummary: "Backlink monitor: track the links you have earned and get automatic checks that they are still live and followed.",
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
      "Admin > SEO tools > Backlink monitor-এ অবস্থা অনুযায়ী সংখ্যা, শেষ চেকের সময় (২ দিনের বেশি পুরোনো হলে লাল সতর্কতা) ও সমস্যাযুক্ত লিংকের তালিকা দেখা যায়।",
      "এটি গ্লোবাল \"external APIs\" সুইচেরও অধীন।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারীরা পেজটি খুলতে পারে না এবং স্বয়ংক্রিয় চেকও থামে; সংরক্ষিত তালিকা থাকে।",
    userHref: "/dashboard/backlinks",
    adminHref: "/admin/backlinks",
    pagePrefixes: ["/dashboard/backlinks"],
    apiPrefixes: ["/api/backlinks"],
  },
  {
    id: "content",
    publicSummary: "AI Content Studio: draft outreach emails, bios, article outlines and more, and find stock images.",
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
      "Admin > API Providers-এ অন্তত একটি AI প্রোভাইডার (OpenAI/Anthropic/অন্য) Enable করতে হয়। ছবির জন্য Pexels/Pixabay-র মতো image প্রোভাইডার ঐচ্ছিক।",
      "Admin > SEO tools > AI Content Studio-তে AI কলের সংখ্যা (আজ/৭/৩০ দিন), ব্যর্থতা ও প্রোভাইডার-ভিত্তিক হিসাব দেখা যায় (ব্যবহারকারীর লেখা দেখানো হয় না)।",
      "প্রতিটি জেনারেশনে প্রোভাইডারের খরচ হয়; Admin > Usage pricing-এ ফ্রি-সংখ্যা/দাম ঠিক করে ওয়ালেট থেকে চার্জ নেওয়া যায় (এখন চার্জ বন্ধ থাকতে পারে)।",
      "এটি গ্লোবাল \"external APIs\" সুইচেরও অধীন; একই সুইচ প্রজেক্টের AI সাজেশনেও কাজ করে।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী Content Studio খুলতে পারে না; সংরক্ষিত ডকুমেন্ট মোছা হয় না।",
    userHref: "/dashboard/content",
    adminHref: "/admin/content-studio",
    pagePrefixes: ["/dashboard/content"],
    apiPrefixes: ["/api/content"],
  },
  {
    id: "links",
    publicSummary: "Short links & QR codes: shorten links, count clicks, add UTM tags and download QR codes.",
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
    whenOff: "⚠️ গুরুত্বপূর্ণ: এটি বন্ধ করলে জনসাধারণের জন্য সব ছোট লিংক (/l/…) কাজ করা বন্ধ হয়ে যায় (৫০৩), শুধু ড্যাশবোর্ডই নয়। জরুরি অবস্থা (অপব্যবহার) ছাড়া বন্ধ করবেন না।",
    userHref: "/dashboard/links",
    adminHref: "/admin/links",
    pagePrefixes: ["/dashboard/links"],
    apiPrefixes: ["/api/links"],
  },
  {
    id: "bio",
    publicSummary: "Bio pages: one shareable page with all your important links.",
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
    whenOff: "বন্ধ করলে ব্যবহারকারীর এডিটর (ড্যাশবোর্ড) বন্ধ হয়। যে পাবলিক বায়ো পেজ আগেই চালু আছে সেগুলো দেখা যেতে থাকে — একটি নির্দিষ্ট পেজ নামাতে Admin > Bio pages-এর \"Take down\" ব্যবহার করুন।",
    userHref: "/dashboard/bio",
    adminHref: "/admin/bio",
    pagePrefixes: ["/dashboard/bio"],
    apiPrefixes: ["/api/bio"],
  },
  {
    id: "domains",
    publicSummary: "Custom domains: run your short links on your own domain.",
    flagKey: "feature_tool_domains",
    label: "Custom domains",
    group: "Link tools",
    what: "ব্যবহারকারী নিজের ডোমেইন (যেমন go.তার-সাইট.com) যুক্ত করে তাতে নিজের ছোট লিংক চালায়।",
    why: "ব্র্যান্ডেড লিংক বেশি বিশ্বাসযোগ্য দেখায় এবং ক্লিক রেট বাড়ায়।",
    steps: [
      "Dashboard > Custom domains > Add domain",
      "সিস্টেমের দেওয়া TXT ও CNAME রেকর্ড ডোমেইনের DNS-এ বসান",
      "\"Check again\" চাপুন; Active হলে ছোট লিংক ঐ ডোমেইনেও চলে (TXT রেকর্ডটি মুছবেন না: প্রতিদিন মালিকানা আবার দেখা হয়)",
    ],
    adminNotes: [
      "Vercel টোকেন (env) দিলে স্বয়ংক্রিয়, না দিলে ম্যানুয়াল মোড: আপনি Vercel-এ ডোমেইন যোগ করে Admin > Custom domains-এ \"Mark active\" চাপবেন।",
      "দৈনিক `run-tasks` ক্রন প্রতিটি Verified/Active ডোমেইনের মালিকানা আবার দেখে: TXT রেকর্ড আছে অথবা ডোমেইন এখনো আমাদের হোস্টিংয়ে পয়েন্ট করছে — যেকোনো একটি থাকলেই পাস। দুটোই না পেলে মালিক প্রথম দিন সতর্কতা-ইমেইল পান; টানা ৩ দিন না পেলে ডোমেইন Pending-এ ফিরে যায় (রিডাইরেক্ট বন্ধ, মালিককে ইমেইল) এবং অন্য কেউ আবার দাবি করতে পারে। DNS সার্ভার সাড়া না দিলে সেটি ব্যর্থতা গোনা হয় না। (এর জন্য SQL 071 লাগে।)",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী নতুন ডোমেইন যোগ বা যাচাই করতে পারে না। আগে থেকে সক্রিয় ডোমেইনের রিডাইরেক্ট চলতেই থাকে।",
    userHref: "/dashboard/domains",
    adminHref: "/admin/domains",
    pagePrefixes: ["/dashboard/domains"],
    apiPrefixes: ["/api/domains"],
  },
  {
    id: "api_keys",
    publicSummary: "API keys: create short links from your own software.",
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
    adminNotes: [
      "কী ব্যবহারকারী নিজে বাতিল করতে পারে। অপব্যবহার হলে আপনিও Admin > API keys থেকে যেকোনো কী Revoke করতে পারেন (কী সঙ্গে সঙ্গে অকেজো হয়, মালিক ইমেইল পান)।",
      "কী-এর আসল মান জমা থাকে না (শুধু হ্যাশ), তাই অ্যাডমিনও মান দেখতে পায় না; শুধু প্রথম কয়েকটি অক্ষর, মালিক, ক্ষমতা ও শেষ ব্যবহার দেখা যায়।",
    ],
    whenOff: "বন্ধ করলে ব্যবহারকারী নতুন কী বানাতে বা পরিচালনা করতে পারে না। আগের কীগুলো দিয়ে /api/v1 চলতেই থাকে (সেটি এই সুইচের বাইরে)।",
    userHref: "/dashboard/api-keys",
    adminHref: "/admin/api-keys",
    pagePrefixes: ["/dashboard/api-keys"],
    apiPrefixes: ["/api/api-keys"],
  },
  {
    id: "matches",
    flagKey: "feature_tool_matches",
    label: "Exchange matches",
    group: "Marketplace extras",
    publicSummary: "Exchange matches: propose a link swap with another listed site; the other owner can accept, counter or decline, and an accepted swap becomes two linked orders.",
    what: "ব্যবহারকারী তার অনুমোদিত সাইটের জন্য \"এক্সচেঞ্জ গ্রহণকারী\" অন্য সাইটের মালিককে লিংক-বিনিময়ের প্রস্তাব পাঠায়। অন্য মালিক গ্রহণ, পাল্টা প্রস্তাব বা প্রত্যাখ্যান করতে পারেন। গৃহীত হলে দুই দিকের জন্য দুটি পরস্পর-সংযুক্ত অর্ডার তৈরি হয় (এক্সচেঞ্জ-টাইপ; ওয়ালেটের টাকা নড়ে না)।",
    why: "টাকা খরচ না করে নিজের সাইটের জন্য লিংক পাওয়ার উপায়। দুই পক্ষই অর্ডার হিসেবে ডেডলাইনসহ কাজ করে, তাই বিনিময় এলোমেলো কথাবার্তায় হারিয়ে যায় না।",
    steps: [
      "Dashboard > My sites > কোনো অনুমোদিত সাইটের \"Find exchange partners\"",
      "মানানসই সাইট বেছে \"Propose exchange\" চাপুন; শুধু নিজের সাইটের কোন পেজে লিংক চান ও অ্যাঙ্কার টেক্সট লিখুন",
      "অন্য মালিক Dashboard > Exchange matches থেকে প্রস্তাব দেখে নিজের সাইটের যে পেজে লিংক নিতে চান সেটি লিখে Accept করেন (অথবা Counter-offer / Decline)",
      "Accept হলে দুটি অর্ডার তৈরি হয়; দুই পক্ষ নিজের সাইটে লিংক বসিয়ে অর্ডারের ধাপ এগোয়",
    ],
    adminNotes: [
      "প্রস্তাবক শুধু নিজের সাইটের পেজ দেয়; অন্য সাইটের কোন পেজ হবে তা সেই সাইটের মালিক Accept বা Counter-এর সময় ঠিক করেন। দুই দিকেই পেজের ঠিকানা অবশ্যই ওই সাইটের তালিকাভুক্ত ডোমেইনের ভেতরের হতে হয়।",
      "গ্রহণের আগে অন্য পক্ষের ডোমেইন ও পেজের ঠিকানা মাস্ক করা দেখায় (ex****.com); গ্রহণের পর দুজনেই আসল ঠিকানা দেখে।",
      "সাইটে \"accepts exchange\" টিক না থাকলে সেটি প্রস্তাবের তালিকায় আসে না।",
      "এই সুইচ শুধু প্রস্তাব পাঠানো ও সাড়া দেওয়া বন্ধ করে। গৃহীত বিনিময়ের অর্ডার ও চ্যাট (মার্কেটপ্লেসের মূল অংশ) আগের মতো চলে।",
    ],
    whenOff: "বন্ধ করলে নতুন প্রস্তাব পাঠানো ও খোলা প্রস্তাবে সাড়া দেওয়া যায় না (খোলা প্রস্তাব মোছে না, অপেক্ষায় থাকে); সাইডবার ও \"Find exchange partners\" লিংক সরে যায়। আগে গৃহীত বিনিময়ের অর্ডারগুলো অর্ডার পেজে আগের মতোই চলে।",
    userHref: "/dashboard/matches",
    adminHref: null,
    pagePrefixes: ["/dashboard/matches"],
    pagePatterns: [/^\/dashboard\/sites\/[^/]+\/matches$/],
    apiPrefixes: ["/api/matches"],
  },
  {
    id: "scan_site",
    flagKey: "feature_tool_scan_site",
    label: "Scan my site",
    group: "Marketplace extras",
    publicSummary: "Scan my site: enter your website address and see which listed sites match its niche, with an optional wallet-paid bulk order.",
    what: "ক্রেতা নিজের সাইটের ঠিকানা দিলে সিস্টেম পেজটি পড়ে কিওয়ার্ড মিলিয়ে niche ধরে (দুর্বল হলে চালু থাকা AI প্রোভাইডারের সাহায্যও নেয়) এবং মার্কেটপ্লেসের কোন অনুমোদিত লিস্টিংগুলো সবচেয়ে মানানসই তা দেখায়। চাইলে বাজেট ও সর্বোচ্চ সাইট-সংখ্যা দিয়ে ওয়ালেট থেকে স্বয়ংক্রিয় বাল্ক-অর্ডারও দিতে পারে।",
    why: "নতুন ক্রেতা জানে না কোথা থেকে লিংক কিনবে। স্ক্যান তার সাইটের বিষয় অনুযায়ী তালিকা বেছে দেয়, ফলে ব্রাউজ করার সময় বাঁচে ও ভুল niche-এর সাইট কেনার ঝুঁকি কমে।",
    steps: [
      "Dashboard > Scan my site for links",
      "সাইটের ঠিকানা (https://…) দিন; niche ভুল ধরা পড়লে তালিকা থেকে নিজে বেছে নিন",
      "ফলাফলের তালিকা দেখে পছন্দের সাইটে নিজে অর্ডার করুন",
      "চাইলে \"auto order\" চালু করে লিংকের ঠিকানা, অ্যাঙ্কার, বাজেট ও সর্বোচ্চ সাইট-সংখ্যা দিন; টাকা শুধু ওয়ালেট থেকে কাটে",
      "Scan history-তে সর্বশেষ ১০টি স্ক্যান থাকে; আরও ১০টি আলাদা করে সংরক্ষণ (Save) করা যায়",
    ],
    adminNotes: [
      "প্রতি ক্রেতা ঘণ্টায় সর্বোচ্চ ৫টি স্ক্যান করতে পারে (প্রতিটি স্ক্যানে কয়েকটি বাইরের পেজ পড়া হয়)।",
      "স্বয়ংক্রিয় অর্ডার শুধু ওয়ালেট ব্যালেন্স থেকে। ব্যালেন্স কম হলে যেগুলো পারে সেগুলো অর্ডার হয়, বাকিগুলো বাদ যায়; bKash/PayPal থেকে নিজে থেকে কিছু কাটে না।",
      "AI-সহায়তা শুধু তখনই চলে যখন Admin > API Providers-এ একটি AI প্রোভাইডার চালু থাকে; না থাকলে কেবল কিওয়ার্ড-মিল ব্যবহার হয়।",
    ],
    whenOff: "বন্ধ করলে স্ক্যান পেজ, স্ক্যান হিস্টরি ও এর API ব্যবহারকারীদের জন্য বন্ধ হয়। আগের সংরক্ষিত স্ক্যান মোছে না; ওয়ালেট ও চলমান অর্ডার প্রভাবিত হয় না; Browse ও Browse থেকে বাল্ক-অর্ডার আগের মতো চলে।",
    userHref: "/dashboard/scan-site",
    adminHref: null,
    pagePrefixes: ["/dashboard/scan-site"],
    apiPrefixes: ["/api/buyer-scan"],
  },
  {
    id: "watchlist",
    flagKey: "feature_tool_watchlist",
    label: "Watchlist",
    group: "Marketplace extras",
    publicSummary: "Watchlist: keep the listed sites you like in one place and get an email when the price of one of them drops.",
    what: "ক্রেতা Browse-এ কোনো সাইটের \"Watch\" বোতাম চেপে সাইটটি নিজের ওয়াচলিস্টে রাখে। রাখার সময়ের দাম মনে রাখা হয়; পরে দাম কমলে ইমেইল যায়।",
    why: "পছন্দের সাইট হারিয়ে যায় না, আর দাম কমলে ক্রেতা নিজে থেকে জানতে পারে, ফলে ফিরে এসে কেনার সম্ভাবনা বাড়ে।",
    steps: [
      "Browse বা সাইটের পেজে \"Watch\" বোতাম চাপুন",
      "Dashboard > Watchlist-এ সব দেখুন; আনলক না করা পর্যন্ত ডোমেইন মাস্ক করা থাকে",
      "দাম কমলে ইমেইল আসে; সেই কমা দামটি পরের তুলনার নতুন ভিত্তি হয়",
    ],
    adminNotes: [
      "দাম-কমার ইমেইল দৈনিক `search-alerts` ক্রনের সাথে যায় (Admin > Operations > Scheduled jobs-এ দেখুন)। সুইচ বন্ধ থাকলে এই ইমেইল যায় না।",
      "ইমেইল পাঠাতে Resend সেটআপ দরকার (Admin > Operations > Email)।",
      "ওয়াচলিস্টেও ডোমেইন-মাস্কিংয়ের নিয়ম বহাল: নিজের বা আনলক-করা সাইট ছাড়া ডোমেইন মাস্ক থাকে।",
    ],
    whenOff: "বন্ধ করলে Watch বোতাম ও ওয়াচলিস্ট পেজ লুকায়, API বন্ধ হয় ও দাম-কমার ইমেইল থামে। ব্যবহারকারীর রাখা তালিকা মোছে না; আবার চালু করলে আগের মতো ফিরে আসে।",
    userHref: "/dashboard/watchlist",
    adminHref: null,
    pagePrefixes: ["/dashboard/watchlist"],
    apiPrefixes: ["/api/watchlist"],
  },
  {
    id: "saved_searches",
    flagKey: "feature_tool_saved_searches",
    label: "Saved searches",
    group: "Marketplace extras",
    publicSummary: "Saved searches: save your Browse filters and get an email when a newly approved site matches them.",
    what: "ক্রেতা Browse-এ ফিল্টার (niche, DA-র সীমা, সর্বোচ্চ দাম, লিংক-টাইপ, শুধু-এক্সচেঞ্জ) বেছে \"Save search\" করে। নতুন অনুমোদিত সাইট ফিল্টারের সাথে মিললে ইমেইল পায়।",
    why: "নতুন লিস্টিং আসার জন্য প্রতিদিন Browse খুলে বসে থাকতে হয় না; মানানসই সাইট এলে ক্রেতাকেই জানানো হয়।",
    steps: [
      "Browse-এ ফিল্টার বেছে \"Save search\" চাপুন",
      "Dashboard > Saved searches-এ তালিকা দেখুন; দরকার না হলে মুছুন",
      "নতুন সাইট মিললে ইমেইল আসে",
    ],
    adminNotes: [
      "ইমেইল যায় দৈনিক `search-alerts` ক্রন (নতুন সাইট) ও সাপ্তাহিক `weekly-digest` ক্রন (শুক্রবার, সারসংক্ষেপ) দিয়ে। সুইচ বন্ধ থাকলে দুটোই এই ইমেইল পাঠানো বন্ধ রাখে।",
      "ইমেইল পাঠাতে Resend সেটআপ দরকার (Admin > Operations > Email)।",
    ],
    whenOff: "বন্ধ করলে \"Save search\" বোতাম ও Saved searches পেজ লুকায়, API বন্ধ হয় এবং নতুন-সাইট ইমেইল (দৈনিক ও সাপ্তাহিক) থামে। ব্যবহারকারীর সংরক্ষিত সার্চ মোছে না।",
    userHref: "/dashboard/saved-searches",
    adminHref: null,
    pagePrefixes: ["/dashboard/saved-searches"],
    apiPrefixes: ["/api/saved-searches"],
  },
  {
    id: "press_releases",
    flagKey: "feature_tool_press_releases",
    label: "Press releases",
    group: "Marketplace extras",
    publicSummary: "Press releases: order press-release distribution packages and follow each order from review to delivery.",
    what: "ক্রেতা /press-releases পেজে প্যাকেজ বেছে হেডলাইন, সারাংশ ও লিংক দিয়ে প্রেস রিলিজ অর্ডার করে, আর Dashboard > Press releases-এ রিভিউ-লেখা-বিতরণের অগ্রগতি দেখে। সেবাটি ম্যানুয়াল: আপনি অ্যাডমিন থেকে অর্ডার এগিয়ে নেন।",
    why: "ব্যাকলিংকের বাইরে আরেকটি আয়ের পথ; প্যাকেজ, দাম ও ডেলিভারির সময় স্পষ্ট থাকে, ক্রেতা প্রতিটি ধাপ দেখতে পায়।",
    steps: [
      "/press-releases খুলে প্যাকেজ বাছুন, হেডলাইন-সারাংশ-লিংক দিয়ে অর্ডার করুন",
      "Dashboard > Press releases-এ স্ট্যাটাস দেখুন; প্রতিটি স্ট্যাটাস বদলে ইমেইল যায়",
      "ডেলিভারি হলে প্রকাশিত লিংক অর্ডারে দেখা যায়",
    ],
    adminNotes: [
      "Admin > Press releases-এ প্যাকেজ ও দাম, অর্ডার-কিউ, সরবরাহকারী ও খরচ, ডেলিভারি লিংক ও প্রত্যাশিত তারিখ আছে।",
      "অনলাইন পেমেন্ট নেই; টাকা আলাদাভাবে নেওয়া হয়। Cancelled করলে ফেরত আপনাকে আলাদা মেটাতে হয়।",
      "এই সুইচ শুধু ব্যবহারকারীর দিক বন্ধ করে; অ্যাডমিন পেজে চলমান অর্ডার আপনি চালিয়ে যেতে পারবেন।",
    ],
    whenOff: "বন্ধ করলে পাবলিক /press-releases পেজে অর্ডার ফর্মের জায়গায় \"এখন অর্ডার নেওয়া হচ্ছে না\" বার্তা আসে, নতুন অর্ডারের API বন্ধ হয় ও Dashboard পেজ লুকায়। আগের অর্ডার মোছে না।",
    userHref: "/dashboard/press-releases",
    adminHref: "/admin/press-releases",
    pagePrefixes: ["/dashboard/press-releases"],
    apiPrefixes: ["/api/press-releases"],
  },
  {
    id: "referrals",
    flagKey: "feature_tool_referrals",
    label: "Referrals",
    group: "Marketplace extras",
    publicSummary: "Referrals: share your personal link and earn a share of LinkLazy's commission when people you refer complete paid orders.",
    what: "প্রতিটি ব্যবহারকারীর নিজস্ব রেফারেল লিংক আছে। কেউ সেই লিংকে সাইন-আপ করে পেইড অর্ডার সম্পন্ন করলে LinkLazy-র কমিশনের একটি অংশ রেফারারের অ্যাকাউন্টে জমা হয় (ব্যবহারকারীর পেজে বর্তমানে \"৫০%\" লেখা আছে)।",
    why: "খরচ ছাড়াই নতুন ব্যবহারকারী আনার উপায়: যারা আনে তারা আয় করে, আর আয় আসে কেবল সম্পন্ন পেইড অর্ডার থেকে।",
    steps: [
      "Dashboard > Referrals থেকে নিজের লিংক কপি করুন",
      "বন্ধুকে লিংকে সাইন-আপ করতে বলুন",
      "সে পেইড অর্ডার সম্পন্ন করলে ক্রেডিট স্বয়ংক্রিয়ভাবে জমা হয়; পেজে তালিকা দেখা যায়",
    ],
    adminNotes: [
      "ক্রেডিট গোনা ও টাকা নড়ার কোড (ওয়ালেট/ডাটাবেস-ফাংশন) এই সুইচে বদলায় না: যারা আগে থেকেই কারও রেফারেলে যুক্ত, তাদের অর্ডার থেকে আয় ও জমা-ক্রেডিট আগের মতোই থাকে।",
      "সুইচ বন্ধ থাকলে সাইন-আপের সময় নতুন কাউকে রেফারার হিসেবে যুক্ত করা হয় না (`/api/referral/resolve` কিছু ধরে না)।",
    ],
    whenOff: "বন্ধ করলে Referrals পেজ লুকায়, নতুন সাইন-আপে রেফারেল-সংযোগ হয় না, পাবলিক /referrals পেজে \"এখন বন্ধ\" বার্তা আসে। আগে জমা ক্রেডিট ও আগে থেকে যুক্ত রেফারেল-সম্পর্ক অপরিবর্তিত থাকে।",
    userHref: "/dashboard/referrals",
    adminHref: null,
    pagePrefixes: ["/dashboard/referrals"],
    apiPrefixes: ["/api/referral"],
  },
  {
    id: "public_tools",
    flagKey: "feature_public_tools",
    surface: "public",
    label: "Free tools",
    group: "Public tools",
    publicSummary: "Free tools: check a site's Domain Rating, compare backlink prices with live LinkLazy listings, build UTM links and make QR codes.",
    what: "সবার জন্য খোলা চারটি ফ্রি টুল (/tools): ডোমেইনের DR চেক, লাইভ লিস্টিংয়ের দামের সাথে ব্যাকলিংক-দামের তুলনা, UTM লিংক বানানো ও QR কোড বানানো। লগইন লাগে না।",
    why: "সার্চ-ইঞ্জিন থেকে নতুন মানুষ টানার সবচেয়ে সহজ উপায়: কাজের ফ্রি টুল দিলে মানুষ নিজে আসে, আর তারপর LinkLazy-র মার্কেটপ্লেসের কথা জানে।",
    steps: [
      "ভিজিটর /tools খুলে একটি টুল বাছে",
      "DR চেকারে ডোমেইন লিখলে সংখ্যা পায় (প্রতি ঘণ্টায় ৬টি, দিনে ২০টি পর্যন্ত)",
      "প্রাইস-চেকে DR লিখলে LinkLazy-র আসল তালিকার দাম-পরিসীমা দেখে; UTM ও QR ব্রাউজারেই তৈরি হয়",
    ],
    adminNotes: [
      "DR চেকার Vercel env-এর AHREFS_API_KEY ব্যবহার করে; না থাকলে টুলটি \"unavailable\" দেখায়। সাইট-জুড়ে দিনে সর্বোচ্চ ৩০০টি DR চেক (কোটা বাঁচাতে)। আপনি Ahrefs-এর API শর্ত (পাবলিক টুলে ব্যবহার) নিজে যাচাই করে নেবেন।",
      "প্রাইস-চেক শুধু আপনার আসল অনুমোদিত লিস্টিং থেকে হিসাব করে এবং ৫টির কম লিস্টিং থাকলে সংখ্যা দেখায় না (\"যথেষ্ট ডেটা নেই\")। কোনো বানানো দাম নেই।",
      "প্রতিটি ভিজিটরের জন্য IP-ভিত্তিক সীমা আছে (ডাটাবেসে গোনা হয়)।",
    ],
    whenOff: "বন্ধ করলে /tools ও তার API ভিজিটরদের জন্য \"switched off\" দেখায়; কোনো ডেটা মোছে না।",
    userHref: "/tools",
    adminHref: null,
    pagePrefixes: ["/tools"],
    apiPrefixes: ["/api/tools"],
  },
  {
    id: "public_recommendations",
    flagKey: "feature_public_recommendations",
    surface: "public",
    label: "Recommendations",
    group: "Public tools",
    publicSummary: "Recommendations: paste your website address and see listed sites in the same niche, with DR and price.",
    what: "সবার জন্য খোলা ফর্ম (/recommendations): সাইটের ঠিকানা দিলে সিস্টেম পেজটি পড়ে niche ধরে এবং একই niche-এর সেরা ৫টি লিস্টিং দেখায় (DR, দাম, সময়)। লগইন লাগে না।",
    why: "নতুন ক্রেতাকে প্ল্যাটফর্মে ঢোকার আগেই দেখিয়ে দেয় তার সাইটের জন্য কী কী পাওয়া যাবে; এরপর অ্যাকাউন্ট খুলে পুরো স্ক্যান ও অর্ডার করতে হয়।",
    steps: [
      "ভিজিটর /recommendations খুলে নিজের সাইটের ঠিকানা লিখে \"Find sites\" চাপে",
      "niche ধরা না গেলে নিজে তালিকা থেকে niche বাছে",
      "ফলাফলে ৫টি লিস্টিংয়ের লিংক পায়; পুরো তালিকা ও অর্ডারের জন্য অ্যাকাউন্ট খুলতে বলা হয়",
    ],
    adminNotes: [
      "পাবলিক সংস্করণে AI ব্যবহার হয় না ও অন্য সাইট স্ক্যান হয় না (শুধু ভিজিটরের দেওয়া পেজটি একবার পড়া হয়); তাই খরচ নেই। লগইন-করা ক্রেতার পূর্ণ স্ক্যান (Dashboard > Scan site) আলাদা।",
      "প্রতি ভিজিটর ঘণ্টায় ৩টি, দিনে ১০টি; সাইট-জুড়ে দিনে ২০০টি। অন্যের সাইট পড়ার আগে SSRF-নিরাপদ fetch ব্যবহার হয় (ভেতরের/ব্যক্তিগত ঠিকানা আটকানো)।",
      "ফলাফলে ডোমেইন দেখানো হয় না, কেবল /browse-এ যা আগে থেকে পাবলিক (niche, DR, দাম)।",
    ],
    whenOff: "বন্ধ করলে /recommendations ও তার API ভিজিটরদের জন্য \"switched off\" দেখায়।",
    userHref: "/recommendations",
    adminHref: null,
    pagePrefixes: ["/recommendations"],
    apiPrefixes: ["/api/recommendations"],
  },
];

export const TOOL_FLAG_KEYS: string[] = TOOLS.map((t) => t.flagKey);
export const toolById = (id: string): ToolInfo | undefined => TOOLS.find((t) => t.id === id);
export const toolByFlagKey = (key: string): ToolInfo | undefined => TOOLS.find((t) => t.flagKey === key);

const matchesPrefix = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

/** Which tool a request path belongs to, and whether it is one of its pages or its API. Null for everything else. */
export function toolForPath(path: string): { tool: ToolInfo; surface: "page" | "api" } | null {
  for (const tool of TOOLS) {
    if (tool.pagePrefixes.some((p) => matchesPrefix(path, p)) || tool.pagePatterns?.some((re) => re.test(path))) return { tool, surface: "page" };
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
