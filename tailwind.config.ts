import type { Config } from "tailwindcss";

// Design tokens — matches the LinkLazy logo: a navy wordmark with a
// blue → violet → magenta gradient mark. The gradient is the brand's
// one signature visual element, used sparingly (logo, primary CTA,
// active states) against a clean white/near-white product surface.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0A0E27", // near-black navy, matches the logo wordmark
          soft: "#1C2242",
        },
        paper: "#FAFAFC", // clean near-white background
        brand: {
          blue: "#2C75FC",
          violet: "#6D35F9",
          magenta: "#B23CFC",
          soft: "#F1EEFE", // pale tint for backgrounds/badges
        },
        signal: {
          DEFAULT: "#16A34A", // verified / accepted (kept separate from brand gradient for clarity)
          soft: "#EAFBF1",
        },
        amber: {
          DEFAULT: "#E8A33D", // price / pending
          soft: "#FBEEDA",
        },
        line: "#E4E1F0",
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
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2C75FC 0%, #6D35F9 55%, #B23CFC 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
