"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Status = "idle" | "locating" | "live" | "error";

export default function GoLivePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);

  async function broadcastLocation(lat: number, lng: number, place: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");

    const { data: truck } = await supabase
      .from("trucks")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!truck) throw new Error("No truck found");

    await supabase.from("locations").upsert(
      {
        truck_id: truck.id,
        lat,
        lng,
        address: place,
        broadcasted_at: new Date().toISOString(),
      },
      { onConflict: "truck_id" }
    );

    await supabase
      .from("trucks")
      .update({ is_live: true })
      .eq("id", truck.id);

    setAddress(place);
    setStatus("live");
  }

  async function geocode(lat: number, lng: number): Promise<string> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`
      );
      const data = await res.json();
      return data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  }

  async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; place: string } | null> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) throw new Error("Map service not configured. Please enter GPS coordinates (lat, lng).");
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}`
    );
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error("Address not found. Try being more specific.");
    return { lat: feature.center[1], lng: feature.center[0], place: feature.place_name };
  }

  async function goLiveGPS() {
    setStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const place = await geocode(lat, lng);
          await broadcastLocation(lat, lng, place);
        } catch (err: any) {
          setError(err.message ?? "Something went wrong");
          setStatus("error");
        }
      },
      () => {
        setError("Could not get your location.");
        setStatus("idle");
        setShowManual(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function goLiveManual() {
    if (!manualAddress.trim()) return;
    setStatus("locating");
    setError(null);

    try {
      const result = await geocodeAddress(manualAddress);
      if (!result) throw new Error("Address not found.");
      await broadcastLocation(result.lat, result.lng, result.place);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  async function goOffline() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: truck } = await supabase
      .from("trucks")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (truck) {
      await supabase
        .from("trucks")
        .update({ is_live: false })
        .eq("id", truck.id);
    }

    setStatus("idle");
    setAddress(null);
    setManualAddress("");
    setShowManual(false);
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

      {/* Back button */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-800 text-sm font-medium transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Dashboard
        </button>
      </div>

      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-2xl font-bold text-neutral-800">Go Live</h1>
        <p className="text-neutral-500 text-sm mt-1">Broadcast your location</p>
      </div>

      {/* IDLE STATE */}
      {status === "idle" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <button
            onClick={goLiveGPS}
            className="w-64 h-64 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform shadow-2xl"
            style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.4)" }}
          >
            <span className="text-2xl font-bold">Go Live</span>
            <span className="text-sm opacity-80">at my location</span>
          </button>

          <button
            onClick={() => setShowManual(!showManual)}
            className="text-sm text-neutral-400 hover:text-neutral-600"
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

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}
        </div>
      )}

      {/* LOCATING STATE */}
      {status === "locating" && (
        <div className="w-64 h-64 rounded-full bg-neutral-200 flex flex-col items-center justify-center gap-3 animate-pulse">
          <span className="text-xl font-bold text-neutral-600">Finding you...</span>
        </div>
      )}

      {/* LIVE STATE */}
      {status === "live" && (
        <div className="flex flex-col items-center gap-6">
          <div
            className="w-64 h-64 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-3"
            style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.4)" }}
          >
            <span className="relative flex h-6 w-6 mb-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-6 w-6 bg-red-200" />
            </span>
            <span className="text-2xl font-bold">You're Live!</span>
            <span className="text-xs opacity-80 text-center px-6">{address}</span>
          </div>
          <button
            onClick={goOffline}
            className="px-6 py-3 rounded-full border-2 border-neutral-300 text-neutral-600 font-semibold text-sm"
          >
            Go Offline
          </button>
        </div>
      )}

      {/* ERROR STATE */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-6">
          <div className="w-64 h-64 rounded-full bg-neutral-100 border-2 border-red-200 flex flex-col items-center justify-center gap-3 text-center px-8">
            <span className="text-sm text-neutral-500">{error}</span>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="px-6 py-3 rounded-full bg-brand-red text-white font-semibold text-sm"
          >
            Try Again
          </button>
        </div>
      )}

    </div>
  );
}
