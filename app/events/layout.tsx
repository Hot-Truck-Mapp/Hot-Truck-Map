import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Food Truck Festivals & Events | HotTruckMap",
  description:
    "Browse upcoming food truck festivals and events by state and city. Updated monthly with the latest happenings near you.",
  openGraph: {
    title: "Food Truck Festivals & Events | HotTruckMap",
    description:
      "Browse upcoming food truck festivals and events by state and city.",
  },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
