/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a phone on the same Wi-Fi load the dev server (development only; ignored in production builds).
  allowedDevOrigins: ["192.168.1.2"],
  async rewrites() {
    // Android app ↔ website verification for the Google Play app (values come from env, see app/api/assetlinks).
    return [{ source: "/.well-known/assetlinks.json", destination: "/api/assetlinks" }];
  },
  async redirects() {
    // Log month and Budget were merged into one "This month" page.
    return [
      { source: "/check-in", destination: "/month", permanent: false },
      { source: "/budget", destination: "/month", permanent: false },
    ];
  },
  async headers() {
    return [
      // The service worker must always be re-checked so updates reach installed apps quickly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};
export default nextConfig;
