import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Browse Food Trucks | HotTruckMap",
  description:
    "Find live food trucks near you. Filter by cuisine, dietary needs, and location. Real-time updates, menus, and ratings — all in one place.",
  openGraph: {
    title: "Browse Food Trucks | HotTruckMap",
    description:
      "Find live food trucks near you. Real-time locations, menus, and ratings.",
  },
};

export default function TrucksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
