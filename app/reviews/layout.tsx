import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Food Truck Reviews | HotTruckMap",
  description:
    "Read real reviews from food truck fans. Discover top-rated trucks near you based on taste, service, and value.",
};

export default function ReviewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
