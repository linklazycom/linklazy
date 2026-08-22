import nextConfig from "eslint-config-next";

// Next.js 16 removed the `next lint` subcommand, so linting now goes
// through plain ESLint using its flat-config format. `eslint-config-next`
// already ships a flat config array (core-web-vitals + TypeScript rules),
// so we just spread it and layer the repo's own ignores on top.
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "public/**"],
  },
  ...nextConfig,
  {
    // eslint-plugin-react's auto-detection of the React version calls an
    // ESLint context API that changed shape under ESLint 10's flat-config
    // runtime, which throws instead of detecting. Setting the version
    // explicitly skips that detection path entirely.
    settings: { react: { version: "19.2.8" } },
  },
];

export default eslintConfig;
