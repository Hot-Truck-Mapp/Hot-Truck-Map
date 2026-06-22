"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Status = "idle" | "locating" | "live" | "going-offline" | "error";
type ErrorSource = "go-live" | "go-offline";

export default function GoLivePage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<ErrorSource>("go-live");
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Auth guard — operators only (verified via DB ownership, not user-editable metadata)
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!mountedRef.current) return;
        if (!user) { router.replace("/"); return; }
        // Check DB: if the user owns a truck they are an operator
        const { data: truck } = await supabase
          .from("trucks")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (!mountedRef.current) return;
        if (!truck) { router.replace("/"); return; }
        setAuthChecking(false);
      } catch {
        if (mountedRef.current) router.replace("/");
      }
    }
    checkAuth();
  }, [router]);

  async function broadcastLocation(lat: number, lng: number, place: string) {
    // Validate coordinates — guard against 0,0 (GPS glitch) and out-of-range values
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180 ||
        (lat === 0 && lng === 0)) {
      throw new Error("Invalid GPS location received. Please try again or enter your address manually.");
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");

    const { data: truck } = await supabase
      .from("trucks")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (!truck) throw new Error("No truck found — finish setting up your profile first.");

    const { error: upsertError } = await supabase.from("locations").upsert(
      {
        truck_id: truck.id,
        lat,
        lng,
        address: place.slice(0, 300), // cap geocoded addresses to prevent oversized writes
        broadcasted_at: new Date().toISOString(),
      },
      { onConflict: "truck_id" }
    );

    if (upsertError) throw new Error(upsertError.message);

    const { data: truckData, error: updateError } = await supabase
      .from("trucks")
      .update({ is_live: true })
      .eq("id", truck.id)
      .select("name")
      .single();

    if (updateError) throw new Error(updateError.message);

    if (!mountedRef.current) return;
    setAddress(place);
    setStatus("live");

    // Non-blocking — notify followers without affecting go-live UX
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      fetch("/api/notify-followers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ truck_id: truck.id, truck_name: truckData?.name }),
      }).catch(() => {});
    }
  }

  async function geocode(lat: number, lng: number): Promise<string> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`
      );
      if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
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
    if (!res.ok) throw new Error(`Location service error (${res.status}) — please try again.`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error("Address not found. Try being more specific.");
    return { lat: feature.center[1], lng: feature.center[0], place: feature.place_name };
  }

  async function goLiveGPS() {
    if (status !== "idle") return; // in-flight guard
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser. Please enter your address manually.");
      setShowManual(true);
      return;
    }

    setStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const place = await geocode(lat, lng);
          await broadcastLocation(lat, lng, place);
        } catch (err: any) {
          if (!mountedRef.current) return;
          setError(err.message ?? "Something went wrong");
          setStatus("error");
        }
      },
      () => {
        if (!mountedRef.current) return;
        setError("Could not get your location.");
        setStatus("idle");
        setShowManual(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function goLiveManual() {
    if (status !== "idle") return; // in-flight guard
    if (!manualAddress.trim()) return;
    setStatus("locating");
    setError(null);

    try {
      const result = await geocodeAddress(manualAddress);
      if (!result) throw new Error("Address not found.");
      await broadcastLocation(result.lat, result.lng, result.place);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err.message ?? "Something went wrong");
      setStatus("error");
    }
  }

  async function goOffline() {
    setStatus("going-offline");
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setStatus("live"); return; }

      const { data: truck } = await supabase
        .from("trucks")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!truck) {
        // Truck lookup failed — warn operator they may still be live
        if (!mountedRef.current) return;
        setError("Could not find your truck. You may still be live — tap Try Again.");
        setErrorSource("go-offline");
        setStatus("error");
        return;
      }

      const { error: updateErr } = await supabase
        .from("trucks")
        .update({ is_live: false })
        .eq("id", truck.id)
        .eq("owner_id", user.id);
      if (updateErr) {
        if (!mountedRef.current) return;
        setError("Failed to go offline. You may still be live — tap Try Again.");
        setErrorSource("go-offline");
        setStatus("error");
        return;
      }

      if (!mountedRef.current) return;
      setStatus("idle");
      setAddress(null);
      setManualAddress("");
      setShowManual(false);
    } catch {
      if (!mountedRef.current) return;
      setError("Connection error. You may still be live — tap Try Again.");
      setErrorSource("go-offline");
      setStatus("error");
    }
  }

  // Don't render until auth check completes — prevents operator-only UI flashing to unauthenticated users
  if (authChecking) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

      {/* Back button */}
      <div className="absolute top-4 left-4">
        <button
          onClick={() => router.push("/dashboard")}
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
                onKeyDown={(e) => e.key === "Enter" && status === "idle" && goLiveManual()}
                placeholder="e.g. 123 Main St, Newark, NJ"
                maxLength={200}
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

      {/* LIVE STATE (also covers going-offline transition) */}
      {(status === "live" || status === "going-offline") && (
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
            disabled={status === "going-offline"}
            className="px-8 py-3 rounded-full bg-neutral-800 text-white font-black text-sm uppercase tracking-wide hover:bg-neutral-700 active:scale-95 transition-all disabled:opacity-50"
          >
            {status === "going-offline" ? "Going Offline…" : "Go Offline"}
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
            onClick={() => errorSource === "go-offline" ? goOffline() : setStatus("idle")}
            className="px-8 py-3 rounded-full bg-brand-red text-white font-black text-sm uppercase tracking-wide hover:bg-brand-red-dark active:scale-95 transition-all"
          >
            {errorSource === "go-offline" ? "Try Going Offline Again" : "Try Again"}
          </button>
        </div>
      )}

    </div>
  );
}
