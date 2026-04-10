"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

type Props = {
  trucks: any[];
};

export default function MapboxMap({ trucks }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.0060, 40.7128],
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

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    trucks.forEach((truck) => {
      if (!truck.location) return;

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="
          background: #D94F3D;
          border: 3px solid white;
          border-radius: 50% 50% 50% 0;
          width: 40px;
          height: 40px;
          transform: rotate(-45deg);
          box-shadow: 0 4px 12px rgba(217,79,61,0.4);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <span style="transform: rotate(45deg); font-size: 16px;">🚚</span>
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        "<div style='font-family:sans-serif;padding:4px'>" +
        "<p style='font-weight:bold;margin:0 0 4px'>" + truck.name + "</p>" +
        "<p style='color:#666;margin:0 0 4px;font-size:13px'>" + truck.cuisine + "</p>" +
        "<a href='/truck/" + truck.id + "' style='display:block;margin-top:8px;background:#D94F3D;color:white;text-align:center;padding:6px 12px;border-radius:20px;font-size:13px;font-weight:bold;text-decoration:none'>View Menu</a>" +
        "</div>"
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([truck.location.lng, truck.location.lat])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
    });
  }, [trucks]);

  return (
    <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />
  );
}