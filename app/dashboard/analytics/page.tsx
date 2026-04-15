"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

type Range = "weekly" | "monthly" | "yearly";

type ChartPoint = {
  label: string;
  followers: number;
  orders: number;
  views: number;
};

type PeriodStats = {
  followers: number;
  orders: number;
  views: number;
  revenue: number;
};

const RANGES: { key: Range; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
];

export default function AnalyticsPage() {
  const [range, setRange] = useState<Range>("weekly");
  const [truckId, setTruckId] = useState<string | null>(null);
  const [truckName, setTruckName] = useState("");
  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingChart, setLoadingChart] = useState(false);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [periodStats, setPeriodStats] = useState<PeriodStats>({
    followers: 0, orders: 0, views: 0, revenue: 0,
  });

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (truckId) loadRange(truckId, range);
  }, [range, truckId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function init() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: truck } = await supabase
      .from("trucks")
      .select("id, name")
      .eq("owner_id", user.id)
      .single();

    if (!truck) { setLoadingInit(false); return; }
    setTruckId(truck.id);
    setTruckName(truck.name ?? "");

    const { count } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("truck_id", truck.id);

    setTotalFollowers(count ?? 0);
    await loadRange(truck.id, "weekly");
    setLoadingInit(false);
  }

  async function loadRange(id: string, r: Range) {
    setLoadingChart(true);
    const supabase = createClient();
    const now = new Date();

    type Bucket = { label: string; start: Date; end: Date };
    let buckets: Bucket[] = [];
    let startDate: Date;

    if (r === "weekly") {
      // Last 7 days, one bucket per day
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const start = new Date(d); start.setHours(0, 0, 0, 0);
        const end = new Date(d); end.setHours(23, 59, 59, 999);
        const label = d.toLocaleDateString("en-US", { weekday: "short" });
        buckets.push({ label, start, end });
      }
    } else if (r === "monthly") {
      // Last 4 weeks, one bucket per week
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 27);
      startDate.setHours(0, 0, 0, 0);

      for (let i = 3; i >= 0; i--) {
        const end = new Date(now);
        end.setDate(end.getDate() - i * 7);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        buckets.push({ label: `Wk ${4 - i}`, start, end });
      }
    } else {
      // Last 12 months, one bucket per month
      startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      startDate.setHours(0, 0, 0, 0);

      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
        const label = d.toLocaleDateString("en-US", { month: "short" });
        buckets.push({ label, start, end });
      }
    }

    const [followsRes, ordersRes, viewsRes] = await Promise.all([
      supabase
        .from("follows")
        .select("created_at")
        .eq("truck_id", id)
        .gte("created_at", startDate.toISOString()),
      supabase
        .from("orders")
        .select("created_at, total")
        .eq("truck_id", id)
        .gte("created_at", startDate.toISOString()),
      supabase
        .from("truck_views")
        .select("created_at")
        .eq("truck_id", id)
        .gte("created_at", startDate.toISOString()),
    ]);

    const followsRaw = followsRes.data ?? [];
    const ordersRaw = ordersRes.data ?? [];
    const viewsRaw = viewsRes.data ?? [];

    const points: ChartPoint[] = buckets.map(({ label, start, end }) => ({
      label,
      followers: followsRaw.filter(f => { const d = new Date(f.created_at); return d >= start && d <= end; }).length,
      orders: ordersRaw.filter(o => { const d = new Date(o.created_at); return d >= start && d <= end; }).length,
      views: viewsRaw.filter(v => { const d = new Date(v.created_at); return d >= start && d <= end; }).length,
    }));

    setChartData(points);
    setPeriodStats({
      followers: followsRaw.length,
      orders: ordersRaw.length,
      views: viewsRaw.length,
      revenue: ordersRaw.reduce((sum, o) => sum + (o.total ?? 0), 0),
    });

    setLoadingChart(false);
  }

  const rangeLabel = range === "weekly"
    ? "Last 7 Days"
    : range === "monthly"
    ? "Last 4 Weeks"
    : "Last 12 Months";

  if (loadingInit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-400 text-sm">Loading analytics...</p>
      </div>
    );
  }

  if (!truckId) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
            <line x1="18" y1="20" x2="18" y2="10"/>
            <line x1="12" y1="20" x2="12" y2="4"/>
            <line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
        </div>
        <p className="font-bold text-neutral-800 mb-1">No analytics yet</p>
        <p className="text-sm text-neutral-400 mb-6">
          Create your truck profile first to start tracking followers and orders.
        </p>
        <a
          href="/dashboard/profile"
          className="px-6 py-3 bg-brand-red text-white rounded-2xl font-bold text-sm"
        >
          Create Truck Profile
        </a>
        <button onClick={() => window.history.back()} className="mt-3 text-sm text-neutral-400 hover:text-neutral-600">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-lg font-bold text-neutral-800">Analytics</h1>
          <p className="text-sm text-neutral-400">{truckName}</p>
        </div>
        <button onClick={() => window.history.back()} className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors">
          ← Back
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto">

        {/* Total Followers — always all-time */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <p className="text-3xl font-black text-neutral-900">{totalFollowers.toLocaleString()}</p>
            <p className="text-sm text-neutral-500 font-medium">Total Followers</p>
          </div>
        </div>

        {/* Range Tabs */}
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                range === key
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Period Stats */}
        <div className="grid grid-cols-2 gap-3">
          <PeriodCard
            label="New Followers"
            value={periodStats.followers.toLocaleString()}
            sublabel={rangeLabel}
            color="bg-red-50"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/>
                <line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
            }
          />
          <PeriodCard
            label="Orders"
            value={periodStats.orders.toLocaleString()}
            sublabel={rangeLabel}
            color="bg-orange-50"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                <rect x="9" y="3" width="6" height="4" rx="2"/>
                <line x1="9" y1="12" x2="15" y2="12"/>
                <line x1="9" y1="16" x2="13" y2="16"/>
              </svg>
            }
          />
          <PeriodCard
            label="Profile Views"
            value={periodStats.views.toLocaleString()}
            sublabel={rangeLabel}
            color="bg-blue-50"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            }
          />
          <PeriodCard
            label="Revenue"
            value={`$${periodStats.revenue.toFixed(2)}`}
            sublabel={rangeLabel}
            color="bg-green-50"
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
            }
          />
        </div>

        {/* Followers + Orders Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-1">Followers &amp; Orders</p>
          <p className="text-xs text-neutral-400 mb-4">{rangeLabel}</p>
          {loadingChart ? (
            <div className="h-[220px] flex items-center justify-center">
              <p className="text-neutral-400 text-sm">Loading...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={2} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.03)", radius: 4 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar dataKey="followers" name="New Followers" fill="#E8481C" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="orders" name="Orders" fill="#FB923C" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Profile Views Chart */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-1">Profile Views</p>
          <p className="text-xs text-neutral-400 mb-4">{rangeLabel}</p>
          {loadingChart ? (
            <div className="h-[160px] flex items-center justify-center">
              <p className="text-neutral-400 text-sm">Loading...</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={chartData} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#aaa" }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
                    fontSize: "12px",
                    padding: "8px 12px",
                  }}
                  cursor={{ fill: "rgba(0,0,0,0.03)", radius: 4 }}
                />
                <Bar dataKey="views" name="Views" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

function PeriodCard({
  label,
  value,
  sublabel,
  color,
  icon,
}: {
  label: string;
  value: string;
  sublabel: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`${color} rounded-2xl p-4`}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <p className="text-xs text-neutral-600 font-semibold">{label}</p>
      </div>
      <p className="text-2xl font-black text-neutral-900">{value}</p>
      <p className="text-[10px] text-neutral-400 mt-0.5">{sublabel}</p>
    </div>
  );
}
