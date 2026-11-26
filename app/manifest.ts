import type { MetadataRoute } from "next";

/** Web app manifest: makes FIREpath installable and is what the Google Play (Trusted Web Activity) build reads. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FIREpath — your path to financial freedom",
    short_name: "FIREpath",
    description: "Plan your FIRE number, track your portfolio and goals, and level up towards financial freedom.",
    start_url: "/journey?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f805e",
    categories: ["finance", "education", "productivity"],
    lang: "en-IN",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log this month", short_name: "Check-in", url: "/month?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "My goals", short_name: "Goals", url: "/goals?source=shortcut", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
