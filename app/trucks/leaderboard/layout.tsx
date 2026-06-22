import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Top Food Trucks Leaderboard | HotTruckMap",
  description:
    "See the highest-rated and most-followed food trucks on HotTruckMap. Updated daily based on reviews, followers, and live activity.",
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
