const PATTERNS = [
  // Diagonal link/chain motif
  (id: string) => (
    <>
      <rect width="600" height="315" fill={`url(#g-${id})`} />
      <g opacity="0.25" stroke="white" strokeWidth="6" fill="none">
        <rect x="180" y="110" width="90" height="50" rx="25" transform="rotate(-20 225 135)" />
        <rect x="250" y="150" width="90" height="50" rx="25" transform="rotate(-20 295 175)" />
        <rect x="320" y="190" width="90" height="50" rx="25" transform="rotate(-20 365 215)" />
      </g>
    </>
  ),
  // Dot grid / network motif
  (id: string) => (
    <>
      <rect width="600" height="315" fill={`url(#g-${id})`} />
      <g opacity="0.3" fill="white">
        {[...Array(6)].map((_, row) =>
          [...Array(10)].map((_, col) => (
            <circle key={`${row}-${col}`} cx={40 + col * 58} cy={40 + row * 48} r="3" />
          ))
        )}
      </g>
    </>
  ),
  // Ascending bars motif
  (id: string) => (
    <>
      <rect width="600" height="315" fill={`url(#g-${id})`} />
      <g opacity="0.3" fill="white">
        <rect x="120" y="220" width="30" height="60" rx="4" />
        <rect x="170" y="190" width="30" height="90" rx="4" />
        <rect x="220" y="150" width="30" height="130" rx="4" />
        <rect x="270" y="110" width="30" height="170" rx="4" />
        <rect x="320" y="160" width="30" height="120" rx="4" />
        <rect x="370" y="130" width="30" height="150" rx="4" />
        <rect x="420" y="90" width="30" height="190" rx="4" />
      </g>
    </>
  ),
];

/** Deterministic brand-gradient SVG cover, so the same article always gets the same cover. */
export function ArticleCover({ seed, className }: { seed: string; className?: string }) {
  const idx = Math.abs(hashCode(seed)) % PATTERNS.length;
  const id = seed.replace(/[^a-z0-9]/gi, "");

  return (
    <svg viewBox="0 0 600 315" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2C75FC" />
          <stop offset="55%" stopColor="#6D35F9" />
          <stop offset="100%" stopColor="#B23CFC" />
        </linearGradient>
      </defs>
      {PATTERNS[idx](id)}
    </svg>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
