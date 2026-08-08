import type { Config } from "tailwindcss";

// Design tokens — "verified ledger" direction:
// A trust/audit aesthetic for an SEO-professional audience, built around
// metric chips (DA/DR/traffic) as the recurring visual motif.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0F1720", // near-black navy — primary text / dark surfaces
          soft: "#1C2733",
        },
        paper: "#F6F5F1", // quiet off-white background (not warm cream)
        signal: {
          DEFAULT: "#00B187", // verified / accepted / positive metric
          soft: "#E3F6EF",
        },
        amber: {
          DEFAULT: "#E8A33D", // CTA / pending / price
          soft: "#FBEEDA",
        },
        line: "#DEDBD1", // hairline borders on paper
        muted: "#6B7280",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        chip: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
