import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://hottruckmap.com"),
  title: "Hot Truck Map - Find Food Trucks Near You",
  description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "Hot Truck Map",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
    type: "website",
    siteName: "Hot Truck Map",
    url: "https://hottruckmap.com",
    images: [
      {
        url: "https://hottruckmap.com/og-image.png",
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
    images: ["https://hottruckmap.com/og-image.png"],
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
        <Analytics />
      </body>
    </html>
  );
}