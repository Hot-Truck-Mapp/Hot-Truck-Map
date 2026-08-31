"use client";

import Link from "next/link";
import { money } from "./shared";
import type { AdminStats, TabId } from "./types";

/**
 * The landing tab: what needs the owner's attention today, then the
 * secondary numbers. Each attention card jumps straight to the tab that
 * can action it.
 */
export default function OverviewPanel({
  stats, onGoToTab,
}: { stats: AdminStats | null; onGoToTab: (tab: TabId) => void }) {
  if (!stats) {
    return <p className="p-6 text-sm text-neutral-400">Stats unavailable.</p>;
  }

  const attention: { label: string; value: number; tab: TabId; tone: string }[] = [
    { label: "Orders in progress", value: stats.openOrders, tab: "orders", tone: "bg-blue-50 text-blue-700" },
    { label: "Catering leads waiting", value: stats.pendingCatering, tab: "catering", tone: "bg-amber-50 text-amber-700" },
    { label: "Unread contact messages", value: stats.newContacts, tab: "contact", tone: "bg-red-50 text-red-600" },
  ];

  const secondary = [
    { label: "Revenue this week", value: money(stats.revenueThisWeek) },
    { label: "Revenue all time", value: money(stats.revenueAllTime) },
    { label: "Orders all time", value: stats.totalOrders.toLocaleString() },
    { label: "New trucks this week", value: `+${stats.newTrucksThisWeek}` },
    { label: "New users this week", value: `+${stats.newUsersThisWeek}` },
    { label: "Profile views this week", value: stats.viewsThisWeek.toLocaleString() },
    { label: "Reviews", value: stats.totalReviews.toLocaleString() },
    { label: "Newsletter subscribers", value: stats.newsletterActive.toLocaleString() },
  ];

  return (
    <div className="p-6">
      <p className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-4">Needs attention</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        {attention.map((a) => (
          <button
            key={a.label}
            onClick={() => onGoToTab(a.tab)}
            className="text-left border border-neutral-100 rounded-2xl p-4 hover:border-neutral-200 hover:shadow-sm transition-all"
          >
            <div className={`inline-flex items-center justify-center min-w-9 h-9 px-2.5 rounded-xl font-black text-lg mb-2 ${a.tone}`}>
              {a.value}
            </div>
            <p className="text-sm font-bold text-neutral-700">{a.label}</p>
            <p className="text-xs text-brand-red font-semibold mt-1">
              {a.value > 0 ? "Open →" : "All clear"}
            </p>
          </button>
        ))}
      </div>

      <p className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-4">The numbers</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {secondary.map((s) => (
          <div key={s.label} className="bg-neutral-50 rounded-2xl p-4">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-xl font-black text-neutral-800">{s.value}</p>
          </div>
        ))}
      </div>

      <p className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-4">Jump to</p>
      <div className="flex flex-wrap gap-2">
        <Link href="/" target="_blank" className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors">
          Homepage
        </Link>
        <Link href="/map" target="_blank" className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors">
          Live map
        </Link>
        <Link href="/events" target="_blank" className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors">
          Events
        </Link>
        <Link href="/newsletter" target="_blank" className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors">
          Newsletter
        </Link>
        <Link href="/trucks/leaderboard" target="_blank" className="px-4 py-2 rounded-xl bg-neutral-100 text-neutral-600 text-xs font-bold hover:bg-neutral-200 transition-colors">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
