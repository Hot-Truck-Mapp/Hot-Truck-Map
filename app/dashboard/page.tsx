"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const CUISINE_TYPES = [
  "Tacos","BBQ","Burgers","Asian Fusion","Desserts",
  "Pizza","Sandwiches","Healthy","Breakfast","Seafood",
  "Mediterranean","Vegan","Halal","Other",
];
const ALLERGENS = ["Gluten","Dairy","Nuts","Eggs","Soy","Shellfish","Fish"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = [
  "6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM",
  "12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
  "6:00 PM","7:00 PM","8:00 PM","9:00 PM","10:00 PM",
];
type Tab = "live" | "profile" | "menu" | "schedule" | "analytics" | "orders";
type AnalyticsRange = "weekly" | "monthly" | "yearly";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("live");

  // Truck
  const [truckId, setTruckId]     = useState<string | null>(null);
  const [userId, setUserId]       = useState<string | null>(null);
  const [isLive, setIsLive]       = useState(false);

  // Profile form
  const [profile, setProfile] = useState({
    name:"", description:"", cuisine:"", phone:"", instagram:"", profile_photo:"",
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  // Menu
  const [menuItems, setMenuItems]   = useState<any[]>([]);
  const [menuModal, setMenuModal]   = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuSaving, setMenuSaving] = useState(false);
  const menuPhotoRef = useRef<HTMLInputElement>(null);
  const emptyItem = { name:"", description:"", price:"", category:"", allergens:[] as string[], is_popular:false, is_sold_out:false, photo:"" };
  const [itemForm, setItemForm] = useState(emptyItem);

  // Schedule
  const [schedule, setSchedule]     = useState<any[]>([]);
  const [schedDay, setSchedDay]     = useState(new Date().getDay());
  const [schedModal, setSchedModal] = useState(false);
  const [editingSched, setEditingSched] = useState<any | null>(null);
  const [schedSaving, setSchedSaving]  = useState(false);
  const [schedForm, setSchedForm] = useState({
    day_of_week: new Date().getDay(), location:"", open_time:"10:00 AM", close_time:"3:00 PM", notes:"",
  });

  // Go Live
  const [liveStatus, setLiveStatus]   = useState<"idle"|"locating"|"live"|"error">("idle");
  const [liveAddress, setLiveAddress] = useState<string | null>(null);
  const [liveError, setLiveError]     = useState<string | null>(null);
  const [manualAddr, setManualAddr]   = useState("");
  const [showManual, setShowManual]   = useState(false);

  // Analytics
  const [analyticsLoaded, setAnalyticsLoaded]   = useState(false);
  const [analyticsRange, setAnalyticsRange]     = useState<AnalyticsRange>("weekly");
  const [totalFollowers, setTotalFollowers]     = useState(0);
  const [chartData, setChartData]               = useState<any[]>([]);
  const [periodStats, setPeriodStats]           = useState({ followers:0, orders:0, views:0, revenue:0 });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Orders
  const [orders, setOrders]           = useState<any[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();

      if (authErr || !user) {
        window.location.href = "/login";
        return;
      }
      setUserId(user.id);

      const { data: truck } = await supabase
        .from("trucks").select("*").eq("owner_id", user.id).single();

      if (truck) {
        setTruckId(truck.id);
        setIsLive(truck.is_live ?? false);
        setProfile({
          name:          truck.name          ?? "",
          description:   truck.description   ?? "",
          cuisine:       truck.cuisine       ?? "",
          phone:         truck.phone         ?? "",
          instagram:     truck.instagram     ?? "",
          profile_photo: truck.profile_photo ?? "",
        });
        if (truck.is_live) setLiveStatus("live");

        const [menuRes, schedRes, ordersRes] = await Promise.all([
          supabase.from("menu_items").select("*").eq("truck_id", truck.id).order("created_at"),
          supabase.from("schedules").select("*").eq("truck_id", truck.id).order("day_of_week"),
          supabase.from("orders").select("*").eq("truck_id", truck.id).order("created_at", { ascending: false }).limit(100),
        ]);
        setMenuItems(menuRes.data ?? []);
        setSchedule(schedRes.data ?? []);
        setOrders(ordersRes.data ?? []);
      }
    } catch (err: any) {
      setError("Could not connect to the server. Check your internet and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Tab switch — load analytics lazily ─────────────────────────────────────
  useEffect(() => {
    if (activeTab === "analytics" && !analyticsLoaded && truckId) {
      loadAnalytics(truckId, analyticsRange);
    }
  }, [activeTab, truckId]); // eslint-disable-line

  // ── Real-time order notifications ───────────────────────────────────────────
  useEffect(() => {
    if (!truckId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`orders-${truckId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `truck_id=eq.${truckId}` },
        (payload) => {
          const order = payload.new as any;
          setOrders((prev) => [order, ...prev]);
          setNewOrderCount((n) => n + 1);
          playNotificationSound();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [truckId]); // eslint-disable-line

  // ── Profile ─────────────────────────────────────────────────────────────────
  async function uploadProfilePhoto(file: File) {
    setPhotoUploading(true);
    try {
      const supabase = createClient();
      const path = `trucks/${Date.now()}.${file.name.split(".").pop()}`;
      await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setProfile(p => ({ ...p, profile_photo: data.publicUrl }));
    } catch { alert("Photo upload failed"); }
    setPhotoUploading(false);
  }

  async function saveProfile() {
    if (!profile.name.trim() || !userId) return;
    setProfileSaving(true);
    try {
      const supabase = createClient();
      if (truckId) {
        await supabase.from("trucks").update({
          name: profile.name.trim(), description: profile.description,
          cuisine: profile.cuisine, phone: profile.phone,
          instagram: profile.instagram, profile_photo: profile.profile_photo,
        }).eq("id", truckId);
      } else {
        const { data: newTruck } = await supabase.from("trucks").insert({
          owner_id: userId, name: profile.name.trim(),
          description: profile.description, cuisine: profile.cuisine,
          phone: profile.phone, instagram: profile.instagram,
          profile_photo: profile.profile_photo, is_live: false,
        }).select("id").single();
        if (newTruck) setTruckId(newTruck.id);
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch { alert("Save failed. Please try again."); }
    setProfileSaving(false);
  }

  // ── Menu ────────────────────────────────────────────────────────────────────
  async function uploadMenuPhoto(file: File) {
    setMenuUploading(true);
    try {
      const supabase = createClient();
      const path = `menu/${Date.now()}.${file.name.split(".").pop()}`;
      await supabase.storage.from("menu-photos").upload(path, file, { upsert: true });
      const { data } = supabase.storage.from("menu-photos").getPublicUrl(path);
      setItemForm(f => ({ ...f, photo: data.publicUrl }));
    } catch { alert("Photo upload failed"); }
    setMenuUploading(false);
  }

  function openAddItem() {
    setItemForm(emptyItem);
    setEditingItem(null);
    setMenuModal(true);
  }
  function openEditItem(item: any) {
    setItemForm({
      name: item.name, description: item.description ?? "",
      price: String(item.price), category: item.category ?? "",
      allergens: item.allergens ?? [], is_popular: item.is_popular ?? false,
      is_sold_out: item.is_sold_out ?? false, photo: item.photo ?? "",
    });
    setEditingItem(item);
    setMenuModal(true);
  }

  async function saveMenuItem() {
    if (!truckId || !itemForm.name || !itemForm.price) return;
    setMenuSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        truck_id: truckId, name: itemForm.name,
        description: itemForm.description, price: parseFloat(itemForm.price),
        category: itemForm.category || "Other", allergens: itemForm.allergens,
        is_popular: itemForm.is_popular, is_sold_out: itemForm.is_sold_out,
        photo: itemForm.photo,
      };
      if (editingItem) {
        await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
      } else {
        await supabase.from("menu_items").insert(payload);
      }
      const { data } = await supabase.from("menu_items").select("*").eq("truck_id", truckId).order("created_at");
      setMenuItems(data ?? []);
      setMenuModal(false);
    } catch { alert("Save failed. Please try again."); }
    setMenuSaving(false);
  }

  async function deleteMenuItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const supabase = createClient();
    await supabase.from("menu_items").delete().eq("id", id);
    setMenuItems(items => items.filter(i => i.id !== id));
  }

  async function toggleSoldOut(item: any) {
    const supabase = createClient();
    await supabase.from("menu_items").update({ is_sold_out: !item.is_sold_out }).eq("id", item.id);
    setMenuItems(items => items.map(i => i.id === item.id ? { ...i, is_sold_out: !i.is_sold_out } : i));
  }

  // ── Schedule ────────────────────────────────────────────────────────────────
  function openAddSched(day: number) {
    setSchedForm({ day_of_week: day, location:"", open_time:"10:00 AM", close_time:"3:00 PM", notes:"" });
    setEditingSched(null);
    setSchedModal(true);
  }
  function openEditSched(entry: any) {
    setSchedForm({
      day_of_week: entry.day_of_week, location: entry.location,
      open_time: entry.open_time, close_time: entry.close_time,
      notes: entry.notes ?? "",
    });
    setEditingSched(entry);
    setSchedModal(true);
  }

  async function saveSchedEntry() {
    if (!truckId || !schedForm.location) return;
    setSchedSaving(true);
    try {
      const supabase = createClient();
      const payload = { truck_id: truckId, ...schedForm };
      if (editingSched?.id) {
        await supabase.from("schedules").update(payload).eq("id", editingSched.id);
      } else {
        await supabase.from("schedules").insert(payload);
      }
      const { data } = await supabase.from("schedules").select("*").eq("truck_id", truckId).order("day_of_week");
      setSchedule(data ?? []);
      setSchedModal(false);
    } catch { alert("Save failed. Please try again."); }
    setSchedSaving(false);
  }

  async function deleteSchedEntry(id: string) {
    if (!confirm("Remove this stop?")) return;
    const supabase = createClient();
    await supabase.from("schedules").delete().eq("id", id);
    setSchedule(s => s.filter(e => e.id !== id));
  }

  // ── Go Live ─────────────────────────────────────────────────────────────────
  async function broadcastLocation(lat: number, lng: number, address: string) {
    const supabase = createClient();
    if (!truckId) return;
    await supabase.from("locations").upsert(
      { truck_id: truckId, lat, lng, address, broadcasted_at: new Date().toISOString() },
      { onConflict: "truck_id" }
    );
    await supabase.from("trucks").update({ is_live: true }).eq("id", truckId);
    setLiveAddress(address);
    setLiveStatus("live");
    setIsLive(true);
  }

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`);
      const data = await res.json();
      return data.features?.[0]?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch { return `${lat.toFixed(5)}, ${lng.toFixed(5)}`; }
  }

  async function goLiveGPS() {
    if (!truckId) { alert("Save your truck profile first."); setActiveTab("profile"); return; }
    setLiveStatus("locating");
    setLiveError(null);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          await broadcastLocation(pos.coords.latitude, pos.coords.longitude, place);
        } catch (e: any) { setLiveError(e.message); setLiveStatus("error"); }
      },
      () => { setLiveStatus("idle"); setShowManual(true); setLiveError("Could not get your location."); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function goLiveManual() {
    if (!manualAddr.trim() || !truckId) return;
    setLiveStatus("locating");
    setLiveError(null);
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) { setLiveError("Map service not configured."); setLiveStatus("idle"); return; }
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(manualAddr)}.json?access_token=${token}`);
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) throw new Error("Address not found. Try being more specific.");
      const [lng, lat] = feature.center;
      await broadcastLocation(lat, lng, feature.place_name);
    } catch (e: any) { setLiveError(e.message); setLiveStatus("error"); }
  }

  async function goOffline() {
    if (!truckId) return;
    const supabase = createClient();
    await supabase.from("trucks").update({ is_live: false }).eq("id", truckId);
    setLiveStatus("idle"); setIsLive(false); setLiveAddress(null);
    setManualAddr(""); setShowManual(false);
  }

  // ── Analytics ───────────────────────────────────────────────────────────────
  async function loadAnalytics(id: string, r: AnalyticsRange) {
    setAnalyticsLoading(true);
    try {
      const supabase = createClient();
      const now = new Date();
      type Bucket = { label: string; start: Date; end: Date };
      const buckets: Bucket[] = [];
      let startDate: Date;

      if (r === "weekly") {
        startDate = new Date(now); startDate.setDate(startDate.getDate() - 6); startDate.setHours(0,0,0,0);
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now); d.setDate(d.getDate() - i);
          const start = new Date(d); start.setHours(0,0,0,0);
          const end   = new Date(d); end.setHours(23,59,59,999);
          buckets.push({ label: d.toLocaleDateString("en-US",{weekday:"short"}), start, end });
        }
      } else if (r === "monthly") {
        startDate = new Date(now); startDate.setDate(startDate.getDate() - 27); startDate.setHours(0,0,0,0);
        for (let i = 3; i >= 0; i--) {
          const end = new Date(now); end.setDate(end.getDate() - i * 7); end.setHours(23,59,59,999);
          const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0,0,0,0);
          buckets.push({ label: `Wk ${4 - i}`, start, end });
        }
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23,59,59,999);
          buckets.push({ label: d.toLocaleDateString("en-US",{month:"short"}), start: d, end });
        }
      }

      const [followsRes, ordersRes, viewsRes, totalRes] = await Promise.all([
        supabase.from("follows").select("created_at").eq("truck_id", id).gte("created_at", startDate.toISOString()),
        supabase.from("orders").select("created_at,total").eq("truck_id", id).gte("created_at", startDate.toISOString()),
        supabase.from("truck_views").select("created_at").eq("truck_id", id).gte("created_at", startDate.toISOString()),
        supabase.from("follows").select("*",{count:"exact",head:true}).eq("truck_id", id),
      ]);

      const fw = followsRes.data ?? [], or = ordersRes.data ?? [], vw = viewsRes.data ?? [];

      setTotalFollowers(totalRes.count ?? 0);
      setChartData(buckets.map(({ label, start, end }) => ({
        label,
        followers: fw.filter(f => { const d = new Date(f.created_at); return d >= start && d <= end; }).length,
        orders:    or.filter(o => { const d = new Date(o.created_at); return d >= start && d <= end; }).length,
        views:     vw.filter(v => { const d = new Date(v.created_at); return d >= start && d <= end; }).length,
      })));
      setPeriodStats({
        followers: fw.length, orders: or.length, views: vw.length,
        revenue: or.reduce((s, o) => s + (o.total ?? 0), 0),
      });
      setAnalyticsLoaded(true);
    } catch (err) { console.error("analytics error", err); }
    setAnalyticsLoading(false);
  }

  function switchAnalyticsRange(r: AnalyticsRange) {
    setAnalyticsRange(r);
    if (truckId) loadAnalytics(truckId, r);
  }

  // ── Order notifications ──────────────────────────────────────────────────────
  function playNotificationSound() {
    try {
      const ctx = new AudioContext();
      [[880, 0], [1100, 0.18]].forEach(([freq, delay]) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.35);
      });
    } catch { /* AudioContext unavailable */ }
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const supabase = createClient();
    await supabase.from("orders").update({ status }).eq("id", orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
      <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
      <p className="text-neutral-400 text-sm">Loading your dashboard...</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-neutral-800 font-bold">Connection error</p>
      <p className="text-neutral-500 text-sm">{error}</p>
      <button onClick={() => { setError(null); setLoading(true); loadAll(); }}
        className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm">
        Try Again
      </button>
    </div>
  );

  const grouped = menuItems.reduce((acc: Record<string, any[]>, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "live", label: "Go Live",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>,
    },
    {
      key: "profile", label: "Profile",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
    },
    {
      key: "menu", label: "Menu",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    },
    {
      key: "schedule", label: "Schedule",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
    {
      key: "analytics", label: "Analytics",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    },
    {
      key: "orders", label: "Orders",
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
    },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">

      {/* ── Header ── */}
      <div className="bg-neutral-900 px-5 py-4 flex items-center justify-between sticky top-0 z-20"
        style={{ boxShadow: "0 1px 0 rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-red rounded-xl flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div>
            <p className="font-black text-white text-base leading-tight">{profile.name || "My Truck"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isLive ? (
                <>
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"/>
                  </span>
                  <span className="text-[11px] text-green-400 font-bold tracking-wide">LIVE NOW</span>
                </>
              ) : (
                <span className="text-[11px] text-neutral-500 font-medium">Operator Dashboard</span>
              )}
            </div>
          </div>
        </div>
        <a href="/" className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          </svg>
          View Map
        </a>
      </div>

      {/* ── Tab Bar ── */}
      <div className="bg-white border-b border-neutral-100 sticky top-[61px] z-10"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        <div className="flex overflow-x-auto scrollbar-none px-3 py-2 gap-1">
          {TABS.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); if (key === "orders") setNewOrderCount(0); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
                activeTab === key
                  ? "bg-brand-red text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
              }`}
            >
              <span className={activeTab === key ? "text-white" : "text-neutral-400"}>{icon}</span>
              <span className="relative">
                {label}
                {key === "orders" && newOrderCount > 0 && (
                  <span className="absolute -top-3 -right-4 min-w-[18px] h-[18px] bg-green-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow">
                    {newOrderCount}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1">

        {/* ════ GO LIVE ════ */}
        {activeTab === "live" && (
          <div className="p-4 max-w-lg mx-auto flex flex-col items-center gap-5 pt-8">

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 w-full">
              {[
                { label:"Followers", val: totalFollowers },
                { label:"Status",    val: isLive ? "LIVE" : "Offline" },
                { label:"Menu Items",val: menuItems.length },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-2xl shadow-sm p-3 text-center">
                  <p className={`text-xl font-black ${label === "Status" && isLive ? "text-brand-red" : "text-neutral-800"}`}>{val}</p>
                  <p className="text-[10px] text-neutral-400 font-medium mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Big button */}
            <div className="bg-white rounded-3xl shadow-sm p-8 w-full flex flex-col items-center gap-4">
              {liveStatus === "idle" && (
                <>
                  <button onClick={goLiveGPS}
                    className="w-52 h-52 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform"
                    style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.35)" }}>
                    <span className="text-2xl font-black">Go Live</span>
                    <span className="text-sm opacity-80">at my location</span>
                  </button>
                  <button onClick={() => setShowManual(!showManual)} className="text-sm text-neutral-400">
                    {showManual ? "Hide manual entry" : "GPS not working? Enter address"}
                  </button>
                  {showManual && (
                    <div className="w-full flex flex-col gap-2">
                      <input value={manualAddr} onChange={e => setManualAddr(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && goLiveManual()}
                        placeholder="e.g. 123 Main St, Newark NJ"
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"/>
                      <button onClick={goLiveManual} disabled={!manualAddr.trim()}
                        className="w-full py-3 rounded-xl bg-brand-red text-white font-bold text-sm disabled:opacity-40">
                        Go Live at This Address
                      </button>
                    </div>
                  )}
                  {liveError && <p className="text-sm text-red-500 text-center">{liveError}</p>}
                </>
              )}
              {liveStatus === "locating" && (
                <div className="w-52 h-52 rounded-full bg-neutral-100 flex flex-col items-center justify-center gap-3 animate-pulse">
                  <span className="text-xl font-bold text-neutral-500">Finding you...</span>
                </div>
              )}
              {liveStatus === "live" && (
                <>
                  <div className="w-52 h-52 rounded-full bg-brand-red text-white flex flex-col items-center justify-center gap-3"
                    style={{ boxShadow: "0 8px 40px rgba(217,79,61,0.35)" }}>
                    <span className="relative flex h-5 w-5 mb-1">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75"/>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-red-200"/>
                    </span>
                    <span className="text-xl font-black">You&apos;re Live!</span>
                    {liveAddress && <span className="text-xs opacity-80 text-center px-6">{liveAddress}</span>}
                  </div>
                  <button onClick={goOffline}
                    className="px-6 py-3 rounded-full border-2 border-neutral-300 text-neutral-600 font-semibold text-sm">
                    Go Offline
                  </button>
                </>
              )}
              {liveStatus === "error" && (
                <>
                  <div className="w-52 h-52 rounded-full bg-neutral-100 border-2 border-red-100 flex items-center justify-center px-8 text-center">
                    <span className="text-sm text-neutral-500">{liveError}</span>
                  </div>
                  <button onClick={() => { setLiveStatus("idle"); setLiveError(null); }}
                    className="px-6 py-3 rounded-full bg-brand-red text-white font-bold text-sm">
                    Try Again
                  </button>
                </>
              )}
            </div>
            <div className="h-4"/>
          </div>
        )}

        {/* ════ PROFILE ════ */}
        {activeTab === "profile" && (
          <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto pb-10">

            {!truckId && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3 flex items-center gap-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-orange-700 font-medium">Fill in your truck name and tap <strong>Save Profile</strong> to get started.</p>
              </div>
            )}

            {/* Photo */}
            <div className="flex flex-col items-center py-2">
              <div onClick={() => photoRef.current?.click()}
                className="w-28 h-28 rounded-full bg-neutral-200 overflow-hidden cursor-pointer relative mb-3 border-4 border-white shadow-md">
                {profile.profile_photo
                  ? <img src={profile.profile_photo} alt="Truck" className="w-full h-full object-cover"/>
                  : <div className="w-full h-full flex items-center justify-center">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                        <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                      </svg>
                    </div>}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
                  <span className="text-white text-xs font-semibold">Change</span>
                </div>
              </div>
              <p className="text-sm text-neutral-400">{photoUploading ? "Uploading..." : "Tap to add photo"}</p>
              <input ref={photoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadProfilePhoto(f); }}/>
            </div>

            {/* Fields */}
            <Field label="Truck Name *">
              <input value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. The Taco Truck"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"/>
            </Field>

            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-2">Cuisine Type</p>
              <div className="flex flex-wrap gap-2">
                {CUISINE_TYPES.map(c => (
                  <button key={c} type="button"
                    onClick={() => setProfile(p => ({ ...p, cuisine: p.cuisine === c ? "" : c }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      profile.cuisine === c
                        ? "bg-brand-red text-white border-brand-red"
                        : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Description">
              <textarea value={profile.description}
                onChange={e => setProfile(p => ({ ...p, description: e.target.value.slice(0,200) }))}
                placeholder="Tell customers what makes your truck special..."
                rows={3} maxLength={200}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red resize-none bg-white"/>
              <p className={`text-xs mt-1 ${profile.description.length >= 190 ? "text-brand-red" : "text-neutral-400"}`}>
                {profile.description.length}/200
              </p>
            </Field>

            <Field label="Phone Number">
              <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                placeholder="(201) 555-0123" type="tel"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"/>
            </Field>

            <Field label="Instagram">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">@</span>
                <input value={profile.instagram}
                  onChange={e => setProfile(p => ({ ...p, instagram: e.target.value.replace("@","") }))}
                  placeholder="yourtruck"
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"/>
              </div>
            </Field>

            <button onClick={saveProfile} disabled={profileSaving || !profile.name.trim()}
              className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base disabled:opacity-40 transition-opacity">
              {profileSaving ? "Saving..." : profileSaved ? "Saved ✓" : truckId ? "Save Profile" : "Create My Truck"}
            </button>
          </div>
        )}

        {/* ════ MENU ════ */}
        {activeTab === "menu" && (
          <div className="pb-10">
            {/* Menu header */}
            <div className="bg-white px-4 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <p className="font-black text-neutral-900 text-base uppercase tracking-wide">Menu Manager</p>
                <p className="text-xs text-neutral-400">{menuItems.length} item{menuItems.length !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={openAddItem}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-full text-sm font-bold">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Item
              </button>
            </div>

            <div className="px-4 py-4 max-w-2xl mx-auto">
              {!truckId ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                  <p className="font-bold text-neutral-700 mb-1">Set up your profile first</p>
                  <p className="text-sm text-neutral-400 mb-4">Create your truck profile before adding menu items.</p>
                  <button onClick={() => setActiveTab("profile")}
                    className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold">
                    Go to Profile
                  </button>
                </div>
              ) : menuItems.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
                  <p className="font-bold text-neutral-700 mb-1">No menu items yet</p>
                  <p className="text-sm text-neutral-400 mb-4">Add your first item to get started</p>
                  <button onClick={openAddItem} className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold">
                    Add First Item
                  </button>
                </div>
              ) : (
                Object.entries(grouped).map(([cat, items]) => (
                  <div key={cat} className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest">{cat}</h2>
                      <div className="flex-1 h-px bg-neutral-200"/>
                      <span className="text-xs text-neutral-400">{items.length}</span>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {items.map((item, idx) => (
                        <div key={item.id}
                          className={`flex gap-3 p-4 ${idx < items.length - 1 ? "border-b border-neutral-100" : ""} ${item.is_sold_out ? "opacity-50" : ""}`}>
                          <div className="w-20 h-20 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                            {item.photo
                              ? <img src={item.photo} alt={item.name} className="w-full h-full object-cover"/>
                              : <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                                  </svg>
                                </div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className={`font-black text-sm uppercase tracking-wide ${item.is_sold_out ? "line-through text-neutral-400" : "text-neutral-900"}`}>
                                  {item.name}
                                </p>
                                {item.is_popular && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-brand-red rounded-full">POPULAR</span>
                                )}
                              </div>
                              <p className="text-brand-red font-black flex-shrink-0">${parseFloat(item.price).toFixed(2)}</p>
                            </div>
                            {item.description && <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{item.description}</p>}
                            {item.allergens?.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.allergens.map((a: string) => (
                                  <span key={a} className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">{a}</span>
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <button onClick={() => toggleSoldOut(item)}
                                className={`text-xs font-bold px-3 py-1 rounded-full ${item.is_sold_out ? "bg-neutral-100 text-neutral-500" : "bg-red-50 text-brand-red"}`}>
                                {item.is_sold_out ? "Mark Available" : "Mark Sold Out"}
                              </button>
                              <button onClick={() => openEditItem(item)} className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold">Edit</button>
                              <button onClick={() => deleteMenuItem(item.id)} className="text-xs text-red-300 hover:text-red-500 font-semibold">Delete</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ════ SCHEDULE ════ */}
        {activeTab === "schedule" && (
          <div className="pb-10">
            {!truckId ? (
              <div className="p-6 text-center">
                <p className="font-bold text-neutral-700 mb-1">Set up your profile first</p>
                <p className="text-sm text-neutral-400 mb-4">Create your truck profile before adding a schedule.</p>
                <button onClick={() => setActiveTab("profile")} className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold">
                  Go to Profile
                </button>
              </div>
            ) : (
              <>
                {/* Day selector */}
                <div className="bg-white border-b border-neutral-100 px-4 py-3">
                  <div className="flex gap-2 overflow-x-auto scrollbar-none">
                    {DAYS.map((day, i) => {
                      const hasEntry = schedule.some(s => s.day_of_week === i);
                      const isToday  = i === new Date().getDay();
                      return (
                        <button key={day} onClick={() => setSchedDay(i)}
                          className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
                            schedDay === i ? "bg-brand-red text-white" : "bg-neutral-100 text-neutral-600"}`}>
                          <span className="text-xs font-medium">{day}</span>
                          {isToday && <span className={`text-[9px] font-black ${schedDay === i ? "text-red-200" : "text-brand-red"}`}>TODAY</span>}
                          {hasEntry && <span className={`w-1.5 h-1.5 rounded-full ${schedDay === i ? "bg-red-200" : "bg-brand-red"}`}/>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-3 max-w-lg mx-auto">
                  {schedule.filter(s => s.day_of_week === schedDay).length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-neutral-500 font-medium">No stops for {DAYS[schedDay]}</p>
                      <p className="text-neutral-400 text-sm mt-1">Tap below to add a location</p>
                    </div>
                  ) : (
                    schedule.filter(s => s.day_of_week === schedDay).map(entry => (
                      <div key={entry.id} className="bg-white rounded-2xl shadow-sm p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-neutral-800">{entry.location}</p>
                            <p className="text-sm text-brand-red font-medium mt-0.5">{entry.open_time} – {entry.close_time}</p>
                            {entry.notes && <p className="text-xs text-neutral-400 mt-1">{entry.notes}</p>}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => openEditSched(entry)} className="text-xs text-neutral-400 hover:text-neutral-600 font-semibold">Edit</button>
                            <button onClick={() => deleteSchedEntry(entry.id)} className="text-xs text-red-300 hover:text-red-500 font-semibold">Remove</button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <button onClick={() => openAddSched(schedDay)}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 font-medium text-sm hover:border-brand-red hover:text-brand-red transition-colors">
                    + Add Location for {DAYS[schedDay]}
                  </button>

                  {/* Weekly overview */}
                  <div className="mt-2">
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Full Week</p>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      {DAYS.map((day, i) => {
                        const entries = schedule.filter(s => s.day_of_week === i);
                        const isToday = i === new Date().getDay();
                        return (
                          <div key={day} onClick={() => setSchedDay(i)}
                            className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 cursor-pointer hover:bg-neutral-50 ${isToday ? "bg-red-50" : ""}`}>
                            <span className={`text-sm font-bold w-8 ${isToday ? "text-brand-red" : "text-neutral-400"}`}>{day}</span>
                            <div className="flex-1 text-sm">
                              {entries.length === 0
                                ? <span className="text-neutral-300">No stops</span>
                                : entries.map(e => (
                                    <p key={e.id} className="text-neutral-700">
                                      {e.location}
                                      <span className="text-neutral-400 ml-2 text-xs">{e.open_time}–{e.close_time}</span>
                                    </p>
                                  ))}
                            </div>
                            {isToday && <span className="text-[10px] font-black text-brand-red bg-red-50 px-2 py-0.5 rounded-full">TODAY</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ════ ANALYTICS ════ */}
        {activeTab === "analytics" && (
          <div className="p-4 flex flex-col gap-4 max-w-2xl mx-auto pb-10">
            {!truckId ? (
              <div className="text-center py-16">
                <p className="font-bold text-neutral-700 mb-1">No analytics yet</p>
                <p className="text-sm text-neutral-400 mb-4">Create your truck profile to start tracking data.</p>
                <button onClick={() => setActiveTab("profile")} className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold">
                  Go to Profile
                </button>
              </div>
            ) : (
              <>
                {/* Total followers */}
                <div className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center flex-shrink-0">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-3xl font-black text-neutral-900">{totalFollowers.toLocaleString()}</p>
                    <p className="text-sm text-neutral-500">Total Followers</p>
                  </div>
                </div>

                {/* Range tabs */}
                <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
                  {(["weekly","monthly","yearly"] as AnalyticsRange[]).map(r => (
                    <button key={r} onClick={() => switchAnalyticsRange(r)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all capitalize ${
                        analyticsRange === r ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-800"}`}>
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </button>
                  ))}
                </div>

                {/* Period stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label:"New Followers", val: periodStats.followers.toLocaleString(), color:"bg-red-50" },
                    { label:"Orders",        val: periodStats.orders.toLocaleString(),    color:"bg-orange-50" },
                    { label:"Profile Views", val: periodStats.views.toLocaleString(),     color:"bg-blue-50" },
                    { label:"Revenue",       val: `$${periodStats.revenue.toFixed(2)}`,   color:"bg-green-50" },
                  ].map(({ label, val, color }) => (
                    <div key={label} className={`${color} rounded-2xl p-4`}>
                      <p className="text-xs text-neutral-500 font-semibold mb-1">{label}</p>
                      <p className="text-2xl font-black text-neutral-900">{val}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {analyticsLoading ? (
                  <div className="bg-white rounded-2xl shadow-sm p-8 flex items-center justify-center">
                    <p className="text-neutral-400 text-sm">Loading chart...</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <p className="text-sm font-bold text-neutral-800 mb-4">Followers &amp; Orders</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={chartData} barCategoryGap="28%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false}/>
                        <XAxis dataKey="label" tick={{ fontSize:11, fill:"#aaa" }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fontSize:11, fill:"#aaa" }} axisLine={false} tickLine={false} allowDecimals={false} width={28}/>
                        <Tooltip contentStyle={{ borderRadius:"12px", border:"none", boxShadow:"0 4px 20px rgba(0,0,0,0.12)", fontSize:"12px" }} cursor={{ fill:"rgba(0,0,0,0.03)" }}/>
                        <Legend wrapperStyle={{ fontSize:"11px", paddingTop:"12px" }} iconType="circle" iconSize={8}/>
                        <Bar dataKey="followers" name="New Followers" fill="#E8481C" radius={[4,4,0,0]} maxBarSize={40}/>
                        <Bar dataKey="orders"    name="Orders"        fill="#FB923C" radius={[4,4,0,0]} maxBarSize={40}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ════ ORDERS ════ */}
        {activeTab === "orders" && (
          <div className="p-4 max-w-2xl mx-auto pb-10">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-black text-neutral-800 text-xl">Incoming Orders</h2>
                <p className="text-xs text-neutral-400 mt-0.5">Updates in real time — no refresh needed</p>
              </div>
              {orders.length > 0 && (
                <span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-3 py-1.5 rounded-full">
                  {orders.length} total
                </span>
              )}
            </div>

            {!truckId ? (
              <div className="text-center py-16">
                <p className="font-bold text-neutral-700 mb-1">No truck set up yet</p>
                <p className="text-sm text-neutral-400 mb-4">Create your profile first to receive orders.</p>
                <button onClick={() => setActiveTab("profile")}
                  className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold">
                  Go to Profile
                </button>
              </div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center py-16 gap-3">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                </div>
                <p className="text-neutral-500 font-semibold">No orders yet</p>
                <p className="text-neutral-400 text-sm text-center px-8">
                  When customers place orders from your menu, they&apos;ll appear here instantly.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {/* Pending first, then by time */}
                {["pending", "preparing", "ready", "picked_up"].map((statusGroup) => {
                  const groupOrders = orders.filter((o) => o.status === statusGroup);
                  if (groupOrders.length === 0) return null;
                  const statusLabel: Record<string, string> = {
                    pending: "New Orders",
                    preparing: "Preparing",
                    ready: "Ready for Pickup",
                    picked_up: "Picked Up",
                  };
                  const statusColor: Record<string, string> = {
                    pending: "text-amber-600 bg-amber-50 border-amber-200",
                    preparing: "text-blue-600 bg-blue-50 border-blue-200",
                    ready: "text-green-600 bg-green-50 border-green-200",
                    picked_up: "text-neutral-400 bg-neutral-50 border-neutral-200",
                  };
                  return (
                    <div key={statusGroup}>
                      <p className={`text-xs font-black uppercase tracking-widest px-3 py-1.5 rounded-full border inline-block mb-3 ${statusColor[statusGroup]}`}>
                        {statusLabel[statusGroup]} · {groupOrders.length}
                      </p>
                      <div className="flex flex-col gap-3">
                        {groupOrders.map((order) => {
                          const items: any[] = order.items ?? [];
                          const timeAgo = (() => {
                            const diff = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000);
                            if (diff < 60) return `${diff}s ago`;
                            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
                            return `${Math.floor(diff / 3600)}h ago`;
                          })();
                          return (
                            <div key={order.id}
                              className={`bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 ${
                                order.status === "pending"   ? "border-amber-400" :
                                order.status === "preparing" ? "border-blue-400"  :
                                order.status === "ready"     ? "border-green-400" :
                                "border-neutral-200"
                              }`}
                            >
                              {/* Order header */}
                              <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="font-black text-neutral-900 text-base">
                                      {order.pickup_name ?? "Customer"}
                                    </p>
                                    <span className="text-[10px] font-bold text-neutral-400 bg-neutral-100 px-2 py-0.5 rounded-full font-mono">
                                      #{order.id.slice(0, 6).toUpperCase()}
                                    </span>
                                  </div>
                                  <p className="text-xs text-neutral-400 mt-0.5">{timeAgo}</p>
                                </div>
                                <p className="font-black text-brand-red text-lg">${(order.total ?? 0).toFixed(2)}</p>
                              </div>

                              {/* Items */}
                              <div className="px-4 pb-3 border-t border-neutral-50 pt-3 flex flex-col gap-1">
                                {items.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center justify-between text-sm">
                                    <span className="text-neutral-700">
                                      <span className="font-bold text-neutral-400 mr-1.5">{item.quantity}×</span>
                                      {item.name}
                                    </span>
                                    <span className="text-neutral-400">${(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                                {order.notes && (
                                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mt-1">
                                    📝 {order.notes}
                                  </p>
                                )}
                              </div>

                              {/* Status actions */}
                              {order.status !== "picked_up" && (
                                <div className="px-4 pb-4 flex gap-2">
                                  {order.status === "pending" && (
                                    <button
                                      onClick={() => updateOrderStatus(order.id, "preparing")}
                                      className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
                                    >
                                      Start Preparing
                                    </button>
                                  )}
                                  {order.status === "preparing" && (
                                    <button
                                      onClick={() => updateOrderStatus(order.id, "ready")}
                                      className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
                                    >
                                      Mark Ready
                                    </button>
                                  )}
                                  {order.status === "ready" && (
                                    <button
                                      onClick={() => updateOrderStatus(order.id, "picked_up")}
                                      className="flex-1 py-2.5 bg-neutral-800 text-white rounded-xl font-bold text-sm active:scale-95 transition-all"
                                    >
                                      Picked Up ✓
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* ════ MENU MODAL ════ */}
      {menuModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-black text-neutral-900">{editingItem ? "Edit Item" : "New Item"}</h2>
              <button onClick={() => setMenuModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Photo */}
              <div onClick={() => menuPhotoRef.current?.click()}
                className="w-full h-36 rounded-2xl overflow-hidden cursor-pointer bg-neutral-100 border-2 border-dashed border-neutral-200 hover:border-brand-red transition-colors flex items-center justify-center relative">
                {itemForm.photo
                  ? <img src={itemForm.photo} alt="preview" className="w-full h-full object-cover"/>
                  : <p className="text-sm text-neutral-400">{menuUploading ? "Uploading..." : "Tap to add photo"}</p>}
                {itemForm.photo && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm font-bold">Change Photo</p>
                  </div>
                )}
              </div>
              <input ref={menuPhotoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadMenuPhoto(f); }}/>

              <Field label="Item Name *">
                <input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Al Pastor Taco"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"/>
              </Field>

              <Field label="Description">
                <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Marinated pork, pineapple, cilantro..." rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red resize-none"/>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price *">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">$</span>
                    <input type="number" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.00" step="0.01" min="0"
                      className="w-full pl-7 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"/>
                  </div>
                </Field>
                <Field label="Category">
                  <input value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Tacos, Sides"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"/>
                </Field>
              </div>

              <div>
                <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">Allergens</p>
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map(tag => (
                    <button key={tag} type="button"
                      onClick={() => setItemForm(f => ({ ...f, allergens: f.allergens.includes(tag) ? f.allergens.filter(a => a !== tag) : [...f.allergens, tag] }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                        itemForm.allergens.includes(tag)
                          ? "bg-orange-50 border-orange-400 text-orange-600"
                          : "bg-white border-neutral-200 text-neutral-500"}`}>
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-neutral-200 rounded-2xl overflow-hidden">
                {[
                  { key:"is_popular" as const, label:"Mark as Popular", desc:"Shows a Popular badge" },
                  { key:"is_sold_out" as const, label:"Mark as Sold Out", desc:"Item greyed out on menu" },
                ].map(({ key, label, desc }, i) => (
                  <div key={key} className={`flex items-center justify-between px-4 py-3.5 ${i === 0 ? "border-b border-neutral-100" : ""}`}>
                    <div>
                      <p className="text-sm font-bold text-neutral-800">{label}</p>
                      <p className="text-xs text-neutral-400">{desc}</p>
                    </div>
                    <button onClick={() => setItemForm(f => ({ ...f, [key]: !f[key] }))}
                      className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${itemForm[key] ? "bg-brand-red" : "bg-neutral-200"}`}>
                      <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${itemForm[key] ? "translate-x-6" : "translate-x-0"}`}/>
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={saveMenuItem} disabled={menuSaving || !itemForm.name || !itemForm.price}
                className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base disabled:opacity-40 mb-2">
                {menuSaving ? "Saving..." : editingItem ? "Save Changes" : "Add to Menu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ SCHEDULE MODAL ════ */}
      {schedModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-neutral-800">
                {editingSched ? "Edit Stop" : `Add Stop — ${DAYS[schedForm.day_of_week]}`}
              </h2>
              <button onClick={() => setSchedModal(false)} className="text-neutral-400 text-2xl leading-none">×</button>
            </div>

            <Field label="Location *">
              <input value={schedForm.location} onChange={e => setSchedForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Main St & 5th Ave, Newark NJ"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"/>
            </Field>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Field label="Opening Time">
                <select value={schedForm.open_time} onChange={e => setSchedForm(f => ({ ...f, open_time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red">
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
              <Field label="Closing Time">
                <select value={schedForm.close_time} onChange={e => setSchedForm(f => ({ ...f, close_time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red">
                  {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4 mb-6">
              <Field label="Notes">
                <input value={schedForm.notes} onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Near the farmers market"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"/>
              </Field>
            </div>

            <button onClick={saveSchedEntry} disabled={schedSaving || !schedForm.location}
              className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40">
              {schedSaving ? "Saving..." : editingSched ? "Save Changes" : "Add to Schedule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small helper component ───────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-neutral-700 mb-1.5">{label}</p>
      {children}
    </div>
  );
}
