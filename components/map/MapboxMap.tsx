"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { isValidStateCode, stateNameForCode } from "@/lib/us-states";

/** Escape a value for safe insertion into an HTML string. */
function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  trucks: any[];
};

// Fallback center: middle of the continental US — shown only if geolocation
// is denied/unavailable. Never defaults to any single city.
const US_CENTER: [number, number] = [-98.35, 39.5];
const US_ZOOM = 4;
const USER_ZOOM = 13;

type GeoState = "locating" | "granted" | "denied";

/** Reverse-geocodes coordinates to a US state via the Mapbox Geocoding API
 * (same endpoint already used in app/dashboard/page.tsx's reverseGeocode).
 * Fails silently on any error — this only powers a nice-to-have banner. */
async function reverseGeocodeToState(
  lat: number,
  lng: number
): Promise<{ code: string; name: string } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=region&access_token=${token}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const shortCode: string | undefined = data.features?.[0]?.properties?.short_code ?? data.features?.[0]?.short_code;
    if (!shortCode || !shortCode.toUpperCase().startsWith("US-")) return null;
    const code = shortCode.slice(3).toUpperCase();
    if (!isValidStateCode(code)) return null;
    return { code, name: stateNameForCode(code)! };
  } catch {
    return null;
  }
}

export default function MapboxMap({ trucks }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const geolocateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geoState, setGeoState] = useState<GeoState>("locating");
  const [nearbyState, setNearbyState] = useState<{ code: string; name: string } | null>(null);
  const [nearbyBannerDismissed, setNearbyBannerDismissed] = useState(false);

  useEffect(() => {
    if (map.current || !mapboxgl.accessToken || !mapContainer.current) return;
    let mounted = true; // guard geolocation callbacks against post-unmount execution

    function buildMap(center: [number, number], zoom: number) {
      map.current = new mapboxgl.Map({
        container: mapContainer.current!,
        style: "mapbox://styles/mapbox/streets-v12",
        center,
        zoom,
      });

      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true,
        fitBoundsOptions: { maxZoom: USER_ZOOM },
      });

      map.current!.addControl(new mapboxgl.NavigationControl());
      map.current!.addControl(geolocate);

      map.current!.on("load", () => {
        setMapReady(true);
        // Only auto-trigger geolocate when we fell back to the US view
        // (user's position wasn't known yet at init time).
        if (zoom < USER_ZOOM) {
          geolocateTimerRef.current = setTimeout(() => {
            try { geolocate.trigger(); } catch { /* denied — stays at US view */ }
          }, 300);
        }
      });
    }

    // Show the browser's native location permission prompt immediately.
    // While waiting: display the "locating" overlay so the map area isn't blank.
    // Accept cached positions ≤60 s old (maximumAge) so repeat visitors get
    // instant centering without another GPS round-trip.
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!mounted) return; // component unmounted before geolocation resolved
          setGeoState("granted");
          buildMap([pos.coords.longitude, pos.coords.latitude], USER_ZOOM);
          // Fire-and-forget — powers the "Events near you" banner, never blocks the map
          reverseGeocodeToState(pos.coords.latitude, pos.coords.longitude).then((s) => {
            if (mounted && s) setNearbyState(s);
          });
        },
        () => {
          if (!mounted) return;
          // Denied or timed out — build the wide US view, let the user
          // re-enable via the "denied" banner or the GeolocateControl button.
          setGeoState("denied");
          buildMap(US_CENTER, US_ZOOM);
        },
        { timeout: 8000, maximumAge: 60_000, enableHighAccuracy: false }
      );
    } else {
      // Geolocation not supported (very old browsers)
      setGeoState("denied");
      buildMap(US_CENTER, US_ZOOM);
    }

    return () => {
      mounted = false;
      if (geolocateTimerRef.current) clearTimeout(geolocateTimerRef.current);
      markers.current.forEach((m) => m.remove());
      markers.current = [];
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Re-run whenever trucks data changes OR map finishes loading
  useEffect(() => {
    if (!map.current || !mapReady) return;

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    trucks.forEach((truck) => {
      const loc = truck.locations?.[0] ?? truck.location ?? null;
      if (loc?.lat == null || loc?.lng == null) return;
      // Validate coordinates are finite and in range before passing to Mapbox
      const lat = Number(loc.lat);
      const lng = Number(loc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

      const el = document.createElement("div");
      el.style.cssText = `
        width: 44px; height: 44px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
      `;
      el.innerHTML = `
        <div style="
          background: #E8481C; border: 3px solid white;
          border-radius: 50% 50% 50% 0; width: 36px; height: 36px;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(232,72,28,0.45);
          display: flex; align-items: center; justify-content: center;
        ">
          <svg style="transform: rotate(45deg);" width="16" height="16"
            viewBox="0 0 24 24" fill="none" stroke="white"
            stroke-width="2.5" stroke-linecap="round">
            <path d="M1 3h15v13H1z"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
      `;

      // Use the module-level esc() defined at the top of this file.

      const ratingHtml = (truck.avg_rating ?? 0) > 0
        ? `<p style="margin:0 0 6px;font-size:11px;color:#555;display:flex;align-items:center;gap:3px">
            <span style="color:#F5A623">★</span>
            <span style="font-weight:700">${esc(Number(truck.avg_rating).toFixed(1))}</span>
            <span style="color:#aaa">(${esc(String(truck.review_count ?? 0))})</span>
           </p>`
        : "";
      const popup = new mapboxgl.Popup({ offset: 28, closeButton: false }).setHTML(
        `<div style="font-family:sans-serif;padding:4px 2px;min-width:140px">
          <p style="font-weight:800;margin:0 0 2px;font-size:14px;text-transform:uppercase;letter-spacing:0.02em">${esc(truck.name ?? "")}</p>
          <p style="color:#E8481C;margin:0 0 4px;font-size:12px;font-weight:600">${esc(truck.cuisine ?? "Food Truck")}</p>
          ${ratingHtml}
          ${truck.is_live ? '<p style="color:#16a34a;font-size:11px;font-weight:700;margin:0 0 6px">● OPEN NOW</p>' : ""}
          <a href="/truck/${esc(truck.id)}" style="display:block;background:#E8481C;color:white;text-align:center;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none;">View Profile</a>
        </div>`
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [trucks, mapReady]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div style={{ width: "100%", height: "100%" }}
        className="bg-neutral-800 flex flex-col items-center justify-center gap-3">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <p className="text-neutral-500 text-sm">Map unavailable — add NEXT_PUBLIC_MAPBOX_TOKEN</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>

      {/* Map canvas — always mounted so Mapbox can attach to the DOM node */}
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* ── "Finding your location" splash — shown while the browser prompt is pending ── */}
      {geoState === "locating" && (
        <div
          style={{ position: "absolute", inset: 0, zIndex: 10 }}
          className="bg-neutral-900/90 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-6"
        >
          {/* Pulsing pin icon */}
          <div className="relative flex items-center justify-center">
            <span className="absolute w-20 h-20 rounded-full bg-brand-red/20 animate-ping" />
            <div className="w-16 h-16 rounded-full bg-brand-red flex items-center justify-center shadow-lg shadow-brand-red/40">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
          </div>

          <div className="text-center">
            <p className="text-white font-black text-xl uppercase tracking-wide">
              Finding trucks near you
            </p>
            <p className="text-neutral-400 text-sm mt-1">
              Allow location access when your browser asks
            </p>
          </div>
        </div>
      )}

      {/* ── Location denied banner — shown inside the map so user knows what happened ── */}
      {geoState === "denied" && (
        <div
          style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
          className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-xl max-w-xs w-[calc(100%-32px)]"
        >
          <svg className="flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">Location access blocked</p>
            <p className="text-[11px] text-neutral-400 leading-snug mt-0.5">
              Click the lock icon in your browser&apos;s address bar to enable, then refresh.
            </p>
          </div>
        </div>
      )}

      {/* ── "Events near you" banner — shown once we've resolved the user's state ── */}
      {geoState === "granted" && nearbyState && !nearbyBannerDismissed && (
        <div
          style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 10 }}
          className="flex items-center gap-3 bg-neutral-900/90 backdrop-blur-sm text-white px-4 py-3 rounded-2xl shadow-xl max-w-xs w-[calc(100%-32px)]"
        >
          <span className="text-lg flex-shrink-0">🎪</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-white">Events near you in {nearbyState.name}</p>
            <Link
              href={`/events/${nearbyState.code.toLowerCase()}`}
              className="text-[11px] text-brand-orange font-semibold hover:underline"
            >
              View festivals →
            </Link>
          </div>
          <button
            onClick={() => setNearbyBannerDismissed(true)}
            aria-label="Dismiss"
            className="text-neutral-400 hover:text-white flex-shrink-0 text-sm leading-none px-1"
          >
            ×
          </button>
        </div>
      )}

    </div>
  );
}
