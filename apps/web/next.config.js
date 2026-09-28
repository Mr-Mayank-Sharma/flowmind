/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  output: "standalone",
  transpilePackages: ["@flowmind/shared", "@flowmind/db", "@flowmind/ui"],
  experimental: {
    // Lives under `experimental` on Next 14; the top-level spelling is silently
    // ignored there, which would ship a standalone bundle missing traced deps.
    outputFileTracingRoot: path.join(__dirname, "../../"),
    optimizePackageImports: ["lucide-react"],
  },
};

module.exports = nextConfig;
