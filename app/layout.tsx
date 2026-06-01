import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import ConditionalFooter from "@/components/ui/ConditionalFooter";
import ServiceWorkerRegistrar from "@/components/ui/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://hottruckmap.com"),
  title: "Hot Truck Map - Find Food Trucks Near You",
  description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
    ],
    shortcut: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Hot Truck Map",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
    type: "website",
    siteName: "Hot Truck Map",
    url: "https://hottruckmap.com",
    images: [
      {
        url: "https://hottruckmap.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Hot Truck Map — Find food trucks near you",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hot Truck Map",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
    images: ["https://hottruckmap.com/og-image.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Hot Truck Map",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#171717",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <ConditionalFooter />
        <ServiceWorkerRegistrar />
        <Analytics />
      </body>
    </html>
  );
}