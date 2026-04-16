import type { Metadata } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "Hot Truck Maps - Find Food Trucks Near You",
  description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
  openGraph: {
    title: "Hot Truck Maps",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
    type: "website",
    siteName: "Hot Truck Maps",
  },
  twitter: {
    card: "summary",
    title: "Hot Truck Maps",
    description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
  },
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