"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [followed, setFollowed] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trucks" | "orders" | "settings">("trucks");
  const [notifications, setNotifications] = useState({
    go_live_alerts: true,
    moved_alerts: true,
    weekly_digest: false,
  });
  const [notifUserId, setNotifUserId] = useState<string | null>(null);

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUser(user);
    setNotifUserId(user.id);

    // Load persisted notification preferences (if row doesn't exist yet, defaults are fine)
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("go_live_alerts, moved_alerts, weekly_digest")
      .eq("user_id", user.id)
      .single();

    if (prefs) {
      setNotifications({
        go_live_alerts: prefs.go_live_alerts,
        moved_alerts: prefs.moved_alerts,
        weekly_digest: prefs.weekly_digest,
      });
    }

    const { data: follows } = await supabase
      .from("follows")
      .select("truck_id, trucks(*)")
      .eq("user_id", user.id);

    const { data: orderData } = await supabase
      .from("orders")
      .select("*, trucks(name)")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    setFollowed(follows ?? []);
    setOrders(orderData ?? []);
    setLoading(false);
  }

  async function unfollowTruck(truckId: string) {
    const supabase = createClient();
    await supabase
      .from("follows")
      .delete()
      .eq("truck_id", truckId)
      .eq("user_id", user.id);
    setFollowed(followed.filter((f) => f.truck_id !== truckId));
  }

  async function saveNotifPref(
    key: keyof typeof notifications,
    value: boolean
  ) {
    const next = { ...notifications, [key]: value };
    setNotifications(next);
    if (!notifUserId) return;
    const supabase = createClient();
    await supabase.from("notification_preferences").upsert(
      { user_id: notifUserId, ...next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading account...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-neutral-400 text-xl">←</Link>
            <h1 className="text-lg font-bold text-neutral-800">My Account</h1>
          </div>
          <button
            onClick={signOut}
            className="text-xs text-neutral-400 hover:text-neutral-600"
          >
            Sign Out
          </button>
        </div>
        <p className="text-sm text-neutral-400 ml-8">{user?.email}</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-100">
        <div className="flex">
          {[
            { id: "trucks", label: "Following", count: followed.length },
            { id: "orders", label: "Orders", count: orders.length },
            { id: "settings", label: "Settings", count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "text-brand-red border-b-2 border-brand-red"
                  : "text-neutral-400"
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-1 text-xs">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">

        {/* Following Tab */}
        {activeTab === "trucks" && (
          <div className="flex flex-col gap-3">
            {followed.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-neutral-500 font-medium">
                  No followed trucks yet
                </p>
                <p className="text-neutral-400 text-sm mt-1">
                  Follow trucks to get notified when they go live
                </p>
                <Link
                  href="/"
                  className="inline-block mt-4 px-4 py-2 bg-brand-red text-white rounded-full text-sm font-semibold"
                >
                  Find Trucks
                </Link>
              </div>
            ) : (
              followed.map((follow) => {
                const truck = follow.trucks;
                return (
                  <div
                    key={follow.truck_id}
                    className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3"
                  >
                    <div className="w-12 h-12 rounded-full bg-neutral-100 overflow-hidden flex-shrink-0">
                      {truck?.profile_photo ? (
                        <img
                          src={truck.profile_photo}
                          alt={truck.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                            <path d="M1 3h15v13H1z"/>
                            <path d="M16 8h4l3 3v5h-7V8z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/>
                            <circle cx="18.5" cy="18.5" r="2.5"/>
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-neutral-800 truncate">
                        {truck?.name}
                      </p>
                      <p className="text-xs text-brand-red font-medium">
                        {truck?.cuisine}
                      </p>
                      {truck?.is_live && (
                        <span className="text-[10px] font-bold text-green-600">
                          LIVE NOW
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={"/truck/" + follow.truck_id}
                        className="px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-full"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => unfollowTruck(follow.truck_id)}
                        className="px-3 py-1.5 bg-neutral-100 text-neutral-500 text-xs font-semibold rounded-full"
                      >
                        Unfollow
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="flex flex-col gap-3">
            {orders.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-neutral-500 font-medium">No orders yet</p>
                <p className="text-neutral-400 text-sm mt-1">
                  Your order history will appear here
                </p>
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-sm p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-neutral-800">
                        {order.trucks?.name}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-red">
                        ${order.total?.toFixed(2)}
                      </p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        order.status === "picked_up"
                          ? "bg-green-50 text-green-600"
                          : order.status === "ready"
                          ? "bg-blue-50 text-blue-600"
                          : order.status === "preparing"
                          ? "bg-yellow-50 text-yellow-600"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {order.status?.replace("_", " ").toUpperCase()}
                      </span>
                    </div>
                  </div>
                  {order.items?.map((item: any, i: number) => (
                    <p key={i} className="text-xs text-neutral-400">
                      x{item.quantity} {item.name}
                    </p>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">

            {/* Notifications */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-bold text-neutral-800 mb-4">
                Notifications
              </p>
              <div className="flex flex-col gap-4">
                <NotificationRow
                  label="Go-live alerts"
                  description="When a followed truck opens near you"
                  value={notifications.go_live_alerts}
                  onChange={(v) => saveNotifPref("go_live_alerts", v)}
                />
                <NotificationRow
                  label="Location updates"
                  description="When a followed truck moves to a new spot"
                  value={notifications.moved_alerts}
                  onChange={(v) => saveNotifPref("moved_alerts", v)}
                />
                <NotificationRow
                  label="Weekly digest"
                  description="Sunday roundup of your followed trucks"
                  value={notifications.weekly_digest}
                  onChange={(v) => saveNotifPref("weekly_digest", v)}
                />
                <p className="text-xs text-neutral-400 pt-1">
                  You can turn off all alerts at any time. We'll never spam you.
                </p>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-sm font-bold text-neutral-800 mb-3">
                Account
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">Email</p>
                  <p className="text-sm text-neutral-400">{user?.email}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-neutral-600">Member since</p>
                  <p className="text-sm text-neutral-400">
                    {new Date(user?.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Sign Out */}
            <button
              onClick={signOut}
              className="w-full py-4 border-2 border-neutral-200 text-neutral-600 rounded-2xl font-semibold text-sm"
            >
              Sign Out
            </button>

          </div>
        )}
      </div>
    </div>
  );
}

function NotificationRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-700">{label}</p>
        <p className="text-xs text-neutral-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? "bg-brand-red" : "bg-neutral-200"
        }`}
      >
        <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
          value ? "translate-x-6" : "translate-x-0"
        }`} />
      </button>
    </div>
  );
}