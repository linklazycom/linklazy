/**
 * The user-facing tools an admin can switch on and off (Batch 16C). Pure: used by the admin Features page, the sidebar,
 * and the request gate in proxy middleware. Each tool has ONE switch (a site_settings key). The four older switches keep
 * their original keys so nothing already saved changes.
 *
 * Switched off means: hidden from the sidebar, its pages and its API refuse ordinary users, admins can still open it to test.
 * It never deletes anything the users saved. Marketplace essentials (browse, orders, wallet, support, messages) are NOT
 * switchable here on purpose.
 */
export type ToolGroup = "SEO workspace" | "Link tools" | "Public tools";

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
      "\"Check again\" চাপুন; Active হলে ছোট লিংক ঐ ডোমেইনেও চলে",
    ],
    adminNotes: [
      "Vercel টোকেন (env) দিলে স্বয়ংক্রিয়, না দিলে ম্যানুয়াল মোড: আপনি Vercel-এ ডোমেইন যোগ করে Admin > Custom domains-এ \"Mark active\" চাপবেন।",
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
    adminNotes: ["কী ব্যবহারকারী নিজে বাতিল করতে পারে।"],
    whenOff: "বন্ধ করলে ব্যবহারকারী নতুন কী বানাতে বা পরিচালনা করতে পারে না। আগের কীগুলো দিয়ে /api/v1 চলতেই থাকে (সেটি এই সুইচের বাইরে)।",
    userHref: "/dashboard/api-keys",
    adminHref: null,
    pagePrefixes: ["/dashboard/api-keys"],
    apiPrefixes: ["/api/api-keys"],
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
