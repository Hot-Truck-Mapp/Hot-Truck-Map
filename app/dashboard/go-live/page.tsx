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

    const { error: upsertError } = await supabase.from("locations").upsert(
      {
        truck_id: truck.id,
        lat,
        lng,
        address: place,
        broadcasted_at: new Date().toISOString(),
      },
      { onConflict: "truck_id" }
    );

    if (upsertError) throw new Error(upsertError.message);

    const { error: updateError } = await supabase
      .from("trucks")
      .update({ is_live: true })
      .eq("id", truck.id);

    if (updateError) throw new Error(updateError.message);

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
      const { error } = await supabase
        .from("trucks")
        .update({ is_live: false })
        .eq("id", truck.id);
      if (error) {
        setError(error.message);
        return;
      }
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
        <h1 className="text-2xl font-black text-neutral-800 uppercase tracking-wide">Go Live</h1>
        <p className="text-neutral-500 text-sm mt-1">Broadcast your location to customers</p>
      </div>

      {/* IDLE STATE */}
      {status === "idle" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <button
            onClick={goLiveGPS}
            className="w-64 h-64 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
            style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.4)" }}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            <span className="text-2xl font-black uppercase tracking-wide">Go Live</span>
            <span className="text-sm opacity-80">Tap to broadcast location</span>
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors bg-white"
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
        <div className="w-64 h-64 rounded-full bg-neutral-100 border-4 border-neutral-200 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" />
          <div className="text-center">
            <span className="text-base font-black text-neutral-700 uppercase tracking-wide block">Finding you...</span>
            <span className="text-xs text-neutral-400 mt-1 block">Getting your GPS location</span>
          </div>
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
            <span className="text-2xl font-black uppercase tracking-wide">You're Live!</span>
            <span className="text-xs opacity-80 text-center px-6 leading-relaxed">{address}</span>
          </div>
          <button
            onClick={goOffline}
            className="px-8 py-3 rounded-full bg-neutral-800 text-white font-black text-sm uppercase tracking-wide hover:bg-neutral-700 active:scale-95 transition-all"
          >
            Go Offline
          </button>
        </div>
      )}

      {/* ERROR STATE */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-6">
          <div className="w-64 h-64 rounded-full bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center gap-3 text-center px-8">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-1">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <span className="text-sm font-semibold text-neutral-700 leading-relaxed">{error}</span>
          </div>
          <button
            onClick={() => setStatus("idle")}
            className="px-8 py-3 rounded-full bg-brand-red text-white font-black text-sm uppercase tracking-wide hover:bg-brand-red-dark active:scale-95 transition-all"
          >
            Try Again
          </button>
        </div>
      )}

    </div>
  );
}
