"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrderItem = { menu_item_id: string; name: string; price: number; quantity: number };
type Order = {
  id: string;
  truck_id: string;
  total: number;
  items: OrderItem[];
  status: string;
  created_at: string;
  pickup_name?: string;
};

type DayBucket = { label: string; date: string; count: number; revenue: number };

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export default function AnalyticsPage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Summary stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [weekRevenue, setWeekRevenue] = useState(0);
  const [monthRevenue, setMonthRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [avgOrderValue, setAvgOrderValue] = useState(0);
  const [dataCapped, setDataCapped] = useState(false);

  // Chart data — last 14 days
  const [chartData, setChartData] = useState<DayBucket[]>([]);

  // Top 5 items
  const [topItems, setTopItems] = useState<{ name: string; qty: number }[]>([]);

  // Recent 10 orders
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    mountedRef.current = true;
    loadAnalytics();
    return () => { mountedRef.current = false; };
  }, []);

  async function loadAnalytics() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Auth + truck lookup
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { if (mountedRef.current) router.replace("/login"); return; }

      const { data: truck, error: truckErr } = await supabase
        .from("trucks")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (truckErr) throw new Error("Could not load your truck. Please refresh.");
      if (!truck) { router.replace("/dashboard"); return; } // no truck yet — send to setup

      const truckId = truck.id;
      const now = new Date();

      // Date boundaries
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now);
      monthStart.setDate(monthStart.getDate() - 29);
      monthStart.setHours(0, 0, 0, 0);

      const chartStart = new Date(now);
      chartStart.setDate(chartStart.getDate() - 13);
      chartStart.setHours(0, 0, 0, 0);

      // Fetch all-time orders for revenue — limit is high to reduce silent truncation.
      // True server-side aggregation would require a DB RPC function.
      const ORDERS_LIMIT = 5000;
      const { data: allOrders, error: allErr } = await supabase
        .from("orders")
        .select("id, total, items, status, created_at, pickup_name")
        .eq("truck_id", truckId)
        .order("created_at", { ascending: false })
        .limit(ORDERS_LIMIT);
      if (allErr) throw new Error("Could not load order data. Please refresh.");
      if (mountedRef.current) setDataCapped((allOrders?.length ?? 0) >= ORDERS_LIMIT);

      if (!mountedRef.current) return;

      const orders: Order[] = (allOrders ?? []).map((o: any) => ({ ...o, truck_id: truckId }));
      const completed = orders.filter((o) => o.status === "picked_up");

      // Revenue
      const allRevenue = completed.reduce((s, o) => s + (o.total ?? 0), 0);
      const wkRevenue = completed
        .filter((o) => new Date(o.created_at) >= weekStart)
        .reduce((s, o) => s + (o.total ?? 0), 0);
      const moRevenue = completed
        .filter((o) => new Date(o.created_at) >= monthStart)
        .reduce((s, o) => s + (o.total ?? 0), 0);

      setTotalRevenue(allRevenue);
      setWeekRevenue(wkRevenue);
      setMonthRevenue(moRevenue);
      setTotalOrders(orders.length);
      // avgOrderValue uses only completed (picked_up) orders for both numerator and denominator
      setAvgOrderValue(completed.length > 0 ? allRevenue / completed.length : 0);

      // Top 5 items by quantity (all time)
      const itemMap: Record<string, number> = {};
      for (const order of orders) {
        const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          if (!item.name) continue;
          itemMap[item.name] = (itemMap[item.name] ?? 0) + (item.quantity ?? 1);
        }
      }
      const sorted = Object.entries(itemMap)
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5);
      setTopItems(sorted);

      // 14-day bar chart
      const buckets: DayBucket[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
        const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const dayOrders = orders.filter((o) => {
          const t = new Date(o.created_at);
          return t >= dayStart && t <= dayEnd;
        });
        const dayRevenue = dayOrders
          .filter((o) => o.status === "picked_up")
          .reduce((s, o) => s + (o.total ?? 0), 0);
        buckets.push({ label, date: d.toISOString().slice(0, 10), count: dayOrders.length, revenue: dayRevenue });
      }
      setChartData(buckets);

      // Recent 10
      setRecentOrders(orders.slice(0, 10));
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to load analytics");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Loading analytics...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 text-center">
      <div>
        <p className="font-bold text-neutral-800 mb-2">Could not load analytics</p>
        <p className="text-sm text-neutral-500 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); loadAnalytics(); }}
          className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4">
        <h1 className="text-lg font-bold text-neutral-800">Revenue &amp; Analytics</h1>
        <p className="text-sm text-neutral-400">Your truck&apos;s performance overview</p>
      </div>

      <div className="p-4 flex flex-col gap-5 max-w-2xl mx-auto pb-10">

        {/* Data cap warning */}
        {dataCapped && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-500 text-lg flex-shrink-0">⚠️</span>
            <p className="text-sm text-amber-700 font-medium">
              Revenue figures are based on your most recent 5,000 orders. Totals may be understated if you have more orders than that.
            </p>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "All-Time Revenue", value: fmt(totalRevenue), sub: "completed orders" },
            { label: "This Week", value: fmt(weekRevenue), sub: "last 7 days" },
            { label: "This Month", value: fmt(monthRevenue), sub: "last 30 days" },
            { label: "Avg Order Value", value: fmt(avgOrderValue), sub: `${totalOrders} total orders` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-neutral-400 font-medium mb-1">{label}</p>
              <p className="text-2xl font-black text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Orders per day chart — last 14 days */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-1">Orders Per Day</p>
          <p className="text-xs text-neutral-400 mb-4">Last 14 days</p>
          {chartData.every((d) => d.count === 0) ? (
            <div className="h-40 flex flex-col items-center justify-center gap-2">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
              </svg>
              <p className="text-sm text-neutral-400">No orders in the last 14 days</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-1 h-40">
                {chartData.map((d) => {
                  const pct = Math.round((d.count / maxCount) * 100);
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-neutral-900 text-white text-[10px] font-semibold px-2 py-1 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {d.count} order{d.count !== 1 ? "s" : ""}<br />{fmt(d.revenue)}
                      </div>
                      <div
                        className="w-full rounded-t-md transition-all"
                        style={{
                          height: `${Math.max(pct, 2)}%`,
                          backgroundColor: d.count > 0 ? "#E8481C" : "#f0f0f0",
                          minHeight: "4px",
                        }}
                      />
                      <span className="text-[8px] text-neutral-400 rotate-45 origin-left translate-y-2 whitespace-nowrap hidden sm:block">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* X axis labels — last 7 shown on mobile */}
              <div className="flex gap-1 mt-4 sm:hidden">
                {chartData.filter((_, i) => i % 2 === 0).map((d) => (
                  <div key={d.date} className="flex-1 text-center text-[8px] text-neutral-400">{d.label}</div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top 5 items */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-4">Top Selling Items</p>
          {topItems.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">No order data yet</p>
          ) : (
            <div className="flex flex-col gap-3">
              {topItems.map(({ name, qty }, i) => {
                const maxQty = topItems[0].qty;
                const pct = Math.round((qty / maxQty) * 100);
                return (
                  <div key={name} className="flex items-center gap-3">
                    <span className="text-xs font-black text-neutral-400 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-neutral-800 truncate mr-2">{name}</span>
                        <span className="text-xs font-bold text-neutral-500 flex-shrink-0">{qty} sold</span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#E8481C" : "#F5A623" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-sm font-bold text-neutral-800 mb-4">Recent Orders</p>
          {recentOrders.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">No orders yet</p>
          ) : (
            <div className="flex flex-col divide-y divide-neutral-50">
              {recentOrders.map((order) => {
                const items: OrderItem[] = Array.isArray(order.items) ? order.items : [];
                const statusColors: Record<string, string> = {
                  pending: "text-amber-600 bg-amber-50",
                  preparing: "text-blue-600 bg-blue-50",
                  ready: "text-green-600 bg-green-50",
                  picked_up: "text-neutral-400 bg-neutral-100",
                };
                const color = statusColors[order.status] ?? "text-neutral-400 bg-neutral-100";
                return (
                  <div key={order.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-neutral-800 truncate">
                          {order.pickup_name ?? "Customer"}
                        </p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${color}`}>
                          {order.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400">
                        {items.map((it) => `${it.quantity}× ${it.name}`).join(", ")}
                      </p>
                      <p className="text-xs text-neutral-300 mt-0.5">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <p className="font-black text-brand-red text-sm flex-shrink-0">
                      {fmt(order.total ?? 0)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
