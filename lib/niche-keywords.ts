import { NICHES } from "@/lib/niches";

/**
 * Keyword dictionary for free, keyword-based niche detection.
 * Keys must exactly match entries in NICHES (lib/niches.ts) — this is
 * enforced by the `satisfies` check below so a typo here fails at
 * build time instead of silently producing an undetectable niche.
 *
 * Keep lists lowercase; matching is done against lowercased page text.
 */
export const NICHE_KEYWORDS: Record<(typeof NICHES)[number], string[]> = {
  "Home & Garden": [
    "garden", "gardening", "home decor", "interior design", "houseplant",
    "landscaping", "patio", "backyard", "furniture", "home improvement",
  ],
  "Health & Wellness": [
    "health", "wellness", "nutrition", "mental health", "self care",
    "mindfulness", "supplement", "therapy", "healthy living", "wellbeing",
  ],
  "Finance & Investing": [
    "finance", "investing", "investment", "stock market", "personal finance",
    "budgeting", "cryptocurrency", "retirement", "savings", "loan", "credit score",
  ],
  "Technology & Software": [
    "software", "technology", "app", "saas", "programming", "coding",
    "artificial intelligence", "cybersecurity", "gadget", "tech review",
  ],
  "Fashion & Beauty": [
    "fashion", "beauty", "makeup", "skincare", "style", "outfit",
    "cosmetics", "haircare", "clothing", "trends",
  ],
  "Food & Recipes": [
    "recipe", "recipes", "cooking", "food", "baking", "meal", "cuisine",
    "ingredients", "kitchen", "dinner", "dessert",
  ],
  "Travel & Tourism": [
    "travel", "tourism", "vacation", "destination", "itinerary", "flight",
    "hotel", "backpacking", "trip", "traveler",
  ],
  "Education & E-learning": [
    "education", "e-learning", "online course", "learning", "tutorial",
    "study", "student", "curriculum", "elearning", "training",
  ],
  "Business & Marketing": [
    "marketing", "business", "entrepreneur", "startup", "seo", "digital marketing",
    "branding", "advertising", "sales strategy", "b2b",
  ],
  "Real Estate": [
    "real estate", "property", "housing market", "mortgage", "realtor",
    "home buying", "rental property", "apartment", "listing",
  ],
  "Automotive": [
    "car", "automotive", "vehicle", "auto repair", "car review",
    "motorcycle", "driving", "engine", "car insurance",
  ],
  "Parenting & Family": [
    "parenting", "family", "baby", "toddler", "pregnancy", "kids",
    "motherhood", "fatherhood", "childcare",
  ],
  "Fitness & Sports": [
    "fitness", "workout", "exercise", "gym", "sports", "training program",
    "bodybuilding", "yoga", "running", "athlete",
  ],
  "Pets & Animals": [
    "pet", "pets", "dog", "cat", "animal", "animals", "veterinary", "pet care",
    "adoption", "puppy", "kitten", "bird", "birds", "birding", "birdwatching",
    "bird watching", "wildlife", "crow", "crows", "raven", "parrot", "ornithology",
    "aviary", "reptile", "fish tank", "aquarium", "rodent", "wild animal",
  ],
  "Legal Services": [
    "legal", "lawyer", "attorney", "law firm", "legal advice",
    "lawsuit", "personal injury", "immigration law", "family law",
  ],
  "Career & Jobs": [
    "career", "job search", "resume", "interview tips", "hiring",
    "workplace", "professional development", "job", "employment",
  ],
  "Gaming & Entertainment": [
    "gaming", "video game", "esports", "movie", "streaming", "entertainment",
    "tv show", "gamer", "playstation", "xbox",
  ],
  "Home Improvement / DIY": [
    "diy", "home improvement", "renovation", "remodeling", "handyman",
    "woodworking", "how to build", "home repair",
  ],
  "Sustainability & Green Living": [
    "sustainability", "sustainable", "eco friendly", "green living",
    "zero waste", "renewable energy", "climate", "recycling",
  ],
  "General Lifestyle": [
    "lifestyle", "blog", "life hacks", "productivity", "inspiration",
    "personal blog", "everyday life",
  ],
};
