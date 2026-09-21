"use client";

import { useState, useEffect, useRef, useMemo, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useDishSearch } from "@/lib/hooks/useDishSearch";
import {
  firstOf, formatMiles, milesBetween, sortByLiveThenDistance,
  stopsLeftToday, toLatLng, type LatLng, type ScheduleStop,
} from "@/lib/discovery";
import {
  CUSTOMER_WAIT_WINDOW_MIN, PRESENCE_WINDOW_MIN,
  freshnessOf, summarizePresence, waitEstimate,
  type Freshness, type PresenceReport, type WaitReport,
} from "@/lib/presence";

const MapboxMap = dynamic(() => import("@/components/map/MapboxMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-neutral-900 flex items-center justify-center">
      <p className="text-neutral-500 text-sm font-medium">Loading map...</p>
    </div>
  ),
});

const CUISINES = [
  "All", "Tacos", "BBQ", "Burgers", "Asian Fusion",
  "Desserts", "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood", "Caribbean", "African",
];

const DIETARY = ["Vegan", "Gluten-Free", "Halal", "Vegetarian"];

type FeaturedTruck = {
  id: string;
  name: string;
  cuisine: string | null;
  profile_photo: string | null;
  message: string;
};

const noopSubscribe = () => () => {};

type TodayStop = ScheduleStop & { truck_id: string };

type HomeLocation = {
  id?: string;
  truck_id?: string;
  lat: number;
  lng: number;
  address: string | null;
  broadcasted_at: string | null;
};

type HomeTruck = {
  id: string;
  name: string;
  cuisine: string | null;
  description: string | null;
  profile_photo: string | null;
  is_live: boolean;
  avg_rating: number | null;
  review_count: number | null;
  dietary_tags: string[] | null;
  wait_minutes: number | null;
  wait_set_at: string | null;
  // One-to-one embed: PostgREST returns an object; realtime merges write an array.
  locations: HomeLocation | HomeLocation[] | null;
};

const TruckGlyph = ({ size, stroke }: { size: number; stroke: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
    <path d="M1 3h15v13H1z"/>
    <path d="M16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

export default function HomePage() {
  const [trucks, setTrucks] = useState<HomeTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [openNow, setOpenNow] = useState(true);
  const [cuisine, setCuisine] = useState("All");
  const [dietary, setDietary] = useState<string[]>([]);
  const [showFilter, setShowFilter] = useState(false);
  const [showList, setShowList] = useState(false);
  // false during SSR and hydration, true after — keeps the server HTML and the
  // first client render identical.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [featuredTruck, setFeaturedTruck] = useState<FeaturedTruck | null>(null);
  const [featuredDismissed, setFeaturedDismissed] = useState(false);
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const dishes = useDishSearch(search);
  const [todayStops, setTodayStops] = useState<TodayStop[]>([]);
  // Customer reports for the trucks currently on the map, keyed by truck.
  const [waitRows, setWaitRows] = useState<Record<string, WaitReport[]>>({});
  const [presenceRows, setPresenceRows] = useState<Record<string, PresenceReport[]>>({});
  const [clock, setClock] = useState(() => Date.now());
  const mountedRef = useRef(true);
  const searchBlurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTrucks();
    loadFeaturedTruck();
    loadTodayStops();
    // "Open now" vs "later today" depends on the time — re-evaluate each minute.
    const tick = setInterval(() => setClock(Date.now()), 60_000);

    // Real-time: merge individual truck/location updates into state rather than
    // re-fetching all trucks on every event. This prevents dozens of full-table
    // fetches per minute when multiple trucks are live.
    const supabase = createClient();
    const channel = supabase
      .channel("home-trucks-live")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "trucks" }, (payload) => {
        const updated = payload.new as Partial<HomeTruck>;
        if (!updated?.id) { loadTrucks(); return; }
        setTrucks((prev) => {
          const idx = prev.findIndex((t) => t.id === updated.id);
          if (idx === -1) {
            // New truck — trigger a full refresh to pick up the joined location data
            loadTrucks();
            return prev;
          }
          const next = [...prev];
          next[idx] = { ...next[idx], ...updated };
          return next;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "locations" }, (payload) => {
        const loc = payload.new as HomeLocation;
        if (!loc?.truck_id) return;
        setTrucks((prev) =>
          prev.map((t) =>
            t.id === loc.truck_id ? { ...t, locations: [loc] } : t
          )
        );
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "locations" }, (payload) => {
        const loc = payload.new as HomeLocation;
        if (!loc?.truck_id) return;
        setTrucks((prev) =>
          prev.map((t) =>
            t.id === loc.truck_id ? { ...t, locations: [loc] } : t
          )
        );
      })
      .subscribe();
    return () => {
      mountedRef.current = false;
      clearInterval(tick);
      if (searchBlurTimerRef.current) clearTimeout(searchBlurTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadTodayStops() {
    try {
      const { data } = await createClient()
        .from("schedules")
        .select("truck_id, day_of_week, open_time, close_time, location, notes")
        .eq("day_of_week", new Date().getDay())
        .limit(500);
      if (mountedRef.current && data) setTodayStops(data as TodayStop[]);
    } catch {
      // non-critical — the "Out today" section just won't show
    }
  }

  async function loadFeaturedTruck() {
    try {
      const supabase = createClient();
      const { data: settings } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["featured_truck_id", "featured_message"]);
      if (!mountedRef.current || !settings) return;
      const sm: Record<string, string> = {};
      for (const row of settings) sm[row.key] = row.value ?? "";
      const truckId = sm["featured_truck_id"];
      if (!truckId) return;
      const { data: truckData } = await supabase
        .from("trucks")
        .select("id, name, cuisine, profile_photo")
        .eq("id", truckId)
        .maybeSingle();
      if (!mountedRef.current || !truckData) return;
      setFeaturedTruck({
        ...truckData,
        message: sm["featured_message"] ?? "",
      });
    } catch {
      // non-critical — just won't show the banner
    }
  }

  async function loadTrucks() {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("trucks")
        // Fetch only the most recent location per truck via inner relation
        .select("id, name, cuisine, description, profile_photo, is_live, avg_rating, review_count, dietary_tags, wait_minutes, wait_set_at, locations(id, lat, lng, address, broadcasted_at)")
        .order("is_live", { ascending: false })
        .order("broadcasted_at", { referencedTable: "locations", ascending: false })
        .limit(200);
      if (!mountedRef.current) return;
      setTrucks(data ?? []);
      setLoadError(false);
    } catch {
      // network error — show error only on initial empty load
      if (mountedRef.current && trucks.length === 0) setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // Customer reports for whatever is live right now. Refetched on a slow
  // interval rather than realtime: these are advisory signals, and a map with
  // two dozen live pins shouldn't hold two dozen subscriptions open for them.
  const liveIdKey = useMemo(
    () => trucks.filter((t) => t.is_live).map((t) => t.id).sort().join(","),
    [trucks],
  );

  useEffect(() => {
    const ids = liveIdKey ? liveIdKey.split(",") : [];
    let cancelled = false;

    async function loadCrowdSignals() {
      if (ids.length === 0) {
        setWaitRows({});
        setPresenceRows({});
        return;
      }
      try {
        const supabase = createClient();
        const [{ data: waits }, { data: presence }] = await Promise.all([
          supabase.from("wait_reports").select("truck_id, minutes, created_at")
            .in("truck_id", ids)
            .gte("created_at", new Date(Date.now() - CUSTOMER_WAIT_WINDOW_MIN * 60_000).toISOString())
            .limit(500),
          supabase.from("presence_reports").select("truck_id, verdict, created_at")
            .in("truck_id", ids)
            .gte("created_at", new Date(Date.now() - PRESENCE_WINDOW_MIN * 60_000).toISOString())
            .limit(500),
        ]);
        if (cancelled || !mountedRef.current) return;

        const byWait: Record<string, WaitReport[]> = {};
        for (const row of waits ?? []) {
          (byWait[row.truck_id] ??= []).push({ minutes: row.minutes, created_at: row.created_at });
        }
        const byPresence: Record<string, PresenceReport[]> = {};
        for (const row of presence ?? []) {
          (byPresence[row.truck_id] ??= []).push({ verdict: row.verdict, created_at: row.created_at });
        }
        setWaitRows(byWait);
        setPresenceRows(byPresence);
      } catch {
        // Advisory only — the map is still useful without them.
      }
    }

    loadCrowdSignals();
    if (ids.length === 0) return () => { cancelled = true; };
    const timer = setInterval(loadCrowdSignals, 180_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [liveIdKey]);

  /**
   * How current a live truck's position is, and what the crowd says about it.
   * Recomputed on the same minute tick as the "open now" filter so a chip
   * never claims "confirmed 2m ago" twenty minutes later.
   */
  function signalsFor(truck: HomeTruck): {
    freshness: Freshness | null;
    waitChip: string | null;
    disputed: boolean;
  } {
    if (!truck.is_live) return { freshness: null, waitChip: null, disputed: false };
    const now = new Date(clock);
    const estimate = waitEstimate(
      { operatorMinutes: truck.wait_minutes, operatorSetAt: truck.wait_set_at, reports: waitRows[truck.id] },
      now,
    );
    const presence = summarizePresence(presenceRows[truck.id] ?? [], now);
    return {
      freshness: freshnessOf(firstOf(truck.locations)?.broadcasted_at, now),
      waitChip: estimate?.chip ?? null,
      disputed: presence.state === "disputed",
    };
  }

  const query = search.trim().toLowerCase();
  const dishFor = (t: HomeTruck): string | null => dishes[t.id] ?? null;
  const matchesSearch = (t: HomeTruck) =>
    !query ||
    t.name?.toLowerCase().includes(query) ||
    t.cuisine?.toLowerCase().includes(query) ||
    dishFor(t) != null;

  // Distance only means something for a live truck — an offline truck's
  // stored position is where it last was, not where it is.
  const milesTo = (t: HomeTruck): number | null => {
    if (!userPos || !t.is_live) return null;
    const pos = toLatLng(firstOf(t.locations));
    return pos ? milesBetween(userPos, pos) : null;
  };

  const filtered = sortByLiveThenDistance(
    trucks.filter((t) => {
      if (openNow && !t.is_live) return false;
      if (cuisine !== "All" && t.cuisine !== cuisine) return false;
      if (!matchesSearch(t)) return false;
      if (dietary.length > 0) {
        const tags = t.dietary_tags ?? [];
        if (!dietary.every((d) => tags.includes(d))) return false;
      }
      return true;
    }),
    (t) => !!t.is_live,
    milesTo,
  );

  // Search results for dropdown: search ALL trucks regardless of open/cuisine/dietary filters
  const searchResults = query
    ? sortByLiveThenDistance(trucks.filter(matchesSearch), (t) => !!t.is_live, milesTo)
    : [];

  const liveCount = filtered.filter((t) => t.is_live).length;

  // Same signals the list shows, flattened to plain strings for the map popup.
  const mapSignals = useMemo(() => {
    const out: Record<string, { level: string; label: string; wait: string | null; disputed: boolean }> = {};
    for (const truck of filtered) {
      if (!truck.is_live) continue;
      const { freshness, waitChip, disputed } = signalsFor(truck);
      if (!freshness) continue;
      out[truck.id] = { level: freshness.level, label: freshness.label, wait: waitChip, disputed };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, waitRows, presenceRows, clock]);

  // Today's remaining stops for trucks that aren't live yet, soonest first.
  const outToday = useMemo(() => {
    const byId = new Map(trucks.map((t) => [t.id, t]));
    return stopsLeftToday(todayStops, new Date(clock))
      .map((stop) => ({ stop, truck: byId.get(stop.truck_id) }))
      .filter((x): x is { stop: typeof x.stop; truck: HomeTruck } => !!x.truck && !x.truck.is_live);
  }, [trucks, todayStops, clock]);
  const nextStopFor = (truckId: string) => outToday.find((x) => x.truck.id === truckId)?.stop ?? null;

  function toggleDietary(tag: string) {
    setDietary(
      dietary.includes(tag)
        ? dietary.filter((d) => d !== tag)
        : [...dietary, tag]
    );
  }

  const activeFilterCount = dietary.length + (cuisine !== "All" ? 1 : 0);

  // One list, rendered in both the phone bottom sheet and the desktop side panel.
  function renderList(photoPx: number) {
    return (
      <>
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" />
            <p className="text-neutral-400 text-sm">Loading trucks...</p>
          </div>
        )}

        {/* Out today — scheduled stops for trucks that haven't gone live yet */}
        {!loading && !query && outToday.length > 0 && openNow && (
          <div className="px-4 pt-3 pb-1">
            <p className="text-[11px] font-black text-neutral-400 uppercase tracking-widest mb-2">Out today</p>
            <div className="flex flex-col gap-1.5">
              {outToday.map(({ stop, truck }, i) => (
                <Link
                  key={`${truck.id}-${i}`}
                  href={"/truck/" + truck.id}
                  className="flex items-center gap-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 px-3 py-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-800 truncate">{truck.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {stop.location || "Location TBA"}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[11px] font-bold ${stop.status === "open" ? "text-green-600" : "text-neutral-500"}`}>
                    {stop.status === "open" ? `Until ${stop.close_time}` : `${stop.open_time}–${stop.close_time}`}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-3">
              <TruckGlyph size={24} stroke="#ccc" />
            </div>
            <p className="font-semibold text-neutral-700 mb-1">
              {openNow && !query ? "No trucks live right now" : "No trucks found"}
            </p>
            <p className="text-sm text-neutral-400">
              {openNow ? "Turn off Open Now to see all trucks" : "Try clearing your filters"}
            </p>
            {openNow && (
              <button
                onClick={() => setOpenNow(false)}
                className="mt-3 px-4 py-2 bg-brand-red text-white rounded-lg text-sm font-semibold"
              >
                Show All Trucks
              </button>
            )}
          </div>
        )}

        {filtered.map((truck) => {
          const miles = milesTo(truck);
          const dish = dishFor(truck);
          const nextStop = truck.is_live ? null : nextStopFor(truck.id);
          const address = truck.is_live ? firstOf(truck.locations)?.address : null;
          // "OPEN" on its own is a claim. These say how well it's backed up.
          const { freshness, waitChip, disputed } = signalsFor(truck);
          return (
            <Link
              key={truck.id}
              href={"/truck/" + truck.id}
              className="flex gap-3 px-4 py-3 border-b border-neutral-100 hover:bg-neutral-50 active:bg-neutral-50 transition-colors"
            >
              <div
                className="rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden relative"
                style={{ width: photoPx, height: photoPx }}
              >
                {truck.profile_photo ? (
                  <Image src={truck.profile_photo} alt={truck.name} fill sizes={`${photoPx}px`} className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                    <TruckGlyph size={Math.round(photoPx / 3)} stroke="#ccc" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black text-neutral-900 text-sm uppercase tracking-wide leading-tight">
                    {truck.name}
                  </p>
                  {truck.is_live && (
                    <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-black px-2 py-0.5 bg-brand-red text-white rounded tracking-wider">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                      </span>
                      OPEN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-brand-red font-semibold">
                    {truck.cuisine ?? "Food Truck"}
                  </p>
                  {(truck.avg_rating ?? 0) > 0 && (
                    <div className="flex items-center gap-0.5">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="#F5A623" stroke="#F5A623" strokeWidth="1" aria-hidden="true">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span className="text-[10px] font-bold text-neutral-600">{Number(truck.avg_rating).toFixed(1)}</span>
                    </div>
                  )}
                  {miles != null && (
                    <span className="text-[11px] font-bold text-neutral-600">· {formatMiles(miles)}</span>
                  )}
                </div>
                {dish && (
                  <p className="text-xs text-neutral-500 mt-0.5 truncate">
                    Serves <span className="font-semibold text-neutral-700">{dish}</span>
                  </p>
                )}
                {address && (
                  <div className="flex items-center gap-1 mt-1">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0" aria-hidden="true">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                      <circle cx="12" cy="10" r="3"/>
                    </svg>
                    <span className="text-xs text-neutral-400 truncate">{address}</span>
                  </div>
                )}
                {nextStop && (
                  <p className="text-xs text-neutral-500 mt-1 truncate">
                    {nextStop.status === "open" ? "Scheduled now" : "Today"} · {nextStop.open_time}–{nextStop.close_time}
                    {nextStop.location ? ` · ${nextStop.location}` : ""}
                  </p>
                )}
                {(freshness || waitChip || disputed) && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {freshness && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        freshness.level === "fresh" ? "bg-green-50 text-green-700"
                          : freshness.level === "recent" ? "bg-amber-50 text-amber-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {freshness.label}
                      </span>
                    )}
                    {waitChip && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600">
                        {waitChip}
                      </span>
                    )}
                    {disputed && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                        Reported gone
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        <div className="h-6" />
      </>
    );
  }

  if (mounted && loadError) return (
    <div className="relative h-screen w-screen bg-neutral-900 flex flex-col items-center justify-center gap-4">
      <p className="text-neutral-300 font-bold text-lg">Couldn&apos;t load trucks</p>
      <p className="text-neutral-500 text-sm">Check your connection and try again.</p>
      <button
        onClick={() => { setLoadError(false); setLoading(true); loadTrucks(); }}
        className="mt-2 px-6 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm"
      >
        Retry
      </button>
    </div>
  );

  if (!mounted) return (
    <div className="relative h-screen w-screen bg-neutral-900 flex flex-col items-center justify-center gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
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
      <div className="w-10 h-10 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" />
      <p className="text-neutral-400 text-sm">Finding food trucks near you...</p>
    </div>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-neutral-900">

      {/* Full-screen map */}
      <div className="absolute inset-0 home-map">
        <MapboxMap trucks={filtered} signals={mapSignals} onUserLocation={setUserPos} />
      </div>

      {/* Top bar — floats over the map */}
      <div className="absolute top-0 left-0 right-0 z-20">

        {/* Navbar */}
        <div className="bg-neutral-900/95 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <div className="leading-tight">
              <div className="flex items-center gap-1">
                <span className="font-black text-brand-red text-sm tracking-tight">HOT</span>
                <span className="font-black text-white text-sm tracking-tight">TRUCK</span>
              </div>
              <span className="font-black text-brand-orange text-sm tracking-tight leading-none">MAP</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/about"
              className="px-2 sm:px-3 py-1.5 rounded-lg text-neutral-300 font-bold text-xs hover:text-white transition-colors"
            >
              About
            </Link>
            <Link
              href="/events"
              className="px-2 sm:px-3 py-1.5 rounded-lg text-neutral-300 font-bold text-xs hover:text-white transition-colors"
            >
              Events
            </Link>
            <Link
              href="/catering"
              className="hidden sm:block px-3 py-1.5 rounded-lg border border-neutral-600 text-neutral-300 font-bold text-xs hover:border-neutral-400 hover:text-white transition-colors"
            >
              Catering
            </Link>
            <Link
              href="/signup?role=operator"
              className="hidden sm:block px-3 py-1.5 rounded-lg border border-brand-red text-brand-red font-bold text-xs hover:bg-brand-red hover:text-white transition-colors"
            >
              List My Truck
            </Link>
            <Link
              href="/account"
              aria-label="Account"
              className="w-8 h-8 rounded-full border border-neutral-600 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* Featured truck banner */}
        {featuredTruck && !featuredDismissed && (
          <div className="px-3 md:px-4 pt-2 md:max-w-2xl md:mx-auto">
            <div className="bg-brand-red rounded-2xl p-3 flex items-center gap-3 shadow-lg">
              {/* Truck photo */}
              <div className="w-12 h-12 rounded-xl bg-red-700 overflow-hidden flex-shrink-0 relative">
                {featuredTruck.profile_photo ? (
                  <Image src={featuredTruck.profile_photo} alt={featuredTruck.name} fill sizes="(max-width: 640px) 100vw, 50vw" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 3h15v13H1z"/>
                      <path d="M16 8h4l3 3v5h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-red-200 uppercase tracking-widest">🏆 Truck of the Week</p>
                <p className="font-black text-white text-sm uppercase tracking-wide leading-tight truncate">{featuredTruck.name}</p>
                {featuredTruck.cuisine && (
                  <p className="text-[11px] text-red-200">{featuredTruck.cuisine}</p>
                )}
                {featuredTruck.message && (
                  <p className="text-[11px] text-red-100 mt-0.5 line-clamp-1">{featuredTruck.message}</p>
                )}
              </div>
              {/* View button */}
              <Link
                href={`/truck/${featuredTruck.id}`}
                className="flex-shrink-0 px-3 py-1.5 bg-white text-brand-red text-xs font-black rounded-full hover:bg-red-50 transition-colors"
              >
                View
              </Link>
              {/* Dismiss */}
              <button
                onClick={() => setFeaturedDismissed(true)}
                aria-label="Dismiss featured truck"
                className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-red-200 hover:text-white transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Search card — floats over the map */}
        <div className="px-3 md:px-4 pt-2 pb-1 md:max-w-2xl md:mx-auto">
          <div
            className="bg-white rounded-2xl overflow-visible"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)" }}
          >

            {/* Search input row */}
            <div className="flex items-center gap-0 px-4 py-1">
              {/* Search icon */}
              <svg
                className="text-neutral-400 flex-shrink-0"
                width="17" height="17" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>

              {/* Input */}
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  if (searchBlurTimerRef.current) clearTimeout(searchBlurTimerRef.current);
                  searchBlurTimerRef.current = setTimeout(() => { if (mountedRef.current) setSearchFocused(false); }, 200);
                }}
                placeholder="Search trucks, cuisines, or dishes..."
                aria-label="Search trucks, cuisines, or dishes"
                suppressHydrationWarning
                className="flex-1 px-3 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none bg-transparent"
              />

              {/* Clear button */}
              {search ? (
                <button
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="w-6 h-6 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center flex-shrink-0 transition-colors"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              ) : (
                /* Filter button */
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all flex-shrink-0 ${
                    showFilter || activeFilterCount > 0
                      ? "bg-brand-red text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M22 3H2l8 9.46V19l4 2v-8.54z"/>
                  </svg>
                  {activeFilterCount > 0 ? activeFilterCount + " Filter" + (activeFilterCount > 1 ? "s" : "") : "Filter"}
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-100 mx-4" />

            {/* Quick filter pills */}
            <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-none">
              {/* Open Now pill */}
              <button
                onClick={() => setOpenNow(!openNow)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold tracking-wide transition-all ${
                  openNow
                    ? "bg-brand-red text-white shadow-sm"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {openNow ? (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
                  </span>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                )}
                Open Now
              </button>

              {/* Cuisine pills */}
              {CUISINES.filter((c) => c !== "All").map((c) => (
                <button
                  key={c}
                  onClick={() => setCuisine(cuisine === c ? "All" : c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    cuisine === c
                      ? "bg-neutral-900 text-white shadow-sm"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Expanded dietary filters */}
            {showFilter && (
              <div className="border-t border-neutral-100 px-4 py-3 flex flex-col gap-3">
                <div>
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-2">Dietary</p>
                  <div className="flex flex-wrap gap-2">
                    {DIETARY.map((d) => (
                      <button
                        key={d}
                        onClick={() => toggleDietary(d)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          dietary.includes(d)
                            ? "bg-brand-red text-white shadow-sm"
                            : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                {activeFilterCount > 0 && (
                  <button
                    onClick={() => { setDietary([]); setCuisine("All"); }}
                    className="text-xs text-brand-red font-bold text-left hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            )}

            {/* Search dropdown results */}
            {searchFocused && search && (
              <div className="border-t border-neutral-100 overflow-hidden rounded-b-2xl">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
                        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      </svg>
                    </div>
                    <p className="text-sm text-neutral-400">No trucks found for &ldquo;<span className="text-neutral-600 font-medium">{search}</span>&rdquo;</p>
                  </div>
                ) : (
                  <>
                    {searchResults.slice(0, 8).map((truck, i) => (
                      <Link
                        key={truck.id}
                        href={"/truck/" + truck.id}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 active:bg-neutral-100 transition-colors ${
                          i < Math.min(searchResults.length, 8) - 1 ? "border-b border-neutral-50" : ""
                        }`}
                      >
                        <div className="w-9 h-9 rounded-xl bg-neutral-100 overflow-hidden flex-shrink-0 relative">
                          {truck.profile_photo ? (
                            <Image src={truck.profile_photo} alt={truck.name} fill sizes="36px" className="object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round">
                                <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                                <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-800 truncate">{truck.name}</p>
                          <p className="text-xs text-neutral-400 truncate">
                            {dishFor(truck) ? <>Serves <span className="text-neutral-600">{dishFor(truck)}</span></> : truck.cuisine ?? "Food Truck"}
                            {milesTo(truck) != null && <> · {formatMiles(milesTo(truck)!)}</>}
                          </p>
                        </div>
                        {truck.is_live ? (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
                            </span>
                            <span className="text-[10px] font-bold text-brand-red">OPEN</span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-semibold text-neutral-300 flex-shrink-0">Offline</span>
                        )}
                      </Link>
                    ))}
                    {searchResults.length > 8 && (
                      <Link
                        href={`/trucks?q=${encodeURIComponent(search)}`}
                        onClick={() => setSearch("")}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 border-t border-neutral-50 text-xs font-bold text-brand-red hover:bg-red-50 transition-colors w-full"
                      >
                        See all {searchResults.length} results →
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Live count pill — floats over map */}
      {!showList && liveCount > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red" />
            </span>
            <p className="text-sm font-semibold text-neutral-800">
              {liveCount} truck{liveCount !== 1 ? "s" : ""} live now
            </p>
          </div>
        </div>
      )}

      {/* Nobody live — say so, and point at who's out later today instead of
          leaving an empty map. */}
      {!showList && !loading && liveCount === 0 && (
        <div className="absolute bottom-20 left-3 right-3 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-[26rem] z-20">
          <div className="bg-white rounded-2xl shadow-xl px-4 py-3">
            <p className="text-sm font-black text-neutral-900">No trucks live right now</p>
            {outToday.length > 0 ? (
              <>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {outToday.length === 1 ? "1 stop" : `${outToday.length} stops`} coming up today
                </p>
                <Link
                  href={`/truck/${outToday[0].truck.id}`}
                  className="mt-2 flex items-center gap-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 px-3 py-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-neutral-800 truncate">{outToday[0].truck.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {outToday[0].stop.open_time}–{outToday[0].stop.close_time}
                      {outToday[0].stop.location ? ` · ${outToday[0].stop.location}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-brand-red flex-shrink-0">View →</span>
                </Link>
                {outToday.length > 1 && (
                  <button
                    onClick={() => setShowList(true)}
                    className="mt-2 text-xs font-bold text-brand-red hover:underline"
                  >
                    See all of today&apos;s stops
                  </button>
                )}
              </>
            ) : (
              <p className="text-xs text-neutral-500 mt-0.5">
                <Link href="/trucks" className="font-bold text-brand-red hover:underline">Follow your favorites</Link>
                {" "}and we&apos;ll tell you the moment they go live.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom Tab Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-30 bg-white border-t border-neutral-200 flex safe-bottom">
        <button
          onClick={() => setShowList(false)}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            !showList ? "text-brand-red" : "text-neutral-400"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={!showList ? 2.5 : 2} strokeLinecap="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          </svg>
          <span className="text-[10px] font-bold tracking-wide">MAP</span>
        </button>

        <button
          onClick={() => setShowList(true)}
          className={`flex-1 py-3 flex flex-col items-center gap-0.5 transition-colors ${
            showList ? "text-brand-red" : "text-neutral-400"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={showList ? 2.5 : 2} strokeLinecap="round">
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
          </svg>
          <span className="text-[10px] font-bold tracking-wide">TRUCKS</span>
          {filtered.length > 0 && (
            <span className={`text-[9px] font-bold ${showList ? "text-brand-red" : "text-neutral-400"}`}>
              {filtered.length}
            </span>
          )}
        </button>
      </div>

      {/* Truck List — bottom sheet (mobile) / side panel (tablet+) */}
      {showList && (
        <div className="absolute inset-0 bottom-16 z-20">
          {/* Tap backdrop to close (mobile only) */}
          <div
            className="absolute inset-0 md:hidden"
            onClick={() => setShowList(false)}
          />

          {/* Mobile: bottom sheet */}
          <div className="md:hidden absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden flex flex-col" style={{ maxHeight: "75vh" }}>

            {/* Sheet handle + header */}
            <div className="flex-shrink-0 pt-3 pb-2 px-4 border-b border-neutral-100">
              <div className="w-10 h-1 bg-neutral-200 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-neutral-800">
                  {filtered.length} food truck{filtered.length !== 1 ? "s" : ""}
                  {openNow ? " open now" : ""}
                  {cuisine !== "All" ? ` · ${cuisine}` : ""}
                </p>
                <button
                  onClick={() => setShowList(false)}
                  className="text-neutral-400 hover:text-neutral-600"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {renderList(64)}
            </div>
          </div>

          {/* Tablet/Desktop: side panel */}
          <div className="hidden md:flex absolute top-0 left-0 bottom-0 w-80 lg:w-96 bg-white shadow-2xl flex-col z-10">
            {/* Panel header */}
            <div className="flex-shrink-0 px-4 py-4 border-b border-neutral-100 flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-800">
                {filtered.length} truck{filtered.length !== 1 ? "s" : ""}
                {openNow ? " open now" : ""}
                {cuisine !== "All" ? ` · ${cuisine}` : ""}
              </p>
              <button
                onClick={() => setShowList(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {renderList(56)}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
