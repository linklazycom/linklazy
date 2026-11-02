/**
 * Help texts for the signed-in dashboard (Batch 23A), shown by the "?" button at the top of every dashboard page and collected on the
 * public /help page. Plain English for members. Keys are path prefixes; "[id]" stands for one path segment; the longest match wins,
 * and "/dashboard" matches only the Overview itself. A page without an entry shows a polite "no help yet" note, so every new page
 * must add its entry here (a test checks every sidebar page).
 */
export interface UserHelpEntry {
  /** Section on the public Help page. */
  area: UserHelpArea;
  title: string;
  /** What this page is. */
  what: string;
  /** Why you would use it. */
  why: string;
  /** How to use it, in order. */
  how: string[];
  /** Things to watch out for. */
  watch?: string[];
}

export const USER_HELP_AREAS = ["Getting around", "Buying links", "Selling and exchanging", "SEO workspace", "Link tools", "Money and account"] as const;
export type UserHelpArea = (typeof USER_HELP_AREAS)[number];

export const USER_HELP: Record<string, UserHelpEntry> = {
  "/dashboard": {
    area: "Getting around",
    title: "Dashboard overview",
    what: "Your starting page: your wallet balance, orders that need action, your sites and shortcuts to the tools.",
    why: "It shows at a glance what needs your attention, so you do not have to open every page.",
    how: ["Check the cards at the top for anything marked as needing action", "Use the left menu to open a tool; on a phone, open the menu with the button at the top", "Use the search box at the top to find a site or a page quickly"],
    watch: ["Tools can be switched off by the site team; a switched-off tool disappears from the menu. Your saved work is not deleted."],
  },
  "/dashboard/browse": {
    area: "Buying links",
    title: "Browse sites",
    what: "The list of approved sites you can buy a link from or propose an exchange with, with niche, DA/DR, price and link type.",
    why: "It is where you find the right site for your backlink, and compare options before you spend anything.",
    how: ["Set the filters (niche, DA, maximum price, link type, exchange only) and press Filter", "Open a site to see its details, or tick several paid sites to order them together (bulk order)", "Use \"Save this search\" to get an email when a new site matches your filters", "Use Watch on a site you like to keep it in your Watchlist"],
    watch: ["Site addresses stay hidden (like ex****.com) until you unlock the listing or place an order."],
  },
  "/dashboard/browse/[id]": {
    area: "Buying links",
    title: "Site details",
    what: "Everything about one listing: metrics, price, link type, turnaround time, the seller's record and reviews, and the order form.",
    why: "You can judge a site and order from the same page.",
    how: ["Read the metrics, seller record and reviews", "If the seller allows it, unlock the listing to see the real address and guidelines (this costs wallet credit)", "Fill in the target page and anchor text and send the order, or ask the seller a question first"],
    watch: ["Orders are paid from your wallet balance. Top up first under Top up wallet if the balance is too low."],
  },
  "/dashboard/browse/bulk-order": {
    area: "Buying links",
    title: "Bulk order",
    what: "Review and place several paid orders at once. The same target page and anchor text are used for every site in the list.",
    why: "It saves time when you want the same link from many sites.",
    how: ["Tick sites on Browse (up to 10) and press the bulk order button", "Check the sites and the total, enter the target page and anchor text", "Confirm; sites you cannot afford or that are not available are skipped and listed"],
    watch: ["Bulk orders are paid placements from your wallet only. Nothing is charged to bKash or PayPal automatically."],
  },
  "/dashboard/scan-site": {
    area: "Buying links",
    title: "Scan my site for links",
    what: "Enter your website address. LinkLazy reads the page, works out its niche and shows which listed sites match it.",
    why: "If you do not know where to buy links, the scan gives you a shortlist for your niche.",
    how: ["Enter your site address (starting with https://)", "If the niche is wrong, pick the right one yourself", "Look through the matching sites and order the ones you like, or turn on automatic ordering with a budget and a maximum number of sites"],
    watch: ["You can run a limited number of scans per hour.", "Automatic orders use your wallet balance only. If the balance runs out, the remaining sites are skipped."],
  },
  "/dashboard/scan-site/history": {
    area: "Buying links",
    title: "Scan history",
    what: "Your recent site scans. The latest ones are kept automatically; you can pin a few you want to keep longer.",
    why: "You can come back to a shortlist without scanning again.",
    how: ["Open a scan to see its results", "Press Save on the ones you want to keep; saved scans are not removed when newer scans arrive", "Run a new scan from Scan my site"],
  },
  "/dashboard/watchlist": {
    area: "Buying links",
    title: "Watchlist",
    what: "The sites you pressed Watch on, in one place. LinkLazy remembers the price when you add a site.",
    why: "You do not lose sites you like, and you get an email if the price of one drops.",
    how: ["Press Watch on a site in Browse", "Open this page to see your list and jump to a site", "Press Watching again on a site to remove it"],
    watch: ["Site addresses stay hidden until you unlock the listing."],
  },
  "/dashboard/saved-searches": {
    area: "Buying links",
    title: "Saved searches",
    what: "Filters you saved from Browse. You get an email when a newly approved site matches one of them.",
    why: "You hear about new sites without checking Browse every day.",
    how: ["Set filters in Browse and press \"Save this search\"", "Open this page to see or delete your saved searches"],
  },
  "/dashboard/orders": {
    area: "Buying links",
    title: "Orders",
    what: "All your orders, as buyer and as seller: status, type, price and anchor text.",
    why: "It is the single place to follow every link from request to completion.",
    how: ["Open an order to see its steps and chat with the other side", "As a seller: review the request, then accept to start work, or reject if it does not fit", "When the link is live, the seller submits its address; the buyer checks it and confirms"],
    watch: ["Paid orders release money to the seller only after the buyer confirms."],
  },
  "/dashboard/orders/[id]": {
    area: "Buying links",
    title: "Order details",
    what: "One order: who it is with, the target page and anchor text, its steps, and the messages between buyer and seller.",
    why: "Everything about this link stays together, so nothing is lost in other chats.",
    how: ["Read the terms and the current step", "Use the chat for questions about this order", "Follow the buttons for your side: accept or reject, submit the live link, or confirm it"],
    watch: ["If something goes wrong, use the dispute option on the order rather than agreeing elsewhere."],
  },
  "/dashboard/inquiries": {
    area: "Buying links",
    title: "Pre-sale inquiries",
    what: "Questions asked to a seller before an order exists, and the replies.",
    why: "You can check details before you commit money.",
    how: ["Open a conversation to read or reply", "Once an order exists, continue in that order's chat"],
  },
  "/dashboard/press-releases": {
    area: "Buying links",
    title: "Press releases",
    what: "Your press release orders and how far each one has come: review, writing, distribution and delivery.",
    why: "You can follow an announcement from order to published links.",
    how: ["Choose a package and place an order on the Press releases page", "Come back here to see each status and the expected delivery date", "When an order is delivered, its published links are shown on the order"],
    watch: ["Every order is reviewed by a person before it is submitted."],
  },
  "/dashboard/sites": {
    area: "Selling and exchanging",
    title: "My sites",
    what: "The sites you listed, with status, metrics and price. From here you manage link slots, pay-per-view settings and exchange partners.",
    why: "It is your selling dashboard: it shows what is live, pending or needs attention.",
    how: ["Press List a site to add a new one", "Use Manage link slots to price different placements separately", "Use Find exchange partners on an approved site to propose a link swap"],
    watch: ["A site is visible to buyers only after ownership is verified and it is approved."],
  },
  "/dashboard/sites/new": {
    area: "Selling and exchanging",
    title: "List a site",
    what: "The form to add your site: address, niche, metrics, what you accept (exchange, paid, pay-per-view) and your price.",
    why: "A complete, honest listing gets approved faster and attracts better buyers.",
    how: ["Enter your site address and niche", "Fill in your metrics honestly and choose what you accept", "Submit, then verify ownership on the next page"],
    watch: ["Inflated numbers are caught at review and can get your account flagged."],
  },
  "/dashboard/sites/[id]/verify": {
    area: "Selling and exchanging",
    title: "Verify ownership",
    what: "A short check that you control the site: you add a tag to your homepage and LinkLazy looks for it.",
    why: "It protects buyers from fake listings and protects real owners from impersonation.",
    how: ["Copy the tag shown on the page", "Paste it inside the <head> section of your homepage and publish", "Press the check button"],
    watch: ["Keep the tag in place until the site is approved."],
  },
  "/dashboard/sites/[id]/slots": {
    area: "Selling and exchanging",
    title: "Link slots",
    what: "Separate placements buyers can order from one site, for example a homepage sidebar link and several in-content links, each with its own price.",
    why: "Different placements are worth different amounts, so you can price each one fairly.",
    how: ["Add a slot, choose the placement and price", "Edit or remove slots at any time"],
  },
  "/dashboard/sites/[id]/matches": {
    area: "Selling and exchanging",
    title: "Find exchange partners",
    what: "Suggested sites for a link swap, ordered by how close they are to your site in niche and DA.",
    why: "A swap costs no money and helps both sites.",
    how: ["Pick a suggested site and press Propose exchange", "Enter the page on YOUR site you want the other site to link to, and the anchor text", "The other owner chooses which of their pages you link to when they accept"],
    watch: ["The other site stays hidden until the exchange is accepted.", "The page must be on your own listed site."],
  },
  "/dashboard/matches": {
    area: "Selling and exchanging",
    title: "Exchange matches",
    what: "Your link-swap proposals, sent and received, with their status.",
    why: "It shows which proposals are waiting for your answer.",
    how: ["Open a proposal marked Action needed", "Accept, send a counter-offer or decline", "Accepted swaps become two linked orders under Orders"],
  },
  "/dashboard/matches/[id]": {
    area: "Selling and exchanging",
    title: "Exchange proposal",
    what: "One link-swap proposal: which page each side links to and the anchor texts.",
    why: "You can agree the details before any work starts.",
    how: ["If you are accepting a first proposal, choose the page on your own site that receives the link and press Accept", "Or send a counter-offer: you can change the page on your site and both anchor texts", "After acceptance, both addresses are shown and two orders are created"],
    watch: ["The other owner's site and page address stay hidden until acceptance.", "You cannot change the other owner's page."],
  },
  "/dashboard/analytics": {
    area: "Selling and exchanging",
    title: "My analytics",
    what: "How your listings performed in the last 30 days: page views and unlocks per listing.",
    why: "Many views but few unlocks usually means the metrics or the price need a second look.",
    how: ["Compare views and unlocks for each listing", "Adjust price or details on My sites if a listing gets views but no unlocks"],
  },
  "/dashboard/projects": {
    area: "SEO workspace",
    title: "Projects",
    what: "One project per website you promote, keeping its niche, keywords and competitors in one place.",
    why: "The other SEO tools use your project, so you do not retype the same details.",
    how: ["Press New project", "Enter the site address, niche and two or three keywords", "Pick the project in Opportunity Finder, Backlink monitor and AI Content Studio"],
    watch: ["There is a limit on how many projects you can have.", "If the LinkLazy team pauses a project you will see a Paused label. A paused project cannot run new searches, drafts or monitors, and cannot be deleted until it is restored; your saved data stays safe."],
  },
  "/dashboard/opportunities": {
    area: "SEO workspace",
    title: "Opportunity Finder",
    what: "Searches the web for places that may link to you: guest-post pages, directories, resource pages, communities and blogs, each with a score and the reasons.",
    why: "Finding who to contact is the slowest part of link building. This gives you a ready list.",
    how: ["Create a project first (with niche and keywords)", "Choose the project and the kinds of opportunities, then press Find opportunities", "Open Why this score? to see the reasons; mark each result Saved, Contacted, Done or Ignored", "Download the list as CSV if you want"],
    watch: ["Nothing is sent to anyone for you. You decide whom to contact.", "A high score is a hint, not a promise that the site will link to you."],
  },
  "/dashboard/backlinks": {
    area: "SEO workspace",
    title: "Backlink monitor",
    what: "Tracks pages that should link to you. Each one is checked every day and you see what the page's HTML shows.",
    why: "You find out when a link disappears, changes to nofollow or points somewhere else.",
    how: ["Add the page that should contain your link, with the address it should point to", "Or import many at once from a CSV", "Open an item to see its check history"],
    watch: ["The check reads the page's HTML. A link added later by JavaScript may not be seen."],
  },
  "/dashboard/content": {
    area: "SEO workspace",
    title: "AI Content Studio",
    what: "Drafts outreach emails, bios, article ideas, outlines, titles and more, based on your project.",
    why: "It gets you past the blank page; you then edit the draft into your own words.",
    how: ["Choose what you want to write and the project", "Press generate, then edit the draft", "Save the ones you want to keep"],
    watch: ["Nothing is posted or sent for you.", "Check facts and names in every draft before you use it."],
  },
  "/dashboard/links": {
    area: "Link tools",
    title: "Short links and QR codes",
    what: "Create short links with click statistics and QR codes, group them by tag or project, and import many from a CSV.",
    why: "Short, trackable links are easier to share and show which campaign works.",
    how: ["Press New link and paste the destination", "Share the short address or download its QR code", "Open a link to see its clicks"],
    watch: ["A short link's address cannot be changed after you create it, because printed QR codes and shared links would break."],
  },
  "/dashboard/bio": {
    area: "Link tools",
    title: "Bio pages",
    what: "One page that holds all your important links, at a short address you can put in any profile.",
    why: "You share one link instead of many.",
    how: ["Create a page and add your links", "Share its short address", "Open the page to see its views"],
  },
  "/dashboard/domains": {
    area: "Link tools",
    title: "Custom domains",
    what: "Use your own domain for short links, for example go.yourbrand.com/sale.",
    why: "Links on your own brand look more trustworthy.",
    how: ["Enter the domain or subdomain you want to use", "Step 1: prove you control it by adding the ownership (TXT) record shown, at your domain provider", "Step 2: point the domain to LinkLazy with the record shown, then check the status", "Once it is active, choose the domain when you create a short link"],
    watch: ["Keep the ownership (TXT) record in your DNS. We re-check ownership every day; if the record is missing and the domain no longer points to us for 3 days in a row, it goes back to pending and we email you.", "DNS changes can take a few minutes to appear.", "If your provider offers a proxy (for example Cloudflare's orange cloud), turn it off for these records."],
  },
  "/dashboard/api-keys": {
    area: "Link tools",
    title: "API keys",
    what: "Keys that let your own tools create short links and read click statistics.",
    why: "You can connect LinkLazy to your own scripts and apps.",
    how: ["Create a key and copy it straight away", "Send it with each request as described in the API documentation", "Delete a key you no longer use"],
    watch: ["A key is shown only once. Keep it secret.", "Each key has a limit on requests per minute."],
  },
  "/dashboard/messages": {
    area: "Money and account",
    title: "Messages",
    what: "The chats of your orders, newest first.",
    why: "Each order's conversation stays with that order.",
    how: ["Open a conversation to read or reply"],
  },
  "/dashboard/support": {
    area: "Money and account",
    title: "My tickets",
    what: "Your messages to the LinkLazy team and their replies.",
    why: "It is the way to get help with an account, order or payment.",
    how: ["Press New ticket and describe the problem", "Open a ticket to read replies or add details"],
    watch: ["Replying to a closed ticket reopens it."],
  },
  "/dashboard/referrals": {
    area: "Money and account",
    title: "Referrals",
    what: "Your personal referral link and the credits you have earned from people who joined through it.",
    why: "You earn a share of LinkLazy's commission when someone you referred completes a paid order.",
    how: ["Copy your link and share it", "When a referred member's paid order completes, the credit appears here automatically"],
  },
  "/dashboard/billing": {
    area: "Money and account",
    title: "Top up wallet",
    what: "Add money to your wallet. There are no subscriptions: joining is free, sellers pay a commission only on completed sales, and buyers pay only when they order or unlock a site.",
    why: "Orders and unlocks are paid from your wallet balance.",
    how: ["Choose bKash (charged in BDT) or PayPal (charged in USD at the platform exchange rate)", "Pick an amount or enter your own; any bonus offer for that amount is shown on the page", "Complete the payment; your balance is credited once it is confirmed"],
    watch: ["Bonus credit can be spent on orders but not withdrawn."],
  },
  "/dashboard/wallet": {
    area: "Money and account",
    title: "Wallet",
    what: "Your balance, bonus credit, pending earnings, referral credit, withdrawal requests and every transaction.",
    why: "You can see exactly where your money is and withdraw your earnings.",
    how: ["Read Balance and Pending earnings; pending money moves to your balance after the hold period", "Use Withdraw to request a payout of the available amount", "Check Transaction history for every movement"],
    watch: ["Bonus credit can be spent but not withdrawn."],
  },
  "/dashboard/profile": {
    area: "Money and account",
    title: "Profile",
    what: "Your account details, picture and password.",
    why: "Keep your details correct so payouts and support work smoothly.",
    how: ["Update your details and press Save", "Use Change password to set a new password"],
    watch: ["Your full name is private and used only for account and legal purposes."],
  },
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The key of the entry that fits a path: the most specific one. "/dashboard" matches only the Overview itself. */
export function pickUserHelpKey(path: string, keys: string[] = Object.keys(USER_HELP)): string | null {
  let best: string | null = null;
  for (const key of keys) {
    const hit = key === "/dashboard" ? path === "/dashboard" : new RegExp(`^${key.split("[id]").map(escape).join("[^/]+")}(/.*)?$`).test(path);
    if (hit && (best === null || key.length > best.length)) best = key;
  }
  return best;
}

export function userHelpForPath(path: string): { key: string; entry: UserHelpEntry } | null {
  const key = pickUserHelpKey(path);
  return key ? { key, entry: USER_HELP[key] } : null;
}
