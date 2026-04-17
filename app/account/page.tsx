"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function AccountPage() {
  const [user, setUser] = useState<any>(null);
  const [followed, setFollowed] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"trucks" | "orders" | "settings">("trucks");
  const [notifications, setNotifications] = useState({
    newLocation: true,
    orderReady: true,
    weeklyDigest: false,
  });
  const [savingNotif, setSavingNotif] = useState(false);

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    const supabase = createClient();
    const { data: { user: userData } } = await supabase.auth.getUser();
    if (!userData) {
      window.location.href = "/login";
      return;
    }
    setUser(userData);

    const { data: follows } = await supabase
      .from("follows")
      .select("truck_id, trucks(*)")
      .eq("user_id", userData.id);

    const { data: orderData } = await supabase
      .from("orders")
      .select("*, trucks(name)")
      .eq("customer_id", userData.id)
      .order("created_at", { ascending: false })
      .limit(20);

    setFollowed(follows ?? []);
    setOrders(orderData ?? []);

    // Load saved notification preferences from user metadata
    const saved = userData.user_metadata?.notifications;
    if (saved) setNotifications(saved);

    setLoading(false);
  }

  async function updateNotification(key: keyof typeof notifications, value: boolean) {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    setSavingNotif(true);
    const supabase = createClient();
    await supabase.auth.updateUser({ data: { notifications: updated } });
    setSavingNotif(false);
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

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Loading account...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-neutral-900 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <div>
            <h1 className="font-black text-white text-base">My Account</h1>
            <p className="text-neutral-500 text-xs">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-xs font-semibold text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-neutral-100">
        <div className="flex">
          {[
            { id: "trucks", label: "Favorites", count: followed.length },
            { id: "orders", label: "Orders", count: orders.length },
            { id: "settings", label: "Settings", count: null },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                activeTab === tab.id
                  ? "text-brand-red border-b-2 border-brand-red"
                  : "text-neutral-400"
              }`}
            >
              {tab.id === "trucks" && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill={activeTab === "trucks" ? "#E8481C" : "none"} stroke={activeTab === "trucks" ? "#E8481C" : "#aaa"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              )}
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? "bg-red-100 text-brand-red" : "bg-neutral-100 text-neutral-400"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 max-w-lg mx-auto">

        {/* Favorites Tab */}
        {activeTab === "trucks" && (
          <div className="flex flex-col gap-3">
            {followed.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </div>
                <p className="text-neutral-800 font-black text-lg">No favorites yet</p>
                <p className="text-neutral-400 text-sm mt-1 max-w-xs mx-auto">
                  Tap the ♥ on any food truck to save it here and get notified when it goes live
                </p>
                <Link
                  href="/trucks"
                  className="inline-block mt-5 px-6 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold"
                >
                  Browse Trucks
                </Link>
              </div>
            ) : (
              followed.map((follow) => {
                const truck = follow.trucks;
                return (
                  <div
                    key={follow.truck_id}
                    className="bg-white rounded-2xl shadow-sm overflow-hidden"
                  >
                    {/* Photo banner */}
                    <div className="w-full h-28 bg-neutral-100 relative">
                      {truck?.profile_photo ? (
                        <Image src={truck.profile_photo} alt={truck.name ?? ""} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-100">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M1 3h15v13H1z"/>
                            <path d="M16 8h4l3 3v5h-7V8z"/>
                            <circle cx="5.5" cy="18.5" r="2.5"/>
                            <circle cx="18.5" cy="18.5" r="2.5"/>
                          </svg>
                        </div>
                      )}
                      {/* Live badge */}
                      {truck?.is_live && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-brand-red text-white text-[10px] font-black px-2 py-1 rounded-lg tracking-wider">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                          </span>
                          OPEN NOW
                        </div>
                      )}
                      {/* Unfavorite button */}
                      <button
                        onClick={() => unfollowTruck(follow.truck_id)}
                        className="absolute top-2 right-2 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm active:scale-90 transition-all"
                        aria-label="Remove from favorites"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#E8481C" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </button>
                    </div>

                    {/* Info row */}
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-neutral-900 text-sm uppercase tracking-wide truncate">{truck?.name}</p>
                        <p className="text-xs text-brand-red font-bold mt-0.5">{truck?.cuisine ?? "Food Truck"}</p>
                      </div>
                      <Link
                        href={"/truck/" + follow.truck_id}
                        className="flex-shrink-0 px-4 py-2 bg-brand-red text-white text-xs font-bold rounded-full"
                      >
                        {truck?.is_live ? "Order Now →" : "View Menu"}
                      </Link>
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
                <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                </div>
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
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-bold text-neutral-800">Notifications</p>
                {savingNotif && <p className="text-xs text-neutral-400">Saving...</p>}
              </div>
              <div className="flex flex-col gap-4">
                <NotificationRow
                  label="New location alerts"
                  description="When a followed truck goes live"
                  value={notifications.newLocation}
                  onChange={(v) => updateNotification("newLocation", v)}
                />
                <NotificationRow
                  label="Order ready"
                  description="When your order is ready for pickup"
                  value={notifications.orderReady}
                  onChange={(v) => updateNotification("orderReady", v)}
                />
                <NotificationRow
                  label="Weekly digest"
                  description="New trucks and updates in your area"
                  value={notifications.weeklyDigest}
                  onChange={(v) => updateNotification("weeklyDigest", v)}
                />
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