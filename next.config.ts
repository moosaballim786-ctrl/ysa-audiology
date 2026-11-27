import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Forgiving short / mistyped links for patients → the public booking page.
  async redirects() {
    const aliases = ["/boo", "/bok", "/booking", "/bookings", "/appointment", "/appointments"];
    return aliases.map((source) => ({ source, destination: "/book", permanent: false }));
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
