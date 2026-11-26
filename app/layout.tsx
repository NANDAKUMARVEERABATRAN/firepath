import type { Metadata, Viewport } from "next";
import RegisterServiceWorker from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "FIREpath | Your path to financial freedom",
  description:
    "Understand your finances, calculate your FIRE number and build a roadmap towards financial independence in India.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  applicationName: "FIREpath",
  appleWebApp: { capable: true, title: "FIREpath", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: "FIREpath",
    description: "Know Your Wealth. Plan Your Freedom.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f805e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}<RegisterServiceWorker /></body>
    </html>
  );
}
