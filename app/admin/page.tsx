"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { fetchSection, money } from "@/components/admin/shared";
import type { AdminStats, TabId } from "@/components/admin/types";
import OverviewPanel from "@/components/admin/OverviewPanel";
import TrucksPanel from "@/components/admin/TrucksPanel";
import UsersPanel from "@/components/admin/UsersPanel";
import OrdersPanel from "@/components/admin/OrdersPanel";
import CateringPanel from "@/components/admin/CateringPanel";
import ContactPanel from "@/components/admin/ContactPanel";
import ReviewsPanel from "@/components/admin/ReviewsPanel";
import ModerationPanel from "@/components/admin/ModerationPanel";
import NewsletterPanel from "@/components/admin/NewsletterPanel";
import AnnouncePanel from "@/components/admin/AnnouncePanel";
import FeaturedPanel from "@/components/admin/FeaturedPanel";
import FestivalsPanel from "@/components/admin/FestivalsPanel";

/**
 * Owner console. Access is enforced server-side, twice over: middleware.ts
 * redirects non-admins away from /admin, and every /api/admin/* route
 * re-checks before it touches data.
 *
 * This component doesn't evaluate the admin list itself — it asks. The first
 * overview fetch is the gate: 200 means the server accepted this session and
 * the dashboard renders, 403 means it didn't and the access-denied card does.
 * That keeps the browser out of the authorization decision entirely, and
 * means ADMIN_EMAILS never has to be mirrored into the public bundle.
 */
export default function AdminPage() {
  const mountedRef = useRef(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [refreshToken, setRefreshToken] = useState(0);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const loadStats = useCallback(async (isFirstLoad = false) => {
    try {
      const json = await fetchSection<{ stats: AdminStats; admin: { email: string | null } }>("overview");
      if (!mountedRef.current) return;
      setStats(json.stats);
      setAdminEmail(json.admin?.email ?? null);
      setStatsError(null);
      setLastRefresh(new Date());
      setAuthorized(true);
    } catch (err: any) {
      if (!mountedRef.current) return;
      const message: string = err?.message ?? "Failed to load stats";
      // A rejected first load is the access decision; later failures are just
      // a bad refresh and shouldn't throw the owner out of a working page.
      if (isFirstLoad) {
        setAuthorized(message === "Forbidden" ? false : true);
      }
      setStatsError(message === "Forbidden" ? null : message);
    }
  }, []);

  useEffect(() => { void loadStats(true); }, [loadStats]);

  function refresh() {
    setRefreshToken((t) => t + 1);
    void loadStats();
  }

  const headerSubtitle = [
    adminEmail,
    lastRefresh && `updated ${lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
  ].filter(Boolean).join(" · ");

  // ── Not authorized ────────────────────────────────────────────────────
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
        <div className="flex items-center gap-2">
          <Link href="/login?redirect=/admin" className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm">
            Sign in
          </Link>
          <Link href="/" className="px-5 py-2.5 bg-neutral-100 text-neutral-600 rounded-xl font-semibold text-sm">
            Back to Map
          </Link>
        </div>
      </div>
    );
  }

  // ── Checking session ──────────────────────────────────────────────────
  if (authorized === null) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-red border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">Loading admin data...</p>
        </div>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; badge?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "live", label: "Live Now", badge: stats?.liveTrucks },
    { id: "trucks", label: "All Trucks", badge: stats?.totalTrucks },
    { id: "users", label: "Accounts", badge: stats?.totalUsers },
    { id: "orders", label: "Orders", badge: stats?.openOrders },
    { id: "catering", label: "Catering", badge: stats?.pendingCatering },
    { id: "contact", label: "Inbox", badge: stats?.newContacts },
    { id: "reviews", label: "Reviews" },
    { id: "moderation", label: "Moderation" },
    { id: "newsletter", label: "Newsletter", badge: stats?.newsletterActive },
    { id: "announce", label: "📣 Announce" },
    { id: "totw", label: "🏆 Truck of the Week" },
    { id: "festivals", label: "🎪 Festivals" },
  ];

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Header */}
      <div className="bg-neutral-900 px-4 md:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
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
              <span className="font-black text-brand-red text-sm">HOT TRUCK MAP</span>
              <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-red/20 text-brand-red rounded-full border border-brand-red/30">
                OWNER
              </span>
            </div>
            <p className="text-neutral-500 text-xs">{headerSubtitle}</p>
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

      <div className="max-w-7xl mx-auto p-4 md:p-6">

        {statsError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-red-600">{statsError}</p>
            <button onClick={refresh} className="px-3 py-1.5 rounded-lg bg-white text-red-600 text-xs font-bold">
              Retry
            </button>
          </div>
        )}

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
            label="Total Users"
            value={stats?.totalUsers ?? 0}
            sub={`+${stats?.newUsersThisWeek ?? 0} this week`}
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
            label="Revenue"
            value={money(stats?.revenueAllTime ?? 0)}
            sub={`${money(stats?.revenueThisWeek ?? 0)} this week`}
            color="blue"
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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

          {/* Panels mount lazily — a tab's data is only fetched once opened. */}
          {activeTab === "overview" && <OverviewPanel stats={stats} onGoToTab={setActiveTab} />}
          {activeTab === "live" && <TrucksPanel refreshToken={refreshToken} liveOnly />}
          {activeTab === "trucks" && <TrucksPanel refreshToken={refreshToken} />}
          {activeTab === "users" && <UsersPanel refreshToken={refreshToken} />}
          {activeTab === "orders" && <OrdersPanel refreshToken={refreshToken} />}
          {activeTab === "catering" && <CateringPanel refreshToken={refreshToken} />}
          {activeTab === "contact" && <ContactPanel refreshToken={refreshToken} />}
          {activeTab === "reviews" && <ReviewsPanel refreshToken={refreshToken} />}
          {activeTab === "moderation" && <ModerationPanel refreshToken={refreshToken} />}
          {activeTab === "newsletter" && <NewsletterPanel refreshToken={refreshToken} />}
          {activeTab === "announce" && <AnnouncePanel refreshToken={refreshToken} />}
          {activeTab === "totw" && <FeaturedPanel refreshToken={refreshToken} />}
          {activeTab === "festivals" && <FestivalsPanel refreshToken={refreshToken} />}
        </div>

        <p className="text-center text-xs text-neutral-400 mt-6">
          Admin panel · hottruckmap.com · Only visible to owner
        </p>
      </div>
    </div>
  );
}

function StatCard({
  label, value, sub, color, icon, pulse,
}: {
  label: string;
  value: number | string;
  sub: string;
  color: "red" | "green" | "orange" | "blue";
  icon: React.ReactNode;
  pulse?: boolean;
}) {
  const colors = {
    red: "text-brand-red bg-red-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-500 bg-orange-50",
    blue: "text-blue-500 bg-blue-50",
  };
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color]}`}>
          {icon}
        </div>
        {pulse && typeof value === "number" && value > 0 && (
          <span className="relative flex h-2 w-2 mt-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        )}
      </div>
      <p className="text-2xl font-black text-neutral-800 leading-none">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="text-xs font-bold text-neutral-500 mt-1">{label}</p>
      <p className="text-[11px] text-neutral-400 mt-0.5">{sub}</p>
    </div>
  );
}
