import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The printable PDF engine reads its fonts and logo from disk.
  outputFileTracingIncludes: {
    "/dashboard/printables": ["./lib/printables/assets/**/*"],
  },
  async rewrites() {
    return [{ source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }];
  },
  async headers() {
    const base = [
      { key: "Strict-Transport-Security", value: "max-age=63072000" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
    ];
    return [
      { source: "/:path*", headers: base },
      // Only xredible.in may frame its own pages (stops clickjacking on Approve, Pay and the like)…
      { source: "/((?!join).*)", headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "Content-Security-Policy", value: "frame-ancestors 'self'" }] },
      // …except the hosted signup forms, which customers may embed on their own sites.
      { source: "/join/:path*", headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/app/:file*.apk", headers: [{ key: "Content-Type", value: "application/vnd.android.package-archive" }, { key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};

export default nextConfig;
