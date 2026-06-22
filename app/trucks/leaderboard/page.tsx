"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type LeaderboardTruck = {
  id: string;
  name: string;
  cuisine: string | null;
  profile_photo: string | null;
  follower_count?: number;
  avg_rating?: number;
  review_count?: number;
  order_count?: number;
};

type Tab = "followed" | "rated" | "active";

export default function LeaderboardPage() {
  const mountedRef = useRef(true);
  const [activeTab, setActiveTab] = useState<Tab>("followed");
  const [followed, setFollowed] = useState<LeaderboardTruck[]>([]);
  const [rated, setRated] = useState<LeaderboardTruck[]>([]);
  const [active, setActive] = useState<LeaderboardTruck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadLeaderboards();
  }, []);

  async function loadLeaderboards() {
    setLoading(true);
    try {
      const supabase = createClient();

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Most followed — use embedded count via PostgREST (no row scanning)
      const { data: followedTrucks } = await supabase
        .from("trucks")
        .select("id, name, cuisine, profile_photo, avg_rating, review_count, follows_agg:follows(count)")
        .limit(100);

      if (!mountedRef.current) return;

      const trucks: LeaderboardTruck[] = (followedTrucks ?? []).map((t: any) => ({
        ...t,
        follower_count: Number(t.follows_agg?.[0]?.count ?? 0),
        order_count: 0,
      }));

      const mostFollowed = [...trucks]
        .sort((a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0))
        .slice(0, 10);

      const highestRated = [...trucks]
        .filter((t) => (t.review_count ?? 0) >= 1)
        .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
        .slice(0, 10);

      // Most active — all-time order count via embedded aggregate
      // (PostgREST embedded counts do not support date-range filtering inline;
      //  this shows all-time order totals, which is still a meaningful ranking)
      const { data: activeTrucks } = await supabase
        .from("trucks")
        .select("id, name, cuisine, profile_photo, avg_rating, review_count, orders_agg:orders(count)")
        .limit(100);

      if (!mountedRef.current) return;

      const mostActive = (activeTrucks ?? [])
        .map((t: any) => ({
          ...t,
          follower_count: 0,
          order_count: Number(t.orders_agg?.[0]?.count ?? 0),
        }))
        .filter((t: LeaderboardTruck) => (t.order_count ?? 0) > 0)
        .sort((a: LeaderboardTruck, b: LeaderboardTruck) => (b.order_count ?? 0) - (a.order_count ?? 0))
        .slice(0, 10);

      if (!mountedRef.current) return;
      setFollowed(mostFollowed);
      setRated(highestRated);
      setActive(mostActive);
    } catch {
      // network error — show empty states
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "followed", label: "Most Followed", emoji: "❤️" },
    { id: "rated", label: "Highest Rated", emoji: "⭐" },
    { id: "active", label: "Most Active", emoji: "🔥" },
  ];

  function statValue(truck: LeaderboardTruck): string {
    if (activeTab === "followed") return `${truck.follower_count ?? 0} followers`;
    if (activeTab === "rated") return `${(truck.avg_rating ?? 0).toFixed(1)} ★ (${truck.review_count ?? 0})`;
    return `${truck.order_count ?? 0} orders`;
  }

  const currentList = activeTab === "followed" ? followed : activeTab === "rated" ? rated : active;

  const RANK_COLORS = ["#E8481C", "#F5A623", "#888", "#666", "#555"];

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1">
                <span className="font-black text-brand-red text-sm">HOT</span>
                <span className="font-black text-white text-sm">TRUCK</span>
              </div>
              <span className="font-black text-brand-orange text-sm leading-none">MAP</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/trucks" className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-semibold hover:border-neutral-500 hover:text-white transition-colors">
            All Trucks
          </Link>
          <Link href="/account" aria-label="Account" className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Hero banner */}
      <div className="bg-neutral-900 px-4 py-8 text-center">
        <p className="text-3xl mb-2">🏆</p>
        <h1 className="text-2xl font-black text-white tracking-wide">Truck Leaderboards</h1>
        <p className="text-neutral-400 text-sm mt-1">The top food trucks in the city</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Tab selector */}
        <div className="flex bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3.5 text-xs font-black tracking-wide transition-colors flex flex-col items-center gap-1 ${
                activeTab === tab.id
                  ? "bg-brand-red text-white"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              <span className="text-lg">{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Leaderboard list */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
              <p className="text-neutral-400 text-sm">Loading leaderboard...</p>
            </div>
          ) : currentList.length === 0 ? (
            <div className="py-16 text-center px-6">
              <p className="text-neutral-400 text-sm">No data yet — check back soon!</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-50">
              {currentList.map((truck, i) => (
                <div key={truck.id} className="flex items-center gap-4 px-5 py-4">
                  {/* Rank badge */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black"
                    style={{
                      backgroundColor: i < RANK_COLORS.length ? RANK_COLORS[i] + "22" : "#f5f5f5",
                      color: i < RANK_COLORS.length ? RANK_COLORS[i] : "#999",
                    }}
                  >
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                  </div>

                  {/* Photo */}
                  <div className="w-12 h-12 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden relative">
                    {truck.profile_photo ? (
                      <Image src={truck.profile_photo} alt={truck.name} fill sizes="80px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 3h15v13H1z"/>
                          <path d="M16 8h4l3 3v5h-7V8z"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/>
                          <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-neutral-900 text-sm uppercase tracking-wide leading-tight truncate">{truck.name}</p>
                    <p className="text-xs text-brand-red font-semibold mt-0.5">{truck.cuisine ?? "Food Truck"}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{statValue(truck)}</p>
                  </div>

                  {/* View link */}
                  <Link
                    href={`/truck/${truck.id}`}
                    className="flex-shrink-0 px-3 py-1.5 bg-brand-red text-white text-xs font-bold rounded-full hover:bg-red-600 transition-colors"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
