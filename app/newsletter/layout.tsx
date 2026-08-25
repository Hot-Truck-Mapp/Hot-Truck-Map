import type { Metadata } from "next";
import { NEWSLETTER_NAME, NEWSLETTER_TAGLINE } from "@/lib/newsletter";

export const metadata: Metadata = {
  title: `${NEWSLETTER_NAME} | Hot Truck Map Newsletter`,
  description: NEWSLETTER_TAGLINE,
  openGraph: {
    title: `${NEWSLETTER_NAME} | Hot Truck Map Newsletter`,
    description: NEWSLETTER_TAGLINE,
  },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
