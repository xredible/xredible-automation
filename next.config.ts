import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }];
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/app/:file*.apk", headers: [{ key: "Content-Type", value: "application/vnd.android.package-archive" }, { key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
