import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  metadataBase: new URL("https://hottruckmap.com"),
  title: "Hot Truck Map - Find Food Trucks Near You",
  description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
  openGraph: {
    title: "Hot Truck Map",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
    type: "website",
    siteName: "Hot Truck Map",
    url: "https://hottruckmap.com",
  },
  twitter: {
    card: "summary",
    title: "Hot Truck Map",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
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
  maximumScale: 1,
  userScalable: false,
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