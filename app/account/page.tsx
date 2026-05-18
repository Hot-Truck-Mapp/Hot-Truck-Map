"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { usePushSubscription } from "@/lib/hooks/usePushSubscription";

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
  const [pushToastMsg, setPushToastMsg] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const push = usePushSubscription();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarToast, setAvatarToast] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const avatarToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pushToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unfollowInFlightRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (avatarToastTimerRef.current) clearTimeout(avatarToastTimerRef.current);
      if (pushToastTimerRef.current) clearTimeout(pushToastTimerRef.current);
    };
  }, []);

  function showAvatarToast(msg: string) {
    if (!mountedRef.current) return;
    setAvatarToast(msg);
    if (avatarToastTimerRef.current) clearTimeout(avatarToastTimerRef.current);
    avatarToastTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setAvatarToast(null);
    }, 3500);
  }

  async function uploadAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) { showAvatarToast("Photo must be under 5 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showAvatarToast("Only JPG, PNG, or WebP images are allowed.");
      return;
    }
    if (!user) return;
    setAvatarUploading(true);
    try {
      const supabase = createClient();
      const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt || "jpg";
      const path = `customers/${user.id}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not get photo URL — try again.");
      const { error: updateErr } = await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } });
      if (updateErr) throw new Error("Photo uploaded but failed to save: " + updateErr.message);
      if (mountedRef.current) setAvatarUrl(data.publicUrl);
      showAvatarToast("Profile photo updated!");
    } catch (err: any) { showAvatarToast(err?.message ?? "Photo upload failed"); }
    finally { if (mountedRef.current) setAvatarUploading(false); }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  async function loadAccount() {
    try {
      const supabase = createClient();
      const { data: { user: userData } } = await supabase.auth.getUser();
      if (!userData) return; // show sign-in prompt instead of redirecting

      if (!mountedRef.current) return;
      setUser(userData);
      setAvatarUrl(userData.user_metadata?.avatar_url ?? "");

      const [{ data: follows }, { data: orderData }] = await Promise.all([
        supabase.from("follows").select("truck_id, trucks(id, name, cuisine, profile_photo, is_live, avg_rating)").eq("user_id", userData.id).limit(200),
        supabase.from("orders").select("id, truck_id, pickup_name, items, total, status, created_at, trucks(name)").eq("customer_id", userData.id)
          .order("created_at", { ascending: false }).limit(20),
      ]);

      if (!mountedRef.current) return;
      setFollowed(follows ?? []);
      setOrders(orderData ?? []);

      // Load saved notification preferences from user metadata
      const saved = userData.user_metadata?.notifications;
      if (saved) setNotifications(saved);
    } catch {
      // network error — show sign-in prompt
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function updateNotification(key: keyof typeof notifications, value: boolean) {
    if (savingNotif) return; // prevent concurrent saves
    const prev = notifications;
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    setSavingNotif(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ data: { notifications: updated } });
      if (error) throw new Error(error.message);
    } catch {
      setNotifications(prev); // revert optimistic update on failure
      showAvatarToast("Could not save preference — please try again.");
    } finally {
      setSavingNotif(false);
    }
  }

  async function unfollowTruck(truckId: string) {
    if (unfollowInFlightRef.current.has(truckId)) return; // in-flight guard
    unfollowInFlightRef.current.add(truckId);
    const snapshot = followed; // save before optimistic update
    setFollowed((prev) => prev.filter((f) => f.truck_id !== truckId)); // optimistic
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("truck_id", truckId)
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
    } catch {
      if (mountedRef.current) {
        setFollowed(snapshot); // restore the pre-update list on failure
        showAvatarToast("Could not remove favorite — please try again.");
      }
    } finally {
      unfollowInFlightRef.current.delete(truckId);
    }
  }

  async function signOut() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch { /* ignore — redirect anyway */ }
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

  if (!user) {
    return (
      <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1">
              <span className="font-black text-brand-red text-2xl tracking-tight">HOT</span>
              <span className="font-black text-white text-2xl tracking-tight">TRUCK</span>
            </div>
            <span className="font-black text-brand-orange text-2xl tracking-tight leading-none">MAP</span>
          </div>
        </div>

        <div className="w-full max-w-sm bg-neutral-800 rounded-3xl p-6 flex flex-col gap-4">
          <div className="text-center mb-2">
            <h2 className="text-xl font-black text-white">Sign in to your account</h2>
            <p className="text-neutral-400 text-sm mt-1">Track orders, follow trucks, and more</p>
          </div>

          <Link
            href="/login"
            className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base text-center uppercase tracking-wide"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="w-full py-4 border-2 border-neutral-600 text-white rounded-2xl font-black text-base text-center uppercase tracking-wide"
          >
            Create Account
          </Link>

          <div className="pt-2 border-t border-neutral-700">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-neutral-400 hover:text-white text-sm font-semibold transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
              </svg>
              Back to Map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-neutral-900 px-4 pt-4 pb-6 flex flex-col items-center gap-3 relative">
        {/* Back + Sign out row */}
        <div className="w-full flex items-center justify-between mb-1">
          <Link href="/" aria-label="Back to map" className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <button
            onClick={signOut}
            className="text-xs font-semibold text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </div>

        {/* Avatar */}
        <div className="relative">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-700 flex items-center justify-center relative">
            {avatarUrl ? (
              <Image src={avatarUrl} alt="Profile" fill sizes="80px" className="object-cover" />
            ) : (
              <span className="text-3xl font-black text-white">
                {(user?.email ?? "?")[0].toUpperCase()}
              </span>
            )}
          </div>
          {/* Upload button overlay */}
          <button
            onClick={() => avatarRef.current?.click()}
            disabled={avatarUploading}
            className="absolute bottom-0 right-0 w-7 h-7 bg-brand-red rounded-full flex items-center justify-center shadow-lg border-2 border-neutral-900 hover:bg-red-600 transition-colors"
            title="Change profile photo"
          >
            {avatarUploading ? (
              <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            )}
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAvatar(f); e.target.value = ""; }}
          />
        </div>

        <div className="text-center">
          <h1 className="font-black text-white text-base">My Account</h1>
          <p className="text-neutral-500 text-xs truncate max-w-[200px]">{user?.email}</p>
        </div>

        {/* Avatar toast */}
        {avatarToast && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-neutral-700 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg whitespace-nowrap">
            {avatarToast}
          </div>
        )}
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
                  href="/"
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
                        <Image src={truck.profile_photo} alt={truck.name ?? ""} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
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
                        {order.trucks?.name ?? "Deleted Truck"}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-brand-red">
                        ${(order.total ?? 0).toFixed(2)}
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
                  {order.items?.length > 0
                    ? order.items.map((item: any, i: number) => (
                        <p key={i} className="text-xs text-neutral-400">
                          x{item.quantity} {item.name}
                        </p>
                      ))
                    : <p className="text-xs text-neutral-400">No items</p>
                  }
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

            {/* Push Notifications */}
            {push.supported && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <p className="text-sm font-bold text-neutral-800 mb-1">Push Notifications</p>
                <p className="text-xs text-neutral-400 mb-4">
                  Get notified on this device when a truck you follow goes live.
                </p>
                {push.permission === "denied" ? (
                  <p className="text-xs text-red-500">
                    Notifications are blocked in your browser settings. Please allow them and reload.
                  </p>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-neutral-700">
                        {push.subscribed ? "Enabled on this device" : "Disabled on this device"}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {push.subscribed
                          ? "You'll receive push alerts when followed trucks go live"
                          : "Enable to get instant alerts when followed trucks go live"}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          if (push.subscribed) {
                            await push.unsubscribe();
                            if (mountedRef.current) setPushToastMsg("Push notifications disabled");
                          } else {
                            await push.subscribe();
                            if (mountedRef.current) setPushToastMsg("Push notifications enabled!");
                          }
                        } catch {
                          if (mountedRef.current) setPushToastMsg("Could not update push notifications — try again.");
                        }
                        if (pushToastTimerRef.current) clearTimeout(pushToastTimerRef.current);
                        pushToastTimerRef.current = setTimeout(() => {
                          if (mountedRef.current) setPushToastMsg(null);
                        }, 3500);
                      }}
                      className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                        push.subscribed ? "bg-brand-red" : "bg-neutral-200"
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                          push.subscribed ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                )}
                {pushToastMsg && (
                  <p className="text-xs text-neutral-500 mt-3">{pushToastMsg}</p>
                )}
              </div>
            )}

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