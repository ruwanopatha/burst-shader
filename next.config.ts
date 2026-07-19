import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  basePath: isGitHubPages ? "/burst-shader" : undefined,
  assetPrefix: isGitHubPages ? "/burst-shader/" : undefined,
  images: {
    unoptimized: isGitHubPages,
  },
};

export default nextConfig;
