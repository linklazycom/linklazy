-- =========================================================
-- LINKLAZY — BLOG SEED CONTENT
-- Run this AFTER schema.sql and supabase-migration-2.sql.
-- Creates one silo ("Link Building Guides") and 5 starter articles
-- targeting low-competition, long-tail keywords relevant to a
-- backlink-exchange marketplace audience.
-- =========================================================

insert into public.silos (slug, title, description)
values ('link-building-guides', 'Link Building Guides', 'Practical, no-fluff guides on backlinks, site vetting, and link exchange.')
on conflict (slug) do nothing;

-- Fetch the silo id for the inserts below.
do $$
declare
  v_silo_id uuid;
begin
  select id into v_silo_id from public.silos where slug = 'link-building-guides';

  insert into public.articles (silo_id, slug, title, meta_description, target_keyword, status, content, published_at)
  values
  (
    v_silo_id,
    'how-to-vet-a-backlink-site-before-buying',
    'How to Vet a Backlink Site Before Buying a Link',
    'A practical checklist for evaluating a site''s metrics, traffic, and ownership before you pay for a backlink.',
    'how to vet a backlink site before buying',
    'published',
    $md$## Why vetting matters more than the price tag

A cheap link from the wrong site can do more harm than good. Before you pay for placement, run through this checklist.

## 1. Check the core metrics — but don't stop there

Domain Authority (DA), Domain Rating (DR), and referring domains are a starting point, not the full picture. A site can have a high DA and still carry almost no real traffic or topical relevance.

## 2. Confirm real, current traffic

Ask for a recent traffic screenshot from Google Analytics or Search Console, or check third-party estimates. A site that hasn't been updated in a year, despite a decent DA, is a red flag — its authority may be inherited from old content that no longer represents an active audience.

## 3. Verify ownership

Anyone can list a URL. On a marketplace like LinkLazy, sites go through an ownership check (meta tag, DNS record, or file upload) before they're approved — so the person listing the site actually controls it.

## 4. Look at niche relevance

A backlink from a site in your niche carries more weight than a generic, unrelated one. Search engines factor in topical relevance, not just authority.

## 5. Review the outbound link profile

If a homepage links out to fifty unrelated sites, that's a sign of a link farm. A healthy site links out selectively, usually within relevant content.

## 6. Check spam score and outbound link density

A high spam score, thin content, or a page stuffed with outbound links are all signs to walk away.

## The takeaway

Metrics are a filter, not a guarantee. Combine the numbers with a manual look at the site itself before committing.
$md$,
    now() - interval '20 days'
  ),
  (
    v_silo_id,
    'dofollow-vs-nofollow-backlinks-explained',
    'Dofollow vs Nofollow Backlinks: What Actually Matters',
    'A plain-language breakdown of the difference between dofollow and nofollow links, and when each one is useful.',
    'dofollow vs nofollow backlinks explained',
    'published',
    $md$## The short version

A dofollow link passes SEO authority ("link equity") from the linking page to your site. A nofollow link tells search engines not to pass that authority — historically used for sponsored content, comments, and untrusted sources.

## Why nofollow links still matter

Even without direct authority, nofollow links can:

- Send real referral traffic
- Build brand visibility and diversify your backlink profile
- Look more natural — an all-dofollow profile can actually look suspicious to search engines

## When to prioritize dofollow

If your main goal is improving rankings for a specific page, dofollow links from relevant, reputable sites carry more direct SEO weight.

## A balanced profile is safer

Sites with an unnaturally high ratio of dofollow links, especially from unrelated niches, can draw scrutiny. A mix of both link types, built gradually, tends to perform better long-term than an aggressive dofollow-only strategy.

## How this applies to link exchange

When browsing listings, check the link type each site offers — LinkLazy shows this upfront on every listing so you're not guessing.
$md$,
    now() - interval '16 days'
  ),
  (
    v_silo_id,
    'link-exchange-vs-guest-posting',
    'Link Exchange vs Guest Posting: Which Builds Links Faster',
    'Comparing the effort, cost, and long-term value of link exchanges against traditional guest posting.',
    'link exchange vs guest posting which is better',
    'published',
    $md$## Two different paths to the same goal

Both link exchange and guest posting aim to get your site linked from another relevant, authoritative domain — but they differ in cost, effort, and risk.

## Guest posting

You write (or commission) a full article for another site in exchange for a link, usually in an author bio or naturally within the content.

**Pros:** Often seen as more "editorial" and natural by search engines. Can also build brand exposure to a new audience.

**Cons:** Time-intensive — writing, pitching, and waiting on editorial approval can take weeks per link.

## Link exchange

You and another site owner agree to link to each other, or one side pays instead of reciprocating with a link.

**Pros:** Faster to arrange, especially on a marketplace with vetted listings. Can be scaled across multiple sites in less time.

**Cons:** Reciprocal (two-way) exchanges are more visible to search engines than one-way links, so they're best used as part of a broader, varied strategy — not the only tactic.

## A practical middle ground

Many sites use both: guest posts for high-authority, editorial-style links, and exchanges (or paid placements) to fill out a broader, more natural-looking backlink profile at a faster pace.

## What to look for either way

Regardless of method, the fundamentals stay the same: real traffic, topical relevance, and a clean link profile on the site you're getting a link from.
$md$,
    now() - interval '12 days'
  ),
  (
    v_silo_id,
    'how-to-check-domain-authority-for-free',
    'How to Check Domain Authority for Free (No Paid Tools Needed)',
    'Several no-cost ways to estimate a site''s Domain Authority and Domain Rating before you commit to a link deal.',
    'how to check domain authority for free',
    'published',
    $md$## You don't need a paid subscription to get a rough estimate

Domain Authority (DA) is a Moz metric, and Domain Rating (DR) is Ahrefs' equivalent — both are proprietary scores, but you have a few free ways to check them.

## 1. Free browser extensions

Moz's MozBar and similar extensions show DA/PA directly in your browser as you visit a site, without a paid account.

## 2. Limited free lookups on the tool websites

Both Moz and Ahrefs offer a small number of free checks per day directly on their websites — enough for the occasional one-off lookup.

## 3. Ask the seller for a screenshot

On a marketplace, a legitimate seller should be able to provide a current screenshot of their metrics dashboard. Cross-check this against your own free lookup if the numbers seem inflated.

## 4. Use marketplace-verified metrics

Platforms like LinkLazy record metrics at listing time and re-verify them periodically, which saves you from manually checking every site yourself.

## A word of caution

DA and DR are estimates, not official Google rankings signals. Use them as a directional filter, not the only factor in your decision — traffic and niche relevance matter just as much.
$md$,
    now() - interval '8 days'
  ),
  (
    v_silo_id,
    'signs-of-a-spammy-backlink-site',
    '7 Warning Signs of a Spammy Backlink Site',
    'How to spot low-quality or spammy sites before you exchange or pay for a backlink from them.',
    'signs of a spammy backlink site',
    'published',
    $md$## Not every site with a decent DA is worth a link from

Here are the warning signs worth checking before you commit.

## 1. Thin or auto-generated content

Pages with a few hundred words of generic, keyword-stuffed text — or content that reads like it was mass-produced — are a red flag.

## 2. An unnatural number of outbound links

If a single page links out to dozens of unrelated sites, it's likely functioning as a link farm rather than genuine editorial content.

## 3. Traffic that doesn't match the metrics

A high DA paired with almost no real, current traffic often means the authority is inherited from old backlinks rather than an active audience.

## 4. No clear niche focus

A site that covers everything from health to finance to gambling with no consistent theme is harder to trust and less valuable for topical relevance.

## 5. Recently expired or repurposed domains

Some sites are expired domains repurposed purely to sell links, with little to no original content of their own.

## 6. High spam score

Tools like Moz's Spam Score flag sites with patterns common among low-quality link networks — worth checking before you commit.

## 7. No verifiable ownership

If a seller can't confirm they actually control the site (via a meta tag, DNS record, or similar), that's a dealbreaker — it usually means the listing itself isn't trustworthy.

## The bottom line

A few of these signs alone might not disqualify a site, but two or more together are a strong signal to look elsewhere.
$md$,
    now() - interval '3 days'
  )
  on conflict (slug) do nothing;
end $$;
