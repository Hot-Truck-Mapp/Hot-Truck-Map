"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
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
    dietary_tags: [] as string[],
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

  // Toast notifications
  const [toast, setToast] = useState<{msg: string; isError?: boolean} | null>(null);
  function showToast(msg: string, isError = true) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  }

  // Inline delete confirms
  const [deletingMenuId, setDeletingMenuId]   = useState<string | null>(null);
  const [deletingSchedId, setDeletingSchedId] = useState<string | null>(null);

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
  const [allTimeOrders, setAllTimeOrders]       = useState(0);
  const [allTimeRevenue, setAllTimeRevenue]     = useState(0);

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
      // Redirect non-operators back to home
      if (user.user_metadata?.role !== "operator") {
        window.location.href = "/";
        return;
      }
      setUserId(user.id);

      const { data: truck } = await supabase
        .from("trucks").select("*").eq("owner_id", user.id).maybeSingle();

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
          dietary_tags:  truck.dietary_tags  ?? [],
        });
        if (truck.is_live) {
          setLiveStatus("live");
          // Re-hydrate the live address so the "You're Live!" card shows the location
          const { data: loc } = await supabase
            .from("locations").select("address").eq("truck_id", truck.id).maybeSingle();
          if (loc?.address) setLiveAddress(loc.address);
        }

        const [menuRes, schedRes, ordersRes, followsRes] = await Promise.all([
          supabase.from("menu_items").select("*").eq("truck_id", truck.id).order("created_at"),
          supabase.from("schedules").select("*").eq("truck_id", truck.id).order("day_of_week"),
          supabase.from("orders").select("*").eq("truck_id", truck.id).order("created_at", { ascending: false }).limit(100),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("truck_id", truck.id),
        ]);
        setMenuItems(menuRes.data ?? []);
        setSchedule(schedRes.data ?? []);
        setOrders(ordersRes.data ?? []);
        setTotalFollowers(followsRes.count ?? 0);

        // Route new (incomplete) operators to Profile tab so they fill it in first
        if (!truck.description || !truck.phone) {
          setActiveTab("profile");
        }
      } else {
        // No truck at all — operator just signed up, go straight to profile setup
        setActiveTab("profile");
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
    } catch { showToast("Photo upload failed"); }
    setPhotoUploading(false);
  }

  async function saveProfile() {
    if (!profile.name.trim() || !userId) return;
    setProfileSaving(true);
    try {
      const supabase = createClient();
      if (truckId) {
        const { error } = await supabase.from("trucks").update({
          name: profile.name.trim(), description: profile.description,
          cuisine: profile.cuisine, phone: profile.phone,
          instagram: profile.instagram, profile_photo: profile.profile_photo,
          dietary_tags: profile.dietary_tags,
        }).eq("id", truckId);
        if (error) throw new Error(error.message);
      } else {
        const { data: newTruck, error } = await supabase.from("trucks").insert({
          owner_id: userId, name: profile.name.trim(),
          description: profile.description, cuisine: profile.cuisine,
          phone: profile.phone, instagram: profile.instagram,
          profile_photo: profile.profile_photo, is_live: false,
          dietary_tags: profile.dietary_tags,
        }).select("id").single();
        if (error) throw new Error(error.message);
        if (newTruck) setTruckId(newTruck.id);
      }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) { showToast("Save failed: " + (err?.message ?? "Please try again.")); }
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
    } catch { showToast("Photo upload failed"); }
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
        const { error } = await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);
        if (error) throw new Error(error.message);
      }
      const { data } = await supabase.from("menu_items").select("*").eq("truck_id", truckId).order("created_at");
      setMenuItems(data ?? []);
      setMenuModal(false);
    } catch (err: any) {
      showToast("Save failed: " + (err?.message ?? "Please try again."));
    }
    setMenuSaving(false);
  }

  async function deleteMenuItem(id: string) {
    if (deletingMenuId !== id) { setDeletingMenuId(id); return; }
    setDeletingMenuId(null);
    const supabase = createClient();
    const { error } = await supabase.from("menu_items").delete().eq("id", id);
    if (!error) setMenuItems(items => items.filter(i => i.id !== id));
    else showToast("Delete failed: " + error.message);
  }

  async function toggleSoldOut(item: any) {
    const supabase = createClient();
    const { error } = await supabase.from("menu_items").update({ is_sold_out: !item.is_sold_out }).eq("id", item.id);
    if (!error) setMenuItems(items => items.map(i => i.id === item.id ? { ...i, is_sold_out: !i.is_sold_out } : i));
    else showToast("Could not update item: " + error.message);
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
        const { error } = await supabase.from("schedules").update(payload).eq("id", editingSched.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("schedules").insert(payload);
        if (error) throw new Error(error.message);
      }
      const { data } = await supabase.from("schedules").select("*").eq("truck_id", truckId).order("day_of_week");
      setSchedule(data ?? []);
      setSchedModal(false);
    } catch (err: any) { showToast("Save failed: " + (err?.message ?? "Please try again.")); }
    setSchedSaving(false);
  }

  async function deleteSchedEntry(id: string) {
    if (deletingSchedId !== id) { setDeletingSchedId(id); return; }
    setDeletingSchedId(null);
    const supabase = createClient();
    const { error } = await supabase.from("schedules").delete().eq("id", id);
    if (!error) setSchedule(s => s.filter(e => e.id !== id));
    else showToast("Delete failed: " + error.message);
  }

  // ── Go Live ─────────────────────────────────────────────────────────────────
  async function broadcastLocation(lat: number, lng: number, address: string) {
    const supabase = createClient();
    if (!truckId) return;
    const { error: upsertErr } = await supabase.from("locations").upsert(
      { truck_id: truckId, lat, lng, address, broadcasted_at: new Date().toISOString() },
      { onConflict: "truck_id" }
    );
    if (upsertErr) throw new Error(upsertErr.message);
    const { error: updateErr } = await supabase.from("trucks").update({ is_live: true }).eq("id", truckId);
    if (updateErr) throw new Error(updateErr.message);
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
    if (!truckId) { showToast("Save your truck profile first."); setActiveTab("profile"); return; }
    if (!profile.description || !profile.phone) { showToast("Complete your profile (description + phone) before going live."); setActiveTab("profile"); return; }
    if (menuItems.length === 0) { showToast("Add at least one menu item before going live."); setActiveTab("menu"); return; }
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
    const { error } = await supabase.from("trucks").update({ is_live: false }).eq("id", truckId);
    if (error) { showToast("Could not go offline: " + error.message); return; }
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

      const [followsRes, ordersRes, viewsRes, totalFollowsRes, allOrdersRes] = await Promise.all([
        supabase.from("follows").select("created_at").eq("truck_id", id).gte("created_at", startDate.toISOString()),
        supabase.from("orders").select("created_at,total").eq("truck_id", id).gte("created_at", startDate.toISOString()),
        supabase.from("truck_views").select("created_at").eq("truck_id", id).gte("created_at", startDate.toISOString()),
        supabase.from("follows").select("*",{count:"exact",head:true}).eq("truck_id", id),
        supabase.from("orders").select("total").eq("truck_id", id),
      ]);

      const fw = followsRes.data ?? [], or = ordersRes.data ?? [], vw = viewsRes.data ?? [];
      const allOrders = allOrdersRes.data ?? [];

      setTotalFollowers(totalFollowsRes.count ?? 0);
      setAllTimeOrders(allOrders.length);
      setAllTimeRevenue(allOrders.reduce((s, o) => s + (o.total ?? 0), 0));
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
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (!error) setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));
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
      <div className="bg-neutral-900 px-5 py-4 flex items-center justify-between sticky top-0 z-20 h-[61px]"
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

      {/* ── Mobile Tab Bar (hidden on desktop) ── */}
      <div className="md:hidden bg-white border-b border-neutral-100 sticky top-[61px] z-10"
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

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Desktop Sidebar (hidden on mobile) */}
        <aside className="hidden md:flex flex-col bg-white border-r border-neutral-100 w-56 shrink-0 sticky top-[61px] h-[calc(100vh-61px)] overflow-y-auto"
          style={{ boxShadow: "2px 0 8px rgba(0,0,0,0.04)" }}>
          <div className="flex flex-col gap-1 p-3 flex-1">
            {TABS.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => { setActiveTab(key); if (key === "orders") setNewOrderCount(0); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                  activeTab === key
                    ? "bg-brand-red text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
                }`}
              >
                <span className={`flex-shrink-0 ${activeTab === key ? "text-white" : "text-neutral-400"}`}>{icon}</span>
                <span className="relative flex-1">
                  {label}
                  {key === "orders" && newOrderCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] bg-green-500 text-white text-[10px] font-black rounded-full px-1">
                      {newOrderCount}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="p-3 border-t border-neutral-100">
            <p className="text-[10px] text-neutral-300 font-medium px-4">HOT TRUCK MAPS</p>
          </div>
        </aside>

        {/* ── Tab Content ── */}
        <div className="flex-1 overflow-y-auto">

        {/* ════ GO LIVE ════ */}
        {activeTab === "live" && (
          <div className="p-4 max-w-lg mx-auto flex flex-col items-center gap-5 pt-8">

            {/* Onboarding checklist — shown until profile + menu are set up */}
            {(!profile.phone || !profile.description || menuItems.length === 0) && (() => {
              const steps = [
                { done: !!profile.name && !!profile.description, label: "Complete your truck profile", action: () => setActiveTab("profile"), cta: "Complete Profile" },
                { done: !!profile.phone, label: "Add phone number for order alerts", action: () => setActiveTab("profile"), cta: "Add Phone" },
                { done: menuItems.length > 0, label: "Add at least one menu item", action: () => setActiveTab("menu"), cta: "Add Menu Item" },
              ];
              const doneCount = steps.filter(s => s.done).length;
              const pct = Math.round((doneCount / steps.length) * 100);
              return (
                <div className="w-full bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-black text-neutral-800">Setup Checklist</p>
                      <span className="text-xs font-bold text-neutral-400">{doneCount}/{steps.length} done</span>
                    </div>
                    <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-red rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="divide-y divide-neutral-50">
                    {steps.map(({ done, label, action, cta }) => (
                      <div key={label} className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${done ? "bg-green-500" : "bg-neutral-100"}`}>
                          {done
                            ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                            : <span className="w-2 h-2 rounded-full bg-neutral-300" />}
                        </div>
                        <p className={`flex-1 text-sm ${done ? "line-through text-neutral-300" : "text-neutral-700 font-semibold"}`}>{label}</p>
                        {!done && (
                          <button onClick={action}
                            className="text-xs text-brand-red font-bold bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0">
                            {cta} →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                  {(() => {
                    const readyToLive = !!profile.description && !!profile.phone && menuItems.length > 0;
                    return (
                      <>
                        <button onClick={goLiveGPS}
                          className={`w-52 h-52 rounded-full text-white flex flex-col items-center justify-center gap-2 transition-all ${readyToLive ? "bg-brand-red active:scale-95" : "bg-neutral-300 cursor-not-allowed"}`}
                          style={readyToLive ? { boxShadow: "0 8px 40px rgba(217,79,61,0.35)" } : {}}>
                          <span className="text-2xl font-black">Go Live</span>
                          <span className="text-sm opacity-80">at my location</span>
                        </button>
                        {!readyToLive && (
                          <p className="text-xs text-neutral-400 text-center -mt-1">Complete the checklist above to go live</p>
                        )}
                      </>
                    );
                  })()}
                  <button onClick={() => setShowManual(!showManual)} className="text-sm text-neutral-400">
                    {showManual ? "Hide manual entry" : "GPS not working? Enter address"}
                  </button>
                  {showManual && (
                    <div className="w-full flex flex-col gap-2">
                      <input value={manualAddr} onChange={e => setManualAddr(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && goLiveManual()}
                        placeholder="e.g. 123 Main St, Newark NJ"
                        className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red"/>
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
              <div className="bg-neutral-900 rounded-2xl p-5 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-black text-base leading-tight">Welcome to Hot Truck Maps!</p>
                    <p className="text-neutral-400 text-xs mt-0.5">Let&apos;s get your truck on the map — takes under 2 minutes.</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    "Fill in your truck name and description below",
                    "Add a phone number to receive order alerts",
                    "Upload a photo so customers recognize you",
                  ].map((step, i) => (
                    <div key={step} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-black text-white">{i + 1}</span>
                      </div>
                      <p className="text-neutral-300 text-xs">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Photo */}
            <div className="flex flex-col items-center py-2">
              <div onClick={() => photoRef.current?.click()}
                className="w-28 h-28 rounded-full bg-neutral-200 overflow-hidden cursor-pointer relative mb-3 border-4 border-white shadow-md">
                {profile.profile_photo
                  ? <Image src={profile.profile_photo} alt="Truck" fill className="object-cover"/>
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
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
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

            {/* Dietary Tags */}
            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-1">Dietary Options</p>
              <p className="text-xs text-neutral-400 mb-2">Shown on the truck list so customers with dietary needs can find you</p>
              <div className="flex flex-wrap gap-2">
                {["Vegan", "Vegetarian", "Gluten-Free", "Halal", "Kosher"].map(tag => (
                  <button key={tag} type="button"
                    onClick={() => setProfile(p => ({
                      ...p,
                      dietary_tags: p.dietary_tags.includes(tag)
                        ? p.dietary_tags.filter(t => t !== tag)
                        : [...p.dietary_tags, tag],
                    }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                      profile.dietary_tags.includes(tag)
                        ? "bg-green-600 text-white border-green-600"
                        : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}>
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Description">
              <textarea value={profile.description}
                onChange={e => setProfile(p => ({ ...p, description: e.target.value.slice(0,200) }))}
                placeholder="Tell customers what makes your truck special..."
                rows={3} maxLength={200}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red resize-none bg-white"/>
              <p className={`text-xs mt-1 ${profile.description.length >= 190 ? "text-brand-red" : "text-neutral-400"}`}>
                {profile.description.length}/200
              </p>
            </Field>

            <div>
              <p className="text-sm font-semibold text-neutral-700 mb-1.5">
                Phone Number
                <span className="ml-2 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  SMS order alerts
                </span>
              </p>
              <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                placeholder="(201) 555-0123" type="tel"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
              <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                You&apos;ll get a text message every time a customer places an order
              </p>
            </div>

            <Field label="Instagram">
              <div className="relative flex items-center">
                <span className="absolute left-4 text-neutral-400 text-base font-semibold select-none pointer-events-none">@</span>
                <input value={profile.instagram}
                  onChange={e => setProfile(p => ({ ...p, instagram: e.target.value.replace("@","") }))}
                  placeholder="yourtruck"
                  className="w-full pl-8 pr-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
              </div>
            </Field>

            <button onClick={saveProfile} disabled={profileSaving || !profile.name.trim()}
              className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base disabled:opacity-40 transition-opacity">
              {profileSaving ? "Saving..." : profileSaved ? "Saved ✓" : truckId ? "Save Profile" : "Create My Truck"}
            </button>

            {profileSaved && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                  </div>
                  <p className="text-green-800 font-bold text-sm">Profile saved!</p>
                </div>
                {menuItems.length === 0 && (
                  <div className="flex items-center justify-between bg-white border border-green-100 rounded-xl px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-neutral-800">Add your menu items</p>
                      <p className="text-xs text-neutral-400 mt-0.5">Let customers browse and order before they arrive</p>
                    </div>
                    <button
                      onClick={() => setActiveTab("menu")}
                      className="ml-3 flex-shrink-0 px-4 py-2 bg-brand-red text-white rounded-xl text-sm font-bold"
                    >
                      Add Menu →
                    </button>
                  </div>
                )}
              </div>
            )}
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
              {menuItems.length === 0 ? (
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
                          <div className="w-20 h-20 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden relative">
                            {item.photo
                              ? <Image src={item.photo} alt={item.name} fill className="object-cover"/>
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
                              <p className="text-brand-red font-black flex-shrink-0">${(Number(item.price) || 0).toFixed(2)}</p>
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
                              {deletingMenuId === item.id ? (
                                <>
                                  <button onClick={() => setDeletingMenuId(null)} className="text-xs text-neutral-400 font-semibold">Cancel</button>
                                  <button onClick={() => deleteMenuItem(item.id)} className="text-xs text-red-500 font-bold">Confirm</button>
                                </>
                              ) : (
                                <button onClick={() => deleteMenuItem(item.id)} className="text-xs text-red-300 hover:text-red-500 font-semibold">Delete</button>
                              )}
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
            {/* Header */}
            <div className="bg-white border-b border-neutral-100 px-4 py-4 flex items-center justify-between">
              <div>
                <p className="font-black text-neutral-900 text-base uppercase tracking-wide">Weekly Schedule</p>
                <p className="text-xs text-neutral-400 mt-0.5">Set your hours and location for each day</p>
              </div>
              <button onClick={() => openAddSched(schedDay)}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-full text-sm font-bold">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Schedule
              </button>
            </div>

            {/* Day pills */}
            <div className="bg-neutral-50 border-b border-neutral-100 px-4 py-3">
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((day, i) => {
                  const hasEntry = schedule.some(s => s.day_of_week === i);
                  const isToday  = i === new Date().getDay();
                  return (
                    <button key={day} onClick={() => setSchedDay(i)}
                      className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-2xl transition-all ${
                        schedDay === i
                          ? "bg-brand-red text-white shadow-sm"
                          : "bg-white border border-neutral-200 text-neutral-600 hover:border-brand-red"}`}>
                      <span className="text-xs font-black tracking-wide">{DAYS[i]}</span>
                      {isToday && <span className={`text-[9px] font-black ${schedDay === i ? "text-red-200" : "text-brand-red"}`}>TODAY</span>}
                      {hasEntry && !isToday && <span className={`w-1.5 h-1.5 rounded-full ${schedDay === i ? "bg-red-200" : "bg-brand-red"}`}/>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-3 max-w-2xl mx-auto">

              {/* Selected day header */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-neutral-700 uppercase tracking-widest">
                  {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][schedDay]}
                </p>
                {schedule.filter(s => s.day_of_week === schedDay).length > 0 && (
                  <button onClick={() => openAddSched(schedDay)}
                    className="text-xs text-brand-red font-bold hover:underline">
                    + Add Another Stop
                  </button>
                )}
              </div>

              {/* Entries for selected day */}
              {schedule.filter(s => s.day_of_week === schedDay).length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-neutral-200 py-12 text-center">
                  <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="4" width="18" height="18" rx="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <p className="text-neutral-500 font-semibold mb-1">No schedule for {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][schedDay]}</p>
                  <p className="text-neutral-400 text-sm mb-4">Add your location and hours for this day</p>
                  <button onClick={() => openAddSched(schedDay)}
                    className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold">
                    Add Schedule
                  </button>
                </div>
              ) : (
                schedule.filter(s => s.day_of_week === schedDay).map(entry => (
                  <div key={entry.id} className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-neutral-900 text-sm truncate">{entry.location}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                              <circle cx="12" cy="12" r="10"/>
                              <polyline points="12 6 12 12 16 14"/>
                            </svg>
                            <p className="text-sm font-semibold text-brand-red">{entry.open_time} – {entry.close_time}</p>
                          </div>
                          {entry.notes && <p className="text-xs text-neutral-400 mt-1">{entry.notes}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <button onClick={() => openEditSched(entry)} className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold">Edit</button>
                        {deletingSchedId === entry.id ? (
                          <>
                            <button onClick={() => setDeletingSchedId(null)} className="text-xs text-neutral-400 font-semibold">Cancel</button>
                            <button onClick={() => deleteSchedEntry(entry.id)} className="text-xs text-red-500 font-bold">Confirm</button>
                          </>
                        ) : (
                          <button onClick={() => deleteSchedEntry(entry.id)} className="text-xs text-red-300 hover:text-red-500 font-semibold">Remove</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Full week overview */}
              <div className="mt-4">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Full Week at a Glance</p>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-neutral-100">
                  {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((fullDay, i) => {
                    const entries = schedule.filter(s => s.day_of_week === i);
                    const isToday = i === new Date().getDay();
                    return (
                      <div key={fullDay} onClick={() => setSchedDay(i)}
                        className={`flex items-center gap-3 px-4 py-3.5 border-b border-neutral-50 last:border-0 cursor-pointer hover:bg-neutral-50 transition-colors ${isToday ? "bg-red-50/50" : ""}`}>
                        <div className="w-20 flex-shrink-0">
                          <span className={`text-sm font-bold ${isToday ? "text-brand-red" : "text-neutral-400"}`}>{DAYS[i]}</span>
                          {isToday && <span className="block text-[9px] font-black text-brand-red uppercase tracking-wide">Today</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          {entries.length === 0 ? (
                            <span className="text-sm text-neutral-300">— Closed</span>
                          ) : (
                            entries.map(e => (
                              <p key={e.id} className="text-sm text-neutral-700 truncate">
                                <span className="font-medium">{e.open_time} – {e.close_time}</span>
                                <span className="text-neutral-400 ml-2">· {e.location}</span>
                              </p>
                            ))
                          )}
                        </div>
                        {entries.length > 0 && (
                          <div className="w-2 h-2 rounded-full bg-brand-red flex-shrink-0"/>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════ ANALYTICS ════ */}
        {activeTab === "analytics" && (
          <div className="flex flex-col gap-4 max-w-2xl mx-auto pb-10">

            {analyticsLoading ? (
              <div className="p-8 flex flex-col items-center gap-3 py-20">
                <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin"/>
                <p className="text-neutral-400 text-sm">Loading your stats...</p>
              </div>
            ) : (
              <>
                {/* ── ALL-TIME HERO STATS ── */}
                <div className="bg-neutral-900 px-5 pt-6 pb-5 flex flex-col gap-4">
                  <p className="text-xs font-black text-neutral-500 uppercase tracking-widest">All Time</p>
                  <div className="grid grid-cols-2 gap-3">

                    {/* Followers */}
                    <div className="bg-neutral-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-brand-red/20 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                            <circle cx="9" cy="7" r="4"/>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-neutral-400">Followers</p>
                      </div>
                      <p className="text-4xl font-black text-white leading-none">{totalFollowers.toLocaleString()}</p>
                      <p className="text-xs text-neutral-500 mt-1.5">customers following your truck</p>
                    </div>

                    {/* Orders */}
                    <div className="bg-neutral-800 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-xl bg-orange-500/20 flex items-center justify-center">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FB923C" strokeWidth="2" strokeLinecap="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                            <line x1="3" y1="6" x2="21" y2="6"/>
                            <path d="M16 10a4 4 0 0 1-8 0"/>
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-neutral-400">Orders</p>
                      </div>
                      <p className="text-4xl font-black text-white leading-none">{allTimeOrders.toLocaleString()}</p>
                      <p className="text-xs text-neutral-500 mt-1.5">total orders placed</p>
                    </div>
                  </div>

                  {/* Revenue banner */}
                  <div className="bg-green-900/40 border border-green-700/30 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
                        <line x1="12" y1="1" x2="12" y2="23"/>
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                      </svg>
                      <p className="text-sm font-bold text-green-400">Total Revenue</p>
                    </div>
                    <p className="text-xl font-black text-green-400">${allTimeRevenue.toFixed(2)}</p>
                  </div>
                </div>

                {/* ── PERIOD BREAKDOWN ── */}
                <div className="px-4 flex flex-col gap-4">

                  {/* Range selector */}
                  <div className="bg-neutral-100 rounded-2xl p-1 flex gap-1">
                    {(["weekly","monthly","yearly"] as AnalyticsRange[]).map(r => (
                      <button key={r} onClick={() => switchAnalyticsRange(r)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                          analyticsRange === r ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-400 hover:text-neutral-700"}`}>
                        {r === "weekly" ? "This Week" : r === "monthly" ? "This Month" : "This Year"}
                      </button>
                    ))}
                  </div>

                  {/* Period stat cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-brand-red">
                      <p className="text-xs text-neutral-400 font-semibold mb-1">New Followers</p>
                      <p className="text-3xl font-black text-neutral-900">{periodStats.followers.toLocaleString()}</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {analyticsRange === "weekly" ? "past 7 days" : analyticsRange === "monthly" ? "past 30 days" : "past 12 months"}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-orange-400">
                      <p className="text-xs text-neutral-400 font-semibold mb-1">Orders</p>
                      <p className="text-3xl font-black text-neutral-900">{periodStats.orders.toLocaleString()}</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {analyticsRange === "weekly" ? "past 7 days" : analyticsRange === "monthly" ? "past 30 days" : "past 12 months"}
                      </p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-green-500">
                      <p className="text-xs text-neutral-400 font-semibold mb-1">Revenue</p>
                      <p className="text-3xl font-black text-neutral-900">${periodStats.revenue.toFixed(2)}</p>
                      <p className="text-xs text-neutral-400 mt-1">from orders this period</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-blue-400">
                      <p className="text-xs text-neutral-400 font-semibold mb-1">Profile Views</p>
                      <p className="text-3xl font-black text-neutral-900">{periodStats.views.toLocaleString()}</p>
                      <p className="text-xs text-neutral-400 mt-1">customers viewed your page</p>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <p className="text-sm font-black text-neutral-800 mb-1">Followers &amp; Orders Trend</p>
                    <p className="text-xs text-neutral-400 mb-4">
                      {analyticsRange === "weekly" ? "Day by day this week" : analyticsRange === "monthly" ? "Week by week this month" : "Month by month this year"}
                    </p>
                    {chartData.length === 0 || chartData.every(d => d.followers === 0 && d.orders === 0) ? (
                      <div className="py-10 text-center">
                        <p className="text-neutral-300 text-sm">No data for this period yet</p>
                        <p className="text-neutral-300 text-xs mt-1">Go live and start getting customers!</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false}/>
                          <XAxis dataKey="label" tick={{ fontSize:11, fill:"#aaa" }} axisLine={false} tickLine={false}/>
                          <YAxis tick={{ fontSize:11, fill:"#aaa" }} axisLine={false} tickLine={false} allowDecimals={false} width={24}/>
                          <Tooltip
                            contentStyle={{ borderRadius:"12px", border:"none", boxShadow:"0 4px 20px rgba(0,0,0,0.12)", fontSize:"12px" }}
                            cursor={{ fill:"rgba(0,0,0,0.03)" }}
                          />
                          <Legend wrapperStyle={{ fontSize:"11px", paddingTop:"12px" }} iconType="circle" iconSize={8}/>
                          <Bar dataKey="followers" name="New Followers" fill="#E8481C" radius={[4,4,0,0]} maxBarSize={36}/>
                          <Bar dataKey="orders"    name="Orders"        fill="#FB923C" radius={[4,4,0,0]} maxBarSize={36}/>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>

                </div>
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
                <p className="font-bold text-neutral-700 mb-1">No orders yet</p>
                <p className="text-sm text-neutral-400">Orders from customers will appear here in real time.</p>
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
                  ? <Image src={itemForm.photo} alt="preview" fill className="object-cover"/>
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
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red"/>
              </Field>

              <Field label="Description">
                <textarea value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Marinated pork, pineapple, cilantro..." rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red resize-none"/>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price *">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">$</span>
                    <input type="number" value={itemForm.price} onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.00" step="0.01" min="0"
                      className="w-full pl-7 pr-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red"/>
                  </div>
                </Field>
                <Field label="Category">
                  <input value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Tacos, Sides"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red"/>
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
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center md:justify-center">
          <div className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl p-5 pb-8 max-h-[92vh] overflow-y-auto">

            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-black text-neutral-900">
                  {editingSched ? "Edit Hours" : "Add Schedule"}
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][schedForm.day_of_week]}
                </p>
              </div>
              <button onClick={() => setSchedModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Hours row */}
            <div className="mb-4">
              <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Hours</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Opening Time</label>
                  <select value={schedForm.open_time} onChange={e => setSchedForm(f => ({ ...f, open_time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Closing Time</label>
                  <select value={schedForm.close_time} onChange={e => setSchedForm(f => ({ ...f, close_time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white">
                    {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="mb-4">
              <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Location</p>
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">Address or Intersection <span className="text-brand-red">*</span></label>
              <input value={schedForm.location} onChange={e => setSchedForm(f => ({ ...f, location: e.target.value }))}
                placeholder="e.g. Main St & 5th Ave, Newark NJ"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Notes <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input value={schedForm.notes} onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Near the farmers market entrance"
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
            </div>

            <button onClick={saveSchedEntry} disabled={schedSaving || !schedForm.location.trim()}
              className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base disabled:opacity-40 transition-opacity"
              style={{ boxShadow: "0 4px 16px rgba(232,72,28,0.3)" }}>
              {schedSaving ? "Saving..." : editingSched ? "Save Changes" : "Add to Schedule"}
            </button>
          </div>
        </div>
      )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white max-w-xs text-center pointer-events-none ${toast.isError ? "bg-neutral-900" : "bg-green-600"}`}>
          {toast.isError ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          )}
          {toast.msg}
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
