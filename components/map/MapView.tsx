"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { createClient } from "@/lib/supabase/client";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

export default function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [openNow, setOpenNow] = useState(true);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current!,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-74.006, 40.7128],
      zoom: 12,
    });

    map.current.on("load", () => {
      loadTrucks();
      subscribeToUpdates();
    });
  }, []);

  useEffect(() => {
    if (!map.current) return;
    refreshTrucks();
  }, [openNow]);

  const loadTrucks = async () => {
    const supabase = createClient();
    const { data: trucks } = await supabase
      .from("trucks")
      .select("*")
      .eq("is_active", true)
      .eq("is_open", true);

    if (!trucks || !map.current) return;

    map.current.addSource("trucks", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: trucks.map((truck: any) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [truck.longitude, truck.latitude],
          },
          properties: {
            id: truck.id,
            name: truck.name,
            cuisine_type: truck.cuisine_type,
          },
        })),
      },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    map.current.addLayer({
      id: "clusters",
      type: "circle",
      source: "trucks",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#D94F3D",
        "circle-radius": [
          "step",
          ["get", "point_count"],
          20, 5, 30, 10, 40,
        ],
      },
    });

    map.current.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "trucks",
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 14,
      },
      paint: { "text-color": "#ffffff" },
    });

    map.current.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "trucks",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#D94F3D",
        "circle-radius": 10,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    });
  };

  const subscribeToUpdates = () => {
    const supabase = createClient();
    supabase
      .channel("trucks-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trucks" },
        () => refreshTrucks()
      )
      .subscribe();
  };

  const refreshTrucks = async () => {
    const supabase = createClient();
    let query = supabase
      .from("trucks")
      .select("*")
      .eq("is_active", true);

    if (openNow) {
      query = query.eq("is_open", true);
    }

    const { data: trucks } = await query;
    if (!trucks || !map.current) return;

    const source = map.current.getSource("trucks") as mapboxgl.GeoJSONSource;
    if (!source) return;

    source.setData({
      type: "FeatureCollection",
      features: trucks.map((truck: any) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [truck.longitude, truck.latitude],
        },
        properties: {
          id: truck.id,
          name: truck.name,
          cuisine_type: truck.cuisine_type,
        },
      })),
    });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div style={{
        position: "absolute",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1,
      }}>
        <button
          onClick={() => setOpenNow(!openNow)}
          style={{
            backgroundColor: openNow ? "#D94F3D" : "#ffffff",
            color: openNow ? "#ffffff" : "#D94F3D",
            border: "2px solid #D94F3D",
            borderRadius: "20px",
            padding: "8px 16px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          Open Now
        </button>
      </div>
      <div ref={mapContainer} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}
