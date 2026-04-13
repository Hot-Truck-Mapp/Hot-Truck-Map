"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Stats = {
  totalFollowers: number;
  ordersToday: number;
  viewsThisWeek: number;
  ordersThisWeek: number;
  revenueToday: number;
  revenueThisWeek: number;
  topItem: string;
  rating: number;
};

const EMPTY_STATS: Stats = {
  totalFollowers: 0,
  ordersToday: 0,
  viewsThisWeek: 0,
  ordersThisWeek: 0,
  revenueToday: 0,
  revenueThisWeek: 0,
  topItem: "—",
  rating: 0,
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [truckName, setTruckName] = useState("");

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: truck } = await supabase
      .from("trucks")
      .select("id, name")
      .eq("owner_id", user.id)
      .single();

    if (!truck) return;
    setTruckName(truck.name);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: followers } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("truck_id", truck.id);

    const { data: todayOrders } = await supabase
      .from("orders")
      .select("total")
      .eq("truck_id", truck.id)
      .gte("created_at", today.toISOString());

    const { data: weekOrders } = await supabase
      .from("orders")
      .select("total")
      .eq("truck_id", truck.id)
      .gte("created_at", weekAgo.toISOString());

    const { count: weekViews } = await supabase
      .from("truck_views")
      .select("*", { count: "exact", head: true })
      .eq("truck_id", truck.id)
      .gte("created_at", weekAgo.toISOString());

    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating")
      .eq("truck_id", truck.id);

    const avgRating = reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    setStats({
      totalFollowers: followers ?? 0,
      ordersToday: todayOrders?.length ?? 0,
      viewsThisWeek: weekViews ?? 0,
      ordersThisWeek: weekOrders?.length ?? 0,
      revenueToday: todayOrders?.reduce((sum, o) => sum + o.total, 0) ?? 0,
      revenueThisWeek: weekOrders?.reduce((sum, o) => sum + o.total, 0) ?? 0,
      topItem: "—",
      rating: Math.round(avgRating * 10) / 10,
    });

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading stats...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4">
        <h1 className="text-lg font-bold text-neutral-800">Analytics</h1>
        <p className="text-sm text-neutral-400">{truckName}</p>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* Top 3 stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Followers" value={stats.totalFollowers} color="bg-red-50" />
          <StatCard label="Orders Today" value={stats.ordersToday} color="bg-orange-50" />
          <StatCard label="Views This Week" value={stats.viewsThisWeek} color="bg-amber-50" />
        </div>

        {/* Revenue cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs text-neutral-400 font-medium mb-1">Revenue Today</p>
            <p className="text-2xl font-bold text-neutral-800">
              ${stats.revenueToday.toFixed(2)}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {stats.ordersToday} order{stats.ordersToday !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs text-neutral-400 font-medium mb-1">Revenue This Week</p>
            <p className="text-2xl font-bold text-neutral-800">
              ${stats.revenueThisWeek.toFixed(2)}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {stats.ordersThisWeek} order{stats.ordersThisWeek !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {/* Rating */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-yellow-500">
              {stats.rating > 0 ? stats.rating.toFixed(1) : "—"}
            </span>
          </div>
          <div>
            <p className="text-xs text-neutral-400 font-medium">Average Rating</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  className={`text-sm ${
                    star <= Math.round(stats.rating)
                      ? "text-yellow-400"
                      : "text-neutral-200"
                  }`}
                >
                  ★
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Quick insights */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-3">Quick Insights</p>
          <div className="flex flex-col gap-3">
            <InsightRow label="Orders this week" value={String(stats.ordersThisWeek)} />
            <InsightRow label="Total followers" value={String(stats.totalFollowers)} />
            <InsightRow label="Profile views this week" value={String(stats.viewsThisWeek)} />
            <InsightRow
              label="Average rating"
              value={stats.rating > 0 ? `${stats.rating}/5` : "No reviews yet"}
            />
          </div>
        </div>

        {/* Coming soon */}
        <div className="bg-neutral-100 rounded-2xl p-4 text-center">
          <p className="text-sm font-semibold text-neutral-600">
            Detailed charts coming in Phase 5
          </p>
          <p className="text-xs text-neutral-400 mt-1">
            Revenue trends, peak hours, and customer demographics
          </p>
        </div>

      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`${color} rounded-2xl p-3 flex flex-col items-center text-center`}>
      <p className="text-xl font-bold text-neutral-800">{value.toLocaleString()}</p>
      <p className="text-[10px] text-neutral-500 font-medium leading-tight mt-0.5">{label}</p>
    </div>
  );
}

function InsightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="text-sm font-bold text-neutral-800">{value}</p>
    </div>
  );
}
