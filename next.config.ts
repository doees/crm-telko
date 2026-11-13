import type { NextConfig } from "next";

const isPagesBuild = process.env.GITHUB_PAGES === "true";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isPagesBuild
    ? {
        output: "export",
        basePath: "/crm-telko",
        trailingSlash: true,
      }
    : {}),
};
export default nextConfig;
