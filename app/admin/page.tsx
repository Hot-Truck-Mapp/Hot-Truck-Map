"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// ── Owner emails — add yours here ────────────────────────────────────────────
const OWNER_EMAILS = ["Hottruckmap@gmail.com"];

type Stats = {
  totalTrucks: number;
  liveTrucks: number;
  totalUsers: number;
  totalFollows: number;
  totalViews: number;
  newTrucksThisWeek: number;
  newUsersThisWeek: number;
};

type Truck = {
  id: string;
  name: string;
  cuisine: string;
  is_live: boolean;
  created_at: string;
  owner_email?: string;
  followers?: number;
};

type RecentSignup = {
  id: string;
  email: string;
  role: string;
  created_at: string;
};

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [recentSignups, setRecentSignups] = useState<RecentSignup[]>([]);
  const [liveTrucks, setLiveTrucks] = useState<Truck[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "trucks" | "users" | "live">("overview");
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !OWNER_EMAILS.includes(user.email ?? "")) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);
    await loadData();
  }

  async function loadData() {
    const supabase = createClient();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    const [
      { count: totalTrucks },
      { count: liveTrucksCount },
      { count: totalFollows },
      { count: totalViews },
      { count: newTrucksThisWeek },
      { data: truckList },
      { data: liveTruckList },
    ] = await Promise.all([
      supabase.from("trucks").select("*", { count: "exact", head: true }),
      supabase.from("trucks").select("*", { count: "exact", head: true }).eq("is_live", true),
      supabase.from("follows").select("*", { count: "exact", head: true }),
      supabase.from("truck_views").select("*", { count: "exact", head: true }),
      supabase.from("trucks").select("*", { count: "exact", head: true }).gte("created_at", weekAgoISO),
      supabase
        .from("trucks")
        .select("id, name, cuisine, is_live, created_at")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("trucks")
        .select("id, name, cuisine, is_live, created_at, locations(address, broadcasted_at)")
        .eq("is_live", true),
    ]);

    // Get follower counts for each truck
    const trucksWithFollowers = await Promise.all(
      (truckList ?? []).map(async (truck) => {
        const { count } = await supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("truck_id", truck.id);
        return { ...truck, followers: count ?? 0 };
      })
    );

    setStats({
      totalTrucks: totalTrucks ?? 0,
      liveTrucks: liveTrucksCount ?? 0,
      totalUsers: 0, // requires service role key to query auth.users
      totalFollows: totalFollows ?? 0,
      totalViews: totalViews ?? 0,
      newTrucksThisWeek: newTrucksThisWeek ?? 0,
      newUsersThisWeek: 0,
    });

    setTrucks(trucksWithFollowers);
    setLiveTrucks(liveTruckList ?? []);
    setLastRefresh(new Date());
    setLoading(false);
  }

  async function refresh() {
    setLoading(true);
    await loadData();
  }

  // ── Not authorized ──────────────────────────────────────────────────────────
  if (authorized === false) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mb-4">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h1 className="text-xl font-black text-neutral-800 mb-2">Access Denied</h1>
        <p className="text-neutral-500 text-sm mb-6">This page is only accessible to the platform owner.</p>
        <Link href="/" className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm">
          Back to Map
        </Link>
      </div>
    );
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading || authorized === null) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">Loading admin data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Header */}
      <div className="bg-neutral-900 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-brand-red text-sm">HOT TRUCK MAPS</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-red/20 text-brand-red rounded-full border border-brand-red/30">
                OWNER
              </span>
            </div>
            <p className="text-neutral-500 text-xs">
              Last updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Refresh
          </button>
          <Link href="/" className="px-3 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-700 transition-colors">
            View Site
          </Link>
        </div>
      </div>

      {/* Live trucks banner */}
      {stats && stats.liveTrucks > 0 && (
        <div className="bg-brand-red px-4 md:px-8 py-2.5 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-200 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <p className="text-white text-sm font-semibold">
            {stats.liveTrucks} truck{stats.liveTrucks !== 1 ? "s" : ""} live right now
          </p>
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 md:p-6">

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard
            label="Total Trucks"
            value={stats?.totalTrucks ?? 0}
            sub={`+${stats?.newTrucksThisWeek ?? 0} this week`}
            color="red"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            }
          />
          <StatCard
            label="Live Now"
            value={stats?.liveTrucks ?? 0}
            sub="currently broadcasting"
            color="green"
            pulse
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            }
          />
          <StatCard
            label="Total Follows"
            value={stats?.totalFollows ?? 0}
            sub="across all trucks"
            color="orange"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            }
          />
          <StatCard
            label="Profile Views"
            value={stats?.totalViews ?? 0}
            sub="total truck views"
            color="blue"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            }
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-none">
            {[
              { id: "overview", label: "Overview" },
              { id: "live", label: "Live Now", badge: stats?.liveTrucks },
              { id: "trucks", label: "All Trucks", badge: stats?.totalTrucks },
              { id: "users", label: "Recent Signups" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-3.5 text-sm font-bold transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? "text-brand-red border-brand-red"
                    : "text-neutral-400 border-transparent hover:text-neutral-600"
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.id ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-500"
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="p-6">
              <div className="grid md:grid-cols-2 gap-6">

                {/* Top trucks by followers */}
                <div>
                  <h3 className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-4">
                    Top Trucks by Followers
                  </h3>
                  <div className="flex flex-col gap-2">
                    {[...trucks]
                      .sort((a, b) => (b.followers ?? 0) - (a.followers ?? 0))
                      .slice(0, 5)
                      .map((truck, i) => (
                        <div key={truck.id} className="flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0">
                          <span className="text-xs font-black text-neutral-300 w-5 text-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-neutral-800 truncate">{truck.name}</p>
                            <p className="text-xs text-neutral-400">{truck.cuisine}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {truck.is_live && (
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-brand-red" />
                              </span>
                            )}
                            <span className="text-sm font-bold text-neutral-700">{truck.followers}</span>
                            <span className="text-xs text-neutral-400">followers</span>
                          </div>
                        </div>
                      ))}
                    {trucks.length === 0 && (
                      <p className="text-sm text-neutral-400 py-4 text-center">No trucks yet</p>
                    )}
                  </div>
                </div>

                {/* Recent activity */}
                <div>
                  <h3 className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-4">
                    Recently Joined Trucks
                  </h3>
                  <div className="flex flex-col gap-2">
                    {trucks.slice(0, 5).map((truck) => (
                      <div key={truck.id} className="flex items-center gap-3 py-2 border-b border-neutral-50 last:border-0">
                        <div className="w-8 h-8 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-800 truncate">{truck.name}</p>
                          <p className="text-xs text-neutral-400">
                            {truck.cuisine} · joined {new Date(truck.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        {truck.is_live && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-brand-red text-white rounded-full">LIVE</span>
                        )}
                      </div>
                    ))}
                    {trucks.length === 0 && (
                      <p className="text-sm text-neutral-400 py-4 text-center">No trucks yet</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Live Now Tab */}
          {activeTab === "live" && (
            <div className="divide-y divide-neutral-50">
              {liveTrucks.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-neutral-400 text-sm">No trucks live right now</p>
                </div>
              ) : (
                liveTrucks.map((truck: any) => (
                  <div key={truck.id} className="flex items-center gap-4 px-6 py-4">
                    <div className="relative flex h-3 w-3 flex-shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-red" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-neutral-900">{truck.name}</p>
                      <p className="text-sm text-neutral-500">{truck.cuisine}</p>
                      {truck.locations?.[0] && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {truck.locations[0].address} ·{" "}
                          went live {new Date(truck.locations[0].broadcasted_at).toLocaleTimeString([], {
                            hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      )}
                    </div>
                    <Link
                      href={"/truck/" + truck.id}
                      className="text-xs text-brand-red font-bold hover:underline flex-shrink-0"
                    >
                      View →
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}

          {/* All Trucks Tab */}
          {activeTab === "trucks" && (
            <div className="divide-y divide-neutral-50">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-3 bg-neutral-50">
                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">Truck</span>
                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">Followers</span>
                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">Status</span>
                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">Joined</span>
              </div>
              {trucks.length === 0 ? (
                <div className="py-16 text-center">
                  <p className="text-neutral-400 text-sm">No trucks signed up yet</p>
                </div>
              ) : (
                trucks.map((truck) => (
                  <div key={truck.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-6 py-4 hover:bg-neutral-50 transition-colors">
                    <div className="min-w-0">
                      <Link href={"/truck/" + truck.id} className="font-semibold text-neutral-800 hover:text-brand-red transition-colors truncate block">
                        {truck.name}
                      </Link>
                      <p className="text-xs text-neutral-400">{truck.cuisine}</p>
                    </div>
                    <span className="text-sm font-bold text-neutral-700 text-center">{truck.followers ?? 0}</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full text-center ${
                      truck.is_live
                        ? "bg-green-50 text-green-700"
                        : "bg-neutral-100 text-neutral-400"
                    }`}>
                      {truck.is_live ? "LIVE" : "Offline"}
                    </span>
                    <span className="text-xs text-neutral-400 text-right">
                      {new Date(truck.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Recent Signups Tab */}
          {activeTab === "users" && (
            <div className="p-6">
              <div className="bg-neutral-50 rounded-xl p-4 mb-4 flex items-start gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-neutral-700">User data requires a Supabase service role key</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    To see full user signups, add <code className="bg-white px-1 py-0.5 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code> to your environment variables, then view{" "}
                    <a href="https://supabase.com/dashboard/project/ikrhlifpznzdtgxleubz/auth/users" target="_blank" rel="noopener noreferrer" className="text-brand-red font-semibold hover:underline">
                      Supabase Auth → Users →
                    </a>
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Quick Links</p>
                {[
                  { label: "View all users in Supabase", href: "https://supabase.com/dashboard/project/ikrhlifpznzdtgxleubz/auth/users", desc: "Full user list with emails, sign-in history" },
                  { label: "Database tables", href: "https://supabase.com/dashboard/project/ikrhlifpznzdtgxleubz/editor", desc: "Browse trucks, follows, orders, reviews" },
                  { label: "Vercel Analytics", href: "https://vercel.com/dashboard", desc: "Page views, traffic sources, top pages" },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-4 bg-white border border-neutral-100 rounded-xl hover:border-brand-red/30 transition-colors group"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-800 group-hover:text-brand-red transition-colors">{link.label}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">{link.desc}</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-neutral-400 mt-6">
          Admin panel · hottruckmap.com · Only visible to owner
        </p>
      </div>
    </div>
  );
}

// ── Stat card component ────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, color, pulse, icon
}: {
  label: string;
  value: number;
  sub: string;
  color: "red" | "green" | "orange" | "blue";
  pulse?: boolean;
  icon: React.ReactNode;
}) {
  const colors = {
    red:    "bg-red-50 text-brand-red",
    green:  "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-500",
    blue:   "bg-blue-50 text-blue-500",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        {pulse && value > 0 && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-neutral-800">{value.toLocaleString()}</p>
        <p className="text-xs font-semibold text-neutral-500 mt-0.5">{label}</p>
        <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
