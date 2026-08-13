// Predefined niche list — single source of truth, used by the site
// submission form (dropdown) and can be reused anywhere else a niche
// picker is needed. Keeping this as one exported array means adding a
// niche later is a one-line change, not a hunt across multiple files.
export const NICHES = [
  "Home & Garden",
  "Health & Wellness",
  "Finance & Investing",
  "Technology & Software",
  "Fashion & Beauty",
  "Food & Recipes",
  "Travel & Tourism",
  "Education & E-learning",
  "Business & Marketing",
  "Real Estate",
  "Automotive",
  "Parenting & Family",
  "Fitness & Sports",
  "Pets & Animals",
  "Legal Services",
  "Career & Jobs",
  "Gaming & Entertainment",
  "Home Improvement / DIY",
  "Sustainability & Green Living",
  "General Lifestyle",
] as const;
