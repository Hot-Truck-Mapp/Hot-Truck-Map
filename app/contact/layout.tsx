import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | HotTruckMap",
  description:
    "Get in touch with the HotTruckMap team. Questions, feedback, or partnership inquiries — we'd love to hear from you.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
