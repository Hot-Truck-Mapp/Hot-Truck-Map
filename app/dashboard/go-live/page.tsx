"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Status = "idle" | "locating" | "live" | "error";

export default function GoLivePage() {
  const [status, setStatus] = useState<Status>("idle");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualAddress, setManualAddress] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [truckName, setTruckName] = useState<string | null>(null);
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [movingStatus, setMovingStatus] = useState<"idle" | "locating" | "done">("idle");

  async function broadcastLocation(lat: number, lng: number, place: string) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not logged in");

    const { data: truck } = await supabase
      .from("trucks")
      .select("id, name")
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

    // Notify followers within 5 miles — fire and forget
    fetch("/api/notifications/go-live", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ truck_id: truck.id, truck_name: truck.name, lat, lng, address: place }),
    });

    setAddress(place);
    setTruckId(truck.id);
    setTruckName(truck.name);
    setLiveCoords({ lat, lng });
    setStatus("live");
  }

  async function goLiveGPS() {
    setStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const geo = await fetch(
            "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
            lng + "," + lat +
            ".json?access_token=" +
            process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          );
          const geoData = await geo.json();
          const place = geoData.features?.[0]?.place_name ?? "Unknown location";
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
      const query = encodeURIComponent(manualAddress);
      const geo = await fetch(
        "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
        query +
        ".json?access_token=" +
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      );
      const geoData = await geo.json();
      const feature = geoData.features?.[0];
      if (!feature) throw new Error("Address not found. Try being more specific.");

      const [lng, lat] = feature.center;
      const place = feature.place_name;
      await broadcastLocation(lat, lng, place);
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
    setTruckId(null);
    setTruckName(null);
    setLiveCoords(null);
    setMovingStatus("idle");
  }

  async function iHaveMoved() {
    if (!truckId || !truckName) return;
    setMovingStatus("locating");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords;
        try {
          const geo = await fetch(
            "https://api.mapbox.com/geocoding/v5/mapbox.places/" +
            lng + "," + lat +
            ".json?access_token=" +
            process.env.NEXT_PUBLIC_MAPBOX_TOKEN
          );
          const geoData = await geo.json();
          const place = geoData.features?.[0]?.place_name ?? "Unknown location";

          const supabase = createClient();
          await supabase.from("locations").upsert(
            {
              truck_id: truckId,
              lat,
              lng,
              address: place,
              broadcasted_at: new Date().toISOString(),
            },
            { onConflict: "truck_id" }
          );

          // Emergency update — notify ALL followers of the new location
          fetch("/api/notifications/moved", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ truck_id: truckId, truck_name: truckName, new_address: place }),
          });

          setAddress(place);
          setLiveCoords({ lat, lng });
          setMovingStatus("done");
          setTimeout(() => setMovingStatus("idle"), 3000);
        } catch {
          setMovingStatus("idle");
        }
      },
      () => setMovingStatus("idle"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6">

      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-2xl font-bold text-neutral-800">HotTruckMap</h1>
        <p className="text-neutral-500 text-sm mt-1">Operator Dashboard</p>
      </div>

      {/* IDLE STATE */}
      {status === "idle" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-xs">
          <button
            onClick={goLiveGPS}
            className="w-64 h-64 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform shadow-2xl"
            style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.4)" }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
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
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
          </svg>
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

          {/* I've Moved — emergency location update */}
          <button
            onClick={iHaveMoved}
            disabled={movingStatus === "locating"}
            className="px-6 py-3 rounded-full bg-white border-2 border-neutral-800 text-neutral-800 font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {movingStatus === "locating" ? (
              <>
                <span className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                Updating location...
              </>
            ) : movingStatus === "done" ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Followers notified
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                I've Moved
              </>
            )}
          </button>

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
          <div className="w-64 h-64 rounded-full bg-neutral-100 border-2 border-red-200 flex flex-col items-center justify-center gap-3 px-8">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span className="text-sm text-center text-neutral-500">{error}</span>
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
