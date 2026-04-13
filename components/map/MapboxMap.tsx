"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

type Props = {
  trucks: any[];
};

export default function MapboxMap({ trucks }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (map.current) return;
    if (!mapboxgl.accessToken) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl());
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      })
    );
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markers.current.forEach((m) => m.remove());
    markers.current = [];

    trucks.forEach((truck) => {
      // Support both truck.location (single) and truck.locations (array)
      const loc = truck.locations?.[0] ?? truck.location ?? null;
      if (!loc?.lat || !loc?.lng) return;

      const el = document.createElement("div");
      el.style.cssText = `
        width: 44px;
        height: 44px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      el.innerHTML = `
        <div style="
          background: #E8481C;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          width: 36px;
          height: 36px;
          transform: rotate(-45deg);
          box-shadow: 0 4px 14px rgba(232,72,28,0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <svg
            style="transform: rotate(45deg);"
            width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="white" stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M1 3h15v13H1z"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 28, closeButton: false }).setHTML(
        `<div style="font-family:sans-serif;padding:4px 2px;min-width:140px">
          <p style="font-weight:800;margin:0 0 2px;font-size:14px;text-transform:uppercase;letter-spacing:0.02em">${truck.name ?? ""}</p>
          <p style="color:#E8481C;margin:0 0 8px;font-size:12px;font-weight:600">${truck.cuisine ?? "Food Truck"}</p>
          ${truck.is_live ? '<p style="color:#16a34a;font-size:11px;font-weight:700;margin:0 0 6px">● OPEN NOW</p>' : ""}
          <a href="/truck/${truck.id}" style="display:block;background:#E8481C;color:white;text-align:center;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;text-decoration:none;">View Profile</a>
        </div>`
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([loc.lng, loc.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [trucks]);

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) {
    return (
      <div
        style={{ width: "100%", height: "100%" }}
        className="bg-neutral-800 flex flex-col items-center justify-center gap-3"
      >
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <p className="text-neutral-500 text-sm">Map unavailable — add NEXT_PUBLIC_MAPBOX_TOKEN</p>
      </div>
    );
  }

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
}
