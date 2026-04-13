"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Status = "idle" | "locating" | "live" | "error";

export default function OperatorDashboard() {
  const [truckName, setTruckName] = useState("");
  const [truckId, setTruckId] = useState<string | null>(null);
  const [stats, setStats] = useState({ followers: 0, ordersToday: 0, viewsThisWeek: 0 });
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<Status>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: truck } = await supabase
      .from("trucks")
      .select("id, name, is_live")
      .eq("owner_id", user.id)
      .single();

    if (!truck) {
      setLoading(false);
      return;
    }

    setTruckId(truck.id);
    setTruckName(truck.name ?? "");
    if (truck.is_live) setStatus("live");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [{ count: followers }, { data: todayOrders }, { count: weekViews }] = await Promise.all([
      supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("truck_id", truck.id),
      supabase
        .from("orders")
        .select("id")
        .eq("truck_id", truck.id)
        .gte("created_at", today.toISOString()),
      supabase
        .from("truck_views")
        .select("*", { count: "exact", head: true })
        .eq("truck_id", truck.id)
        .gte("created_at", weekAgo.toISOString()),
    ]);

    setStats({
      followers: followers ?? 0,
      ordersToday: todayOrders?.length ?? 0,
      viewsThisWeek: weekViews ?? 0,
    });

    setLoading(false);
  }

  async function broadcastLocation(lat: number, lng: number, place: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !truckId) throw new Error("Not logged in");

    await supabase.from("locations").upsert(
      { truck_id: truckId, lat, lng, address: place, broadcasted_at: new Date().toISOString() },
      { onConflict: "truck_id" }
    );

    await supabase.from("trucks").update({ is_live: true }).eq("id", truckId);

    setAddress(place);
    setStatus("live");
  }

  async function goLiveGPS() {
    setStatus("locating");
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const geo = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
          );
          const geoData = await geo.json();
          const place = geoData.features?.[0]?.place_name ?? "Unknown location";
          await broadcastLocation(lat, lng, place);
        } catch (err: any) {
          setLocationError(err.message ?? "Something went wrong");
          setStatus("error");
        }
      },
      () => {
        setLocationError("Could not get your location.");
        setStatus("idle");
        setShowManual(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function goLiveManual() {
    if (!manualAddress.trim()) return;
    setStatus("locating");
    setLocationError(null);

    try {
      const query = encodeURIComponent(manualAddress);
      const geo = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
      );
      const geoData = await geo.json();
      const feature = geoData.features?.[0];
      if (!feature) throw new Error("Address not found. Try being more specific.");

      const [lng, lat] = feature.center;
      await broadcastLocation(lat, lng, feature.place_name);
    } catch (err: any) {
      setLocationError(err.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  async function goOffline() {
    if (!truckId) return;
    const supabase = createClient();
    await supabase.from("trucks").update({ is_live: false }).eq("id", truckId);
    setStatus("idle");
    setAddress(null);
    setManualAddress("");
    setShowManual(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-800">
            {truckName || "Operator Dashboard"}
          </h1>
          <p className="text-sm text-neutral-400">Operator Dashboard</p>
        </div>
        <Link
          href="/dashboard/profile"
          className="text-sm text-brand-red font-semibold"
        >
          Edit Profile
        </Link>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Followers" value={stats.followers} />
          <StatCard label="Orders Today" value={stats.ordersToday} />
          <StatCard label="Views This Week" value={stats.viewsThisWeek} />
        </div>

        {/* Go Live Section */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center gap-4">

          {status === "idle" && (
            <>
              <button
                onClick={goLiveGPS}
                className="w-56 h-56 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.35)" }}
              >
                <span className="text-2xl font-bold">Go Live</span>
                <span className="text-sm opacity-80">at my location</span>
              </button>

              <button
                onClick={() => setShowManual(!showManual)}
                className="text-sm text-neutral-400"
              >
                {showManual ? "Hide manual entry" : "GPS not working? Enter address"}
              </button>

              {showManual && (
                <div className="w-full flex flex-col gap-2">
                  <input
                    type="text"
                    value={manualAddress}
                    onChange={(e) => setManualAddress(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && goLiveManual()}
                    placeholder="e.g. 123 Main St, Newark, NJ"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none"
                  />
                  <button
                    onClick={goLiveManual}
                    disabled={!manualAddress.trim()}
                    className="w-full py-3 rounded-xl bg-brand-red text-white font-semibold text-sm disabled:opacity-40"
                  >
                    Go Live at This Address
                  </button>
                </div>
              )}

              {locationError && (
                <p className="text-sm text-red-500 text-center">{locationError}</p>
              )}
            </>
          )}

          {status === "locating" && (
            <div className="w-56 h-56 rounded-full bg-neutral-100 flex flex-col items-center justify-center gap-3 animate-pulse">
              <span className="text-xl font-bold text-neutral-500">Finding you...</span>
            </div>
          )}

          {status === "live" && (
            <>
              <div
                className="w-56 h-56 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-3"
                style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.35)" }}
              >
                <span className="relative flex h-5 w-5 mb-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-200" />
                </span>
                <span className="text-xl font-bold">You're Live!</span>
                {address && (
                  <span className="text-xs opacity-80 text-center px-6">{address}</span>
                )}
              </div>
              <button
                onClick={goOffline}
                className="px-6 py-3 rounded-full border-2 border-neutral-300 text-neutral-600 font-semibold text-sm"
              >
                Go Offline
              </button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-56 h-56 rounded-full bg-neutral-100 border-2 border-red-100 flex flex-col items-center justify-center gap-3 text-center px-8">
                <span className="text-sm text-neutral-500">{locationError}</span>
              </div>
              <button
                onClick={() => { setStatus("idle"); setLocationError(null); }}
                className="px-6 py-3 rounded-full bg-brand-red text-white font-semibold text-sm"
              >
                Try Again
              </button>
            </>
          )}
        </div>

        {/* Social Sync Placeholder */}
        <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
            <svg
              width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              strokeLinejoin="round" className="text-neutral-400"
            >
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <circle cx="12" cy="12" r="4"/>
              <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-neutral-700">Auto Instagram Sync</p>
            <p className="text-xs text-neutral-400">
              Your location will post to Instagram at go-live
            </p>
          </div>
          <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-1 rounded-full">
            Phase 5
          </span>
        </div>

        {/* Nav Grid */}
        <div className="grid grid-cols-2 gap-3">
          <NavCard href="/dashboard/menu" title="Menu Manager" subtitle="Items, photos, prices" />
          <NavCard href="/dashboard/schedule" title="Schedule" subtitle="Plan your week" />
          <NavCard href="/dashboard/profile" title="Truck Profile" subtitle="Name, cuisine, photos" />
          <NavCard href="/dashboard/analytics" title="Analytics" subtitle="Followers & orders" />
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 flex flex-col items-center text-center">
      <p className="text-2xl font-bold text-neutral-800">{value.toLocaleString()}</p>
      <p className="text-[10px] text-neutral-500 font-medium mt-0.5 leading-tight">{label}</p>
    </div>
  );
}

function NavCard({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <a
      href={href}
      className="bg-white rounded-2xl shadow-sm p-4 flex flex-col gap-1 active:bg-neutral-50 transition-colors"
    >
      <p className="font-bold text-neutral-800 text-sm">{title}</p>
      <p className="text-xs text-neutral-400">{subtitle}</p>
    </a>
  );
}
