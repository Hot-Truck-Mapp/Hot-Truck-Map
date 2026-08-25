import type { Metadata } from "next";
import { NEWSLETTER_NAME, NEWSLETTER_TAGLINE } from "@/lib/updates";

export const metadata: Metadata = {
  title: `${NEWSLETTER_NAME} | Hot Truck Map Updates`,
  description: NEWSLETTER_TAGLINE,
  openGraph: {
    title: `${NEWSLETTER_NAME} | Hot Truck Map Updates`,
    description: NEWSLETTER_TAGLINE,
  },
};

export default function UpdatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
