import type { NextConfig } from "next";

// The instant-navigation tests (e2e/, see instant-nav.rig.md) run against a
// production build that exposes Next.js's testing API. Only that build sets
// these; real production builds never do.
const exposeTestingApi = process.env.EXPOSE_TESTING_API === "1";

const nextConfig: NextConfig = {
  // The test build gets its own output folder so it never clobbers a running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  experimental: {
    agentFeedback: true,
    exposeTestingApiInProductionBuild: exposeTestingApi,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tailwind only processes our own CSS; package CSS (such as ArcGIS's
      // theme) is used as shipped. ("foreign" = node_modules.)
      "*.css": {
        condition: { not: "foreign" },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
