import type { Metadata } from "next";
import "./globals.css";
import OneSignalInit from "@/components/OneSignalInit";

export const metadata: Metadata = {
  title: "Hot Truck Maps - Find Food Trucks Near You",
  description: "Real-time food truck discovery. Find the food truck. Skip the guesswork.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <OneSignalInit />
        {children}
      </body>
    </html>
  );
}