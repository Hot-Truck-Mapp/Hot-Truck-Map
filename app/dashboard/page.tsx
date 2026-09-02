"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CUISINE_TYPES } from "@/lib/cuisines";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ─── Constants ────────────────────────────────────────────────────────────────
const ALLERGENS = ["Gluten","Dairy","Nuts","Eggs","Soy","Shellfish","Fish"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = [
  "6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM",
  "12:00 PM","1:00 PM","2:00 PM","3:00 PM","4:00 PM","5:00 PM",
  "6:00 PM","7:00 PM","8:00 PM","9:00 PM","10:00 PM","11:00 PM",
  "12:00 AM","1:00 AM","2:00 AM",
];
type Tab = "live" | "profile" | "menu" | "schedule" | "analytics" | "orders";
type AnalyticsRange = "weekly" | "monthly" | "yearly";

const MENU_COLS =
  "id, truck_id, name, description, price, category, allergens, is_popular, is_sold_out, photo, sort_order, created_at";

/**
 * Menu items in the operator's chosen order.
 *
 * sort_order was added in patch 006 but nothing ever read it, so every menu
 * was stuck in the order it happened to be typed. Items created before the
 * reorder controls existed have a null sort_order — those sort last by
 * creation date, so an existing menu keeps its current order until the
 * operator moves something.
 */
async function fetchMenuItems(
  supabase: ReturnType<typeof createClient>,
  truckId: string
) {
  return supabase
    .from("menu_items")
    .select(MENU_COLS)
    .eq("truck_id", truckId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(200);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const router = useRouter();
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
  const [reorderingId, setReorderingId] = useState<string | null>(null);
  const menuPhotoRef = useRef<HTMLInputElement>(null);
  // Photo uploaded for an item that hasn't been saved yet. Storage writes
  // happen immediately but the row is only written on save, so abandoning
  // the modal would otherwise leave the file behind forever.
  const pendingMenuPhotoRef = useRef<string | null>(null);
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
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string, isError = false) {
    if (!mountedRef.current) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ msg, isError });
    toastTimerRef.current = setTimeout(() => { if (mountedRef.current) setToast(null); }, 4000);
  }

  // Inline delete confirms
  const [deletingMenuId, setDeletingMenuId]   = useState<string | null>(null);
  const [deletingSchedId, setDeletingSchedId] = useState<string | null>(null);

  // Go Live
  const [liveStatus, setLiveStatus]     = useState<"idle"|"locating"|"live"|"error">("idle");
  const [liveAddress, setLiveAddress]   = useState<string | null>(null);
  const [liveError, setLiveError]       = useState<string | null>(null);
  const [manualAddr, setManualAddr]     = useState("");
  const [showManual, setShowManual]     = useState(false);
  const watchIdRef                      = useRef<number | null>(null);
  const locationIntervalRef             = useRef<ReturnType<typeof setInterval> | null>(null);
  const isBroadcastingRef               = useRef(false);
  const lastBroadcastPosRef             = useRef<{ lat: number; lng: number } | null>(null);
  // One follower notification per live session, not one per GPS refresh.
  const hasNotifiedFollowersRef         = useRef(false);

  // Analytics
  const [analyticsLoaded, setAnalyticsLoaded]   = useState(false);
  const [analyticsRange, setAnalyticsRange]     = useState<AnalyticsRange>("weekly");
  const [totalFollowers, setTotalFollowers]     = useState(0);
  const [chartData, setChartData]               = useState<any[]>([]);
  const [periodStats, setPeriodStats]           = useState({ followers:0, orders:0, views:0, revenue:0 });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError]     = useState(false);
  const [allTimeOrders, setAllTimeOrders]       = useState(0);
  const [allTimeRevenue, setAllTimeRevenue]     = useState(0);

  // Orders
  const [orders, setOrders]           = useState<any[]>([]);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [exportCsvLoading, setExportCsvLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Email confirmation
  const [emailConfirmed, setEmailConfirmed] = useState(true);
  const [userEmail, setUserEmail]           = useState<string>("");
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendEmailMsg, setResendEmailMsg] = useState<string | null>(null);

  // Profile completeness nudge
  const [completenessNudgeDismissed, setCompletenessNudgeDismissed] = useState(false);

  const mountedRef = useRef(true);

  // ── Cleanup timers, geolocation, and intervals on unmount ──────────────────
  useEffect(() => () => {
    mountedRef.current = false;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationIntervalRef.current) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }, []);

  // ── Initial load ────────────────────────────────────────────────────────────
  // ?tab=menu etc. lets the /dashboard/* stub routes land on the right tab.
  // Read from window.location rather than useSearchParams so this component
  // doesn't need its own Suspense boundary.
  const requestedTabRef = useRef<Tab | null>(null);
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("tab");
    const valid: Tab[] = ["live", "profile", "menu", "schedule", "analytics", "orders"];
    if (raw && (valid as string[]).includes(raw)) {
      requestedTabRef.current = raw as Tab;
      setActiveTab(raw as Tab);
    }
    loadAll();
  }, []);

  async function loadAll() {
    try {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();

      if (authErr || !user) {
        router.replace("/login?redirect=%2Fdashboard");
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? "");
      // Block dashboard if email is not confirmed
      if (!user.email_confirmed_at) {
        setEmailConfirmed(false);
        setLoading(false);
        return;
      }

      const truckCols =
        "id, name, description, cuisine, phone, instagram, profile_photo, is_live, dietary_tags";
      let { data: truck } = await supabase
        .from("trucks").select(truckCols).eq("owner_id", user.id).maybeSingle();

      // Self-heal: if the server-side signup truck insert ever fails (or this
      // is a returning user from before that fix), recreate the row using the
      // truck name we stashed in user_metadata at signup. With a confirmed
      // session, auth.uid() now matches owner_id, so the trucks_owner_insert
      // RLS policy lets the operator create their own row here.
      if (!truck) {
        const meta = user.user_metadata ?? {};
        const fallbackName =
          typeof meta.truck_name === "string" ? meta.truck_name.trim() : "";
        const fallbackCuisine =
          typeof meta.cuisine === "string" && meta.cuisine.trim().length > 0
            ? meta.cuisine.trim()
            : null;
        if (meta.role === "operator" && fallbackName.length > 0) {
          const { data: created } = await supabase
            .from("trucks")
            .insert({
              owner_id: user.id,
              name: fallbackName,
              cuisine: fallbackCuisine,
              is_live: false,
            })
            .select(truckCols)
            .maybeSingle();
          if (created) truck = created;
        }
      }

      // Redirect users who are not operators — DB truck ownership is the only authority.
      // Never trust user-editable user_metadata.role for access control.
      if (!truck) {
        router.replace("/");
        return;
      }

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
            .from("locations").select("address").eq("truck_id", truck.id).order("broadcasted_at", { ascending: false }).limit(1).maybeSingle();
          if (loc?.address) setLiveAddress(loc.address);
        }

        const [menuRes, schedRes, ordersRes, followsRes] = await Promise.all([
          fetchMenuItems(supabase, truck.id),
          supabase.from("schedules").select("id, truck_id, day_of_week, open_time, close_time, location, notes").eq("truck_id", truck.id).order("day_of_week").limit(7),
          supabase.from("orders").select("id, truck_id, pickup_name, notes, items, total, status, created_at, customer_id").eq("truck_id", truck.id).order("created_at", { ascending: false }).limit(100),
          supabase.from("follows").select("*", { count: "exact", head: true }).eq("truck_id", truck.id),
        ]);
        setMenuItems(menuRes.data ?? []);
        setSchedule(schedRes.data ?? []);
        setOrders(ordersRes.data ?? []);
        setTotalFollowers(followsRes.count ?? 0);

        // Route new (incomplete) operators to Profile tab so they fill it in
        // first — unless they asked for a specific tab, in which case honour it.
        if (!requestedTabRef.current && (!truck.description || !truck.phone)) {
          setActiveTab("profile");
        }
      } else {
        // No truck at all — operator just signed up, go straight to profile setup
        setActiveTab("profile");
      }
    } catch (err: any) {
      if (mountedRef.current) setError("Could not connect to the server. Check your internet and try again.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // ── Tab switch — always reload analytics to keep data fresh ────────────────
  useEffect(() => {
    if (activeTab === "analytics" && truckId) {
      loadAnalytics(truckId, analyticsRange);
    }
  }, [activeTab, truckId, analyticsRange]);

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
          // Verify the order belongs to this truck before adding it — guards against
          // Realtime channel filter bypass (library bug or network issue)
          if (order?.truck_id !== truckId) return;
          setOrders((prev) => [order, ...prev].slice(0, 100));
          setNewOrderCount((n) => n + 1);
          playNotificationSound();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [truckId]);

  // ── Profile ─────────────────────────────────────────────────────────────────
  async function uploadProfilePhoto(file: File) {
    if (!file.type.startsWith("image/")) { showToast("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Photo must be under 5 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Only JPG, PNG, or WebP images are allowed.");
      return;
    }
    // The storage policy scopes writes to trucks/<truck-id>/… and checks
    // that the caller owns that truck, so there is no path to upload to
    // before the truck row exists. Say so rather than writing to a folder
    // the policy will reject.
    if (!truckId) {
      showToast("Save your truck profile first, then add a photo.", true);
      return;
    }
    setPhotoUploading(true);
    try {
      const supabase = createClient();
      const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt || "jpg";
      const safeName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 64);
      const path = `trucks/${truckId}/${safeName}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not get photo URL — try again.");
      setProfile(p => ({ ...p, profile_photo: data.publicUrl }));
      if (truckId) {
        const { error: saveErr } = await supabase.from("trucks").update({ profile_photo: data.publicUrl }).eq("id", truckId);
        if (saveErr) {
          // Clean up orphaned storage file before surfacing the error
          void supabase.storage.from("avatars").remove([path]).catch(() => {});
          throw new Error("Photo uploaded but failed to save: " + saveErr.message);
        }
      }
    } catch (err: any) { showToast(err?.message ?? "Photo upload failed"); }
    setPhotoUploading(false);
  }

  async function saveProfile() {
    if (profileSaving) return; // in-flight guard
    if (!profile.name.trim() || !userId) return;
    if (profile.name.trim().length > 100) {
      showToast("Truck name must be 100 characters or fewer.", true);
      return;
    }
    setProfileSaving(true);
    try {
      const supabase = createClient();
      // The textarea caps typing at 200 and shows a /200 counter; the 1000
      // below is a defensive bound, not a second limit. Deliberately NOT
      // lowered to 200: a truck whose description predates the 200-char cap
      // would be silently truncated the next time its owner saved anything
      // else on this form.
      if (truckId) {
        const { error } = await supabase.from("trucks").update({
          name: profile.name.trim(), description: profile.description.slice(0, 1000),
          cuisine: profile.cuisine,
          phone: profile.phone.replace(/[^\d\s().+\-x]/g, "").slice(0, 20),
          instagram: profile.instagram.replace(/[^\w.]/g, "").slice(0, 30),
          profile_photo: profile.profile_photo,
          dietary_tags: profile.dietary_tags,
        }).eq("id", truckId).eq("owner_id", userId ?? "");
        if (error) throw new Error(error.message);
      } else {
        const { data: newTruck, error } = await supabase.from("trucks").insert({
          owner_id: userId, name: profile.name.trim(),
          description: profile.description.slice(0, 1000), cuisine: profile.cuisine,
          phone: profile.phone, instagram: profile.instagram,
          profile_photo: profile.profile_photo, is_live: false,
          dietary_tags: profile.dietary_tags,
        }).select("id").maybeSingle();
        if (error) throw new Error(error.message);
        if (newTruck) setTruckId(newTruck.id);
      }
      setProfileSaved(true);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = setTimeout(() => { if (mountedRef.current) setProfileSaved(false); }, 3000);
    } catch (err: any) { showToast("Save failed: " + (err?.message ?? "Please try again.")); }
    setProfileSaving(false);
  }

  // ── Menu ────────────────────────────────────────────────────────────────────
  async function uploadMenuPhoto(file: File) {
    if (!file.type.startsWith("image/")) { showToast("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Photo must be under 5 MB"); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Only JPG, PNG, or WebP images are allowed.");
      return;
    }
    // Same as the profile photo: menu/<truck-id>/… is the only shape the
    // storage policy accepts, so a missing truckId is a dead end, not a
    // reason to fall back to an "unknown" folder.
    if (!truckId) {
      showToast("Save your truck profile first, then add menu photos.", true);
      return;
    }
    setMenuUploading(true);
    try {
      const supabase = createClient();
      const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt || "jpg";
      const safeName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 64);
      const path = `menu/${truckId}/${safeName}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("menu-photos").upload(path, file, { upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data } = supabase.storage.from("menu-photos").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not get photo URL — try again.");
      setItemForm(f => ({ ...f, photo: data.publicUrl }));
      if (editingItem) {
        const { error: saveErr } = await supabase.from("menu_items").update({ photo: data.publicUrl }).eq("id", editingItem.id).eq("truck_id", truckId);
        if (saveErr) {
          // Clean up orphaned storage file before surfacing the error
          void supabase.storage.from("menu-photos").remove([path]).catch(() => {});
          throw new Error("Photo uploaded but failed to save: " + saveErr.message);
        }
        setMenuItems(items => items.map(i => i.id === editingItem.id ? { ...i, photo: data.publicUrl } : i));
      } else {
        // New item: no row to attach to yet. Track the file so closing the
        // modal without saving cleans it up, and drop any earlier pick from
        // this same modal session.
        const previous = pendingMenuPhotoRef.current;
        if (previous && previous !== path) {
          void supabase.storage.from("menu-photos").remove([previous]).catch(() => {});
        }
        pendingMenuPhotoRef.current = path;
      }
    } catch (err: any) { showToast(err?.message ?? "Photo upload failed"); }
    setMenuUploading(false);
  }

  function openAddItem() {
    setItemForm(emptyItem);
    setEditingItem(null);
    pendingMenuPhotoRef.current = null;
    setMenuModal(true);
  }

  // Dismissing the modal discards the draft, so a photo uploaded for an item
  // that was never saved has to go with it.
  function closeMenuModal() {
    const orphan = pendingMenuPhotoRef.current;
    pendingMenuPhotoRef.current = null;
    if (orphan) {
      const supabase = createClient();
      void supabase.storage.from("menu-photos").remove([orphan]).catch(() => {});
    }
    setMenuModal(false);
  }
  function openEditItem(item: any) {
    pendingMenuPhotoRef.current = null;
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
    if (menuSaving) return; // in-flight guard
    if (!truckId || !itemForm.name || !itemForm.price) return;
    const parsedPrice = parseFloat(itemForm.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0 || parsedPrice > 10_000) {
      showToast("Please enter a valid price between $0.01 and $10,000.00");
      return;
    }
    setMenuSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        truck_id: truckId, name: itemForm.name,
        description: itemForm.description, price: parsedPrice,
        category: itemForm.category || "Other", allergens: itemForm.allergens,
        is_popular: itemForm.is_popular, is_sold_out: itemForm.is_sold_out,
        photo: itemForm.photo,
      };
      if (editingItem) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", editingItem.id).eq("truck_id", truckId);
        if (error) throw new Error(error.message);
      } else {
        // New items go to the end of the list rather than wherever their
        // creation timestamp happens to land them.
        const highest = menuItems.reduce(
          (max, i) => (typeof i.sort_order === "number" && i.sort_order > max ? i.sort_order : max),
          -1
        );
        const { error } = await supabase
          .from("menu_items")
          .insert({ ...payload, sort_order: highest + 1 });
        if (error) throw new Error(error.message);
      }
      const { data } = await fetchMenuItems(supabase, truckId);
      setMenuItems(data ?? []);
      // Saved successfully — the photo now belongs to a row, so it is no
      // longer an orphan to clean up.
      pendingMenuPhotoRef.current = null;
      showToast(editingItem ? "Item updated!" : "Item added!", false);
      setMenuModal(false);
    } catch (err: any) {
      showToast("Save failed: " + (err?.message ?? "Please try again."));
    }
    setMenuSaving(false);
  }

  async function deleteMenuItem(id: string) {
    if (deletingMenuId !== id) { setDeletingMenuId(id); return; }
    setDeletingMenuId(null);
    if (!truckId || !userId) return;
    try {
      const supabase = createClient();
      // Verify ownership via truck before delete (defense-in-depth on top of RLS)
      const { data: ownerCheck } = await supabase.from("trucks").select("id").eq("id", truckId).eq("owner_id", userId).maybeSingle();
      if (!ownerCheck) { showToast("Permission denied"); return; }
      const { error } = await supabase.from("menu_items").delete().eq("id", id).eq("truck_id", truckId);
      if (!error) setMenuItems(items => items.filter(i => i.id !== id));
      else showToast("Delete failed: " + error.message);
    } catch {
      showToast("Delete failed — check your connection and try again");
    }
  }

  async function toggleSoldOut(item: any) {
    // Optimistic update
    setMenuItems(items => items.map(i => i.id === item.id ? { ...i, is_sold_out: !i.is_sold_out } : i));
    try {
      const supabase = createClient();
      const { error } = await supabase.from("menu_items").update({ is_sold_out: !item.is_sold_out }).eq("id", item.id).eq("truck_id", truckId!);
      if (error) {
        // Roll back on failure
        setMenuItems(items => items.map(i => i.id === item.id ? { ...i, is_sold_out: item.is_sold_out } : i));
        showToast("Could not update item: " + error.message);
      }
    } catch {
      setMenuItems(items => items.map(i => i.id === item.id ? { ...i, is_sold_out: item.is_sold_out } : i));
      showToast("Could not update item — check your connection");
    }
  }

  /**
   * Move an item up or down within its category.
   *
   * menuItems is already in display order, so the move is a swap with the
   * nearest neighbour that shares a category — which is what the operator
   * sees, since the list is grouped by category.
   *
   * sort_order is null for every item created before this existed, so the
   * first move rewrites the whole list to sequential values. After that only
   * the two swapped rows differ and only those two are written.
   */
  async function moveMenuItem(item: any, direction: -1 | 1) {
    if (!truckId || reorderingId) return;
    const ordered = [...menuItems];
    const from = ordered.findIndex(i => i.id === item.id);
    if (from === -1) return;

    const category = item.category || "Other";
    let to = -1;
    for (let i = from + direction; i >= 0 && i < ordered.length; i += direction) {
      if ((ordered[i].category || "Other") === category) { to = i; break; }
    }
    if (to === -1) return; // already first or last in its category

    [ordered[from], ordered[to]] = [ordered[to], ordered[from]];

    const changed = ordered
      .map((it, index) => ({ it, index }))
      .filter(({ it, index }) => it.sort_order !== index);
    if (changed.length === 0) return;

    const previous = menuItems;
    setReorderingId(item.id);
    setMenuItems(ordered.map((it, index) => ({ ...it, sort_order: index })));
    try {
      const supabase = createClient();
      const results = await Promise.all(
        changed.map(({ it, index }) =>
          supabase.from("menu_items").update({ sort_order: index }).eq("id", it.id).eq("truck_id", truckId)
        )
      );
      const failed = results.find(r => r.error);
      if (failed?.error) throw new Error(failed.error.message);
    } catch (err: any) {
      setMenuItems(previous); // roll back to what the server still has
      showToast("Could not reorder: " + (err?.message ?? "please try again."));
    } finally {
      setReorderingId(null);
    }
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
    if (!truckId || !schedForm.location.trim()) return;
    const openIdx  = HOURS.indexOf(schedForm.open_time);
    const closeIdx = HOURS.indexOf(schedForm.close_time);
    if (closeIdx <= openIdx) { showToast("Closing time must be after opening time"); return; }
    setSchedSaving(true);
    try {
      const supabase = createClient();
      const payload = {
        truck_id: truckId,
        ...schedForm,
        location: schedForm.location.trim().slice(0, 200),
        notes: (schedForm.notes ?? "").trim().slice(0, 500),
      };
      if (editingSched?.id) {
        const { error } = await supabase.from("schedules").update(payload).eq("id", editingSched.id).eq("truck_id", truckId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from("schedules").insert(payload);
        if (error) throw new Error(error.message);
      }
      const { data } = await supabase.from("schedules").select("id, truck_id, day_of_week, open_time, close_time, location, notes").eq("truck_id", truckId).order("day_of_week").limit(7);
      setSchedule(data ?? []);
      showToast("Schedule saved!", false);
      setSchedModal(false);
    } catch (err: any) { showToast("Save failed: " + (err?.message ?? "Please try again.")); }
    setSchedSaving(false);
  }

  async function deleteSchedEntry(id: string) {
    if (deletingSchedId !== id) { setDeletingSchedId(id); return; }
    setDeletingSchedId(null);
    if (!truckId || !userId) return;
    try {
      const supabase = createClient();
      const { data: ownerCheck } = await supabase.from("trucks").select("id").eq("id", truckId).eq("owner_id", userId).maybeSingle();
      if (!ownerCheck) { showToast("Permission denied"); return; }
      const { error } = await supabase.from("schedules").delete().eq("id", id).eq("truck_id", truckId);
      if (!error) setSchedule(s => s.filter(e => e.id !== id));
      else showToast("Delete failed: " + error.message);
    } catch {
      showToast("Delete failed — check your connection and try again");
    }
  }

  // ── Go Live ─────────────────────────────────────────────────────────────────
  async function broadcastLocation(lat: number, lng: number, address: string) {
    const supabase = createClient();
    if (!truckId) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("Couldn't get a valid GPS location — try again.");
    }
    const { error: upsertErr } = await supabase.from("locations").upsert(
      { truck_id: truckId, lat, lng, address: address.slice(0, 300), broadcasted_at: new Date().toISOString() },
      { onConflict: "truck_id" }
    );
    if (upsertErr) throw new Error(upsertErr.message);
    const { error: updateErr } = await supabase.from("trucks").update({ is_live: true }).eq("id", truckId).eq("owner_id", userId ?? "");
    if (updateErr) throw new Error(updateErr.message);
    setLiveAddress(address);
    setLiveStatus("live");
    setIsLive(true);

    // Tell followers, once per live session.
    //
    // The mobile app has always done this; the web dashboard never did, so a
    // web-only operator's followers were never told they'd gone live. It has
    // to be guarded: the GPS watcher re-broadcasts every time the truck moves
    // 50m, and a push on every move is how you get people to turn them off.
    if (!hasNotifiedFollowersRef.current) {
      hasNotifiedFollowersRef.current = true;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          // Fire-and-forget: a failed notification must never make the
          // operator think they aren't live, because they are.
          void fetch("/api/notify-followers", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ truck_id: truckId, truck_name: profile.name }),
          }).catch(() => {});
        }
      } catch { /* no session — the broadcast itself already succeeded */ }
    }
  }

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return "Location updated (address unavailable)";
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}`);
      if (!res.ok) return "Location updated (address unavailable)";
      const data = await res.json();
      return data.features?.[0]?.place_name ?? "Location updated (address unavailable)";
    } catch { return "Location updated (address unavailable)"; }
  }

  // Stop watching GPS and clear the auto-refresh interval
  function stopLocationTracking() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (locationIntervalRef.current !== null) {
      clearInterval(locationIntervalRef.current);
      locationIntervalRef.current = null;
    }
  }

  // Start watching GPS — broadcasts initial location then auto-refreshes every 5 min
  async function startLocationTracking() {
    if (!truckId) { showToast("Save your truck profile first."); setActiveTab("profile"); return; }
    if (!profile.description || !profile.phone) { showToast("Complete your profile (description + phone) before going live."); setActiveTab("profile"); return; }
    if (menuItems.length === 0) { showToast("Add at least one menu item before going live."); setActiveTab("menu"); return; }
    if (!navigator.geolocation) { setLiveError("Your browser doesn't support location. Use the address option below."); setShowManual(true); return; }

    setLiveStatus("locating");
    setLiveError(null);

    // Returns metres between two lat/lng points (Haversine approximation)
    function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number) {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // De-duplicated broadcast — skips if already in-flight or truck moved < 50 m
    const tryBroadcast = async (pos: GeolocationPosition) => {
      if (isBroadcastingRef.current) return;
      const { latitude: lat, longitude: lng } = pos.coords;
      const prev = lastBroadcastPosRef.current;
      if (prev && haversineMetres(prev.lat, prev.lng, lat, lng) < 50) return;
      isBroadcastingRef.current = true;
      try {
        const place = await reverseGeocode(lat, lng);
        await broadcastLocation(lat, lng, place);
        lastBroadcastPosRef.current = { lat, lng };
      } catch (e: any) {
        setLiveError(e.message);
        setLiveStatus("error");
        stopLocationTracking();
      } finally {
        isBroadcastingRef.current = false;
      }
    };

    // Use watchPosition so the pin auto-updates as the truck moves
    watchIdRef.current = navigator.geolocation.watchPosition(
      tryBroadcast,
      (err) => {
        stopLocationTracking();
        if (err.code === err.PERMISSION_DENIED) {
          setLiveError("Location access denied. Enable location in your browser settings, or enter your address below.");
        } else {
          setLiveError("Could not get your location. Enter your address below.");
        }
        setLiveStatus("idle");
        setShowManual(true);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
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
      if (!res.ok) throw new Error(`Location service error (${res.status}) — please try again.`);
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) throw new Error("Address not found. Try being more specific.");
      const [lng, lat] = feature.center;
      await broadcastLocation(lat, lng, feature.place_name);
    } catch (e: any) { setLiveError(e.message); setLiveStatus("error"); }
  }

  async function goOffline() {
    if (!truckId) return;
    stopLocationTracking();
    try {
      const supabase = createClient();
      const { error } = await supabase.from("trucks").update({ is_live: false }).eq("id", truckId).eq("owner_id", userId ?? "");
      if (error) { showToast("Could not go offline: " + error.message); return; }
      setLiveStatus("idle"); setIsLive(false); setLiveAddress(null);
      setManualAddr(""); setShowManual(false);
      // Next Go Live is a new session, so followers get told again.
      hasNotifiedFollowersRef.current = false;
      lastBroadcastPosRef.current = null;
    } catch {
      showToast("Could not go offline — check your connection and try again");
    }
  }

  // Clean up GPS watch when component unmounts
  useEffect(() => () => stopLocationTracking(), []);

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

      const [followsRes, ordersRes, viewsRes, totalFollowsRes, allOrdersRes, allRevenueRes] = await Promise.all([
        supabase.from("follows").select("created_at").eq("truck_id", id).gte("created_at", startDate.toISOString()).limit(2000),
        // All orders in period (for order count chart)
        supabase.from("orders").select("created_at,total,status").eq("truck_id", id).gte("created_at", startDate.toISOString()).limit(2000),
        supabase.from("truck_views").select("created_at").eq("truck_id", id).gte("created_at", startDate.toISOString()).limit(5000),
        supabase.from("follows").select("*",{count:"exact",head:true}).eq("truck_id", id),
        // All-time order count (any status) — use server-side count, not row scan
        supabase.from("orders").select("id",{count:"exact",head:true}).eq("truck_id", id),
        // All-time revenue = only picked_up (completed) orders
        // Limit is high to minimise silent truncation; true server-side SUM requires an RPC
        supabase.from("orders").select("total").eq("truck_id", id).eq("status", "picked_up").limit(10000),
      ]);

      const fw = followsRes.data ?? [], or = ordersRes.data ?? [], vw = viewsRes.data ?? [];
      const allRevenue = allRevenueRes.data ?? [];

      setTotalFollowers(totalFollowsRes.count ?? 0);
      setAllTimeOrders(allOrdersRes.count ?? 0);
      setAllTimeRevenue(allRevenue.reduce((s, o) => s + (o.total ?? 0), 0));
      setChartData(buckets.map(({ label, start, end }) => ({
        label,
        followers: fw.filter(f => { const d = new Date(f.created_at); return d >= start && d <= end; }).length,
        orders:    or.filter(o => { const d = new Date(o.created_at); return d >= start && d <= end; }).length,
        views:     vw.filter(v => { const d = new Date(v.created_at); return d >= start && d <= end; }).length,
      })));
      const completedOrders = or.filter(o => o.status === "picked_up");
      setPeriodStats({
        followers: fw.length,
        orders: or.length,
        views: vw.length,
        revenue: completedOrders.reduce((s, o) => s + (o.total ?? 0), 0),
      });
      setAnalyticsLoaded(true);
      setAnalyticsError(false);
    } catch { setAnalyticsError(true); }
    setAnalyticsLoading(false);
  }

  function switchAnalyticsRange(r: AnalyticsRange) {
    // Only update the state — the useEffect on [activeTab, truckId, analyticsRange]
    // will fire automatically and call loadAnalytics, avoiding a double-fire race.
    setAnalyticsRange(r);
  }

  // ── Order notifications ──────────────────────────────────────────────────────
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Close AudioContext on unmount to avoid resource leak
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  function playNotificationSound() {
    try {
      // Reuse a single AudioContext — browsers cap concurrent instances at ~6
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
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
    const VALID_STATUSES = ["preparing", "ready", "picked_up", "no_show"] as const;
    if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) return;
    if (updatingOrderId === orderId) return; // prevent double-tap on same order
    if (updatingOrderId) return; // prevent concurrent updates on different orders (optional safety)
    setUpdatingOrderId(orderId);
    try {
      const supabase = createClient();
      // Scope update to this operator's truck — prevents cross-operator order tampering
      // Capture before any state update so we don't read a stale closure later
      const order = orders.find((o) => o.id === orderId);
      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId).eq("truck_id", truckId!);
      if (!error) {
        setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status } : o));

        // Notify customer of status change (fire-and-forget)
        if (order?.customer_id) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token) {
            fetch("/api/notify-customer", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                customer_id: order.customer_id,
                order_id: orderId,
                status,
                truck_name: profile.name,
              }),
            }).catch(() => {});
          }
        }
      } else {
        showToast("Failed to update order status — please try again");
      }
    } catch {
      showToast("Failed to update order status — check your connection");
    } finally {
      setUpdatingOrderId(null);
    }
  }

  // ── Export CSV ──────────────────────────────────────────────────────────────
  async function exportOrdersCsv() {
    if (!truckId) return;
    setExportCsvLoading(true);
    try {
      const supabase = createClient();
      const { data: allOrders, error: fetchErr } = await supabase
        .from("orders")
        .select("id, pickup_name, items, total, status, created_at")
        .eq("truck_id", truckId)
        .order("created_at", { ascending: false })
        .limit(5000); // cap export at 5000 rows to prevent memory exhaustion
      if (fetchErr) throw new Error(fetchErr.message);

      const rows: string[] = [
        ["Order ID", "Customer Name", "Items", "Total", "Status", "Date"].join(","),
      ];
      for (const order of allOrders ?? []) {
        const items: any[] = Array.isArray(order.items) ? order.items : [];
        const itemsStr = items.map((i: any) => `${i.quantity}x ${i.name}`).join("; ");
        const csvRow = [
          order.id,
          JSON.stringify(order.pickup_name ?? ""),
          JSON.stringify(itemsStr),
          (order.total ?? 0).toFixed(2),
          order.status,
          new Date(order.created_at).toLocaleString(),
        ].join(",");
        rows.push(csvRow);
      }

      const csv = rows.join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showToast("Export failed: " + (err?.message ?? "Please try again."));
    } finally {
      setExportCsvLoading(false);
    }
  }

  // ── Email confirmation resend ────────────────────────────────────────────────
  async function resendConfirmationEmail() {
    if (resendingEmail || !userEmail) return;
    setResendingEmail(true);
    setResendEmailMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({ type: "signup", email: userEmail });
      if (error) throw new Error(error.message);
      setResendEmailMsg("Confirmation email sent! Check your inbox.");
    } catch (err: any) {
      setResendEmailMsg(err?.message ?? "Could not send email. Please try again.");
    } finally {
      setResendingEmail(false);
    }
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

  if (!emailConfirmed) return (
    <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
          <polyline points="22,6 12,13 2,6"/>
        </svg>
      </div>
      <div className="max-w-sm">
        <h1 className="text-xl font-black text-white mb-2">Confirm Your Email</h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          Please confirm your email before accessing your dashboard. Check your inbox for a confirmation link.
        </p>
        {userEmail && (
          <p className="text-neutral-500 text-xs mt-2">
            Sent to <span className="text-neutral-300 font-semibold">{userEmail}</span>
          </p>
        )}
      </div>
      {resendEmailMsg && (
        <p className={`text-sm font-semibold px-4 py-2 rounded-lg ${
          resendEmailMsg.startsWith("Confirmation") ? "bg-green-900/40 text-green-400" : "bg-red-900/40 text-red-400"
        }`}>
          {resendEmailMsg}
        </p>
      )}
      <button
        onClick={resendConfirmationEmail}
        disabled={resendingEmail}
        className="px-6 py-3 bg-brand-red text-white rounded-xl font-bold text-sm disabled:opacity-50 hover:bg-red-600 transition-colors"
      >
        {resendingEmail ? "Sending..." : "Resend Confirmation Email"}
      </button>
      <Link href="/" className="text-neutral-500 text-sm hover:text-neutral-300 transition-colors">
        ← Back to Hot Truck Map
      </Link>
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
        <Link href="/" className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/>
          </svg>
          View Map
        </Link>
      </div>

      {/* No VerificationBanner here: an unverified operator never reaches this
          render at all — the `!emailConfirmed` gate above returns a full-screen
          "Confirm Your Email" page with its own resend button. The banner was
          dead markup on the one page that mounted it. */}

      {/* Profile completeness nudge */}
      {(() => {
        if (completenessNudgeDismissed) return null;
        const score =
          (profile.profile_photo ? 25 : 0) +
          (profile.description ? 25 : 0) +
          (profile.cuisine ? 25 : 0) +
          (profile.phone ? 25 : 0);
        if (score >= 100) return null;
        return (
          <div className="bg-amber-50 border-b border-amber-100 px-4 py-3">
            <div className="max-w-3xl mx-auto flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-sm font-black text-amber-900">
                    Complete your profile — more customers find you
                  </p>
                  <button
                    onClick={() => setCompletenessNudgeDismissed(true)}
                    className="flex-shrink-0 text-amber-400 hover:text-amber-600 transition-colors"
                    aria-label="Dismiss"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-amber-200 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-amber-700">{score}% complete</p>
                  <button
                    onClick={() => setActiveTab("profile")}
                    className="text-xs font-bold text-amber-800 hover:underline"
                  >
                    Go to Profile →
                  </button>
                </div>
                {/* What's missing */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {!profile.profile_photo && (
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">+ Photo</span>
                  )}
                  {!profile.description && (
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">+ Description</span>
                  )}
                  {!profile.cuisine && (
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">+ Cuisine type</span>
                  )}
                  {!profile.phone && (
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">+ Phone number</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
          {/* Extra pages — not inline tabs, navigate to dedicated routes */}
          <Link href="/dashboard/catering"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100">
            Catering
          </Link>
          <Link href="/dashboard/social"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100">
            Social
          </Link>
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
          {/* More links — separate pages */}
          <div className="p-3 border-t border-neutral-100 flex flex-col gap-1">
            <p className="text-[10px] text-neutral-400 font-semibold px-4 mb-1 uppercase tracking-wider">More</p>
            <Link href="/dashboard/catering"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-neutral-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Catering Requests
            </Link>
            <Link href="/dashboard/social"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 text-neutral-400"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              Social
            </Link>
          </div>
          <div className="p-3 border-t border-neutral-100">
            <p className="text-[10px] text-neutral-300 font-medium px-4">HOT TRUCK MAP</p>
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

            {/* ── Get the App nudge ─────────────────────────────────────── */}
            <div className="w-full bg-neutral-900 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-10 h-10 bg-brand-red rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-white leading-tight">Go live faster with the app</p>
                <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">The HotTruckMap mobile app uses your phone&apos;s GPS to broadcast your exact location in one tap.</p>
                <a
                  href="https://expo.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2 text-xs font-bold text-brand-red hover:underline"
                >
                  Download the operator app →
                </a>
              </div>
            </div>

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
                        <button onClick={startLocationTracking}
                          className={`w-52 h-52 rounded-full text-white flex flex-col items-center justify-center gap-2 transition-all ${readyToLive ? "bg-brand-red active:scale-95" : "bg-neutral-300 cursor-not-allowed"}`}
                          style={readyToLive ? { boxShadow: "0 8px 40px rgba(217,79,61,0.35)" } : {}}>
                          <span className="text-2xl font-black">Go Live</span>
                          <span className="text-sm opacity-80">auto-detects location</span>
                        </button>
                        {!readyToLive && (
                          <p className="text-xs text-neutral-400 text-center -mt-1">Complete the checklist above to go live</p>
                        )}
                      </>
                    );
                  })()}
                  <button onClick={() => setShowManual(!showManual)} className="text-sm text-neutral-400 underline underline-offset-2">
                    {showManual ? "Hide address entry" : "Location not working? Enter address manually"}
                  </button>
                  {showManual && (
                    <div className="w-full flex flex-col gap-2">
                      <input value={manualAddr} onChange={e => setManualAddr(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && goLiveManual()}
                        placeholder="e.g. 123 Main St, Newark NJ" maxLength={200}
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
                    <span className="text-[10px] opacity-60 text-center px-6">📍 Location updates automatically</span>
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
                    <p className="text-white font-black text-base leading-tight">Welcome to Hot Truck Map!</p>
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
                  ? <Image src={profile.profile_photo} alt="Truck" fill sizes="80px" className="object-cover"/>
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
            <Field label="Truck Name *" id="truck-name">
              <input id="truck-name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
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

            <Field label="Description" id="truck-description">
              <textarea id="truck-description" value={profile.description}
                onChange={e => setProfile(p => ({ ...p, description: e.target.value.slice(0,200) }))}
                placeholder="Tell customers what makes your truck special..."
                rows={3} maxLength={200}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red resize-none bg-white"/>
              <p className={`text-xs mt-1 ${profile.description.length >= 190 ? "text-brand-red" : "text-neutral-400"}`}>
                {profile.description.length}/200
              </p>
            </Field>

            <div>
              {/* TWILIO_ACCOUNT_SID / AUTH_TOKEN / PHONE_NUMBER are set in
                  Vercel for Development, Preview and Production, so
                  notifyOperatorBySMS() in /api/orders really does send. They
                  are absent from .env.local, which means SMS is the one thing
                  here that won't fire against a local dev server. */}
              <p className="text-sm font-semibold text-neutral-700 mb-1.5">
                Phone Number
                <span className="ml-2 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                  SMS order alerts
                </span>
              </p>
              <input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                placeholder="(201) 555-0123" type="tel" maxLength={20}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
              <p className="text-xs text-neutral-400 mt-1.5 flex items-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                You&apos;ll get a text message every time a customer places an order
              </p>
            </div>

            <Field label="Instagram" id="truck-instagram">
              <div className="flex rounded-xl border border-neutral-200 overflow-hidden focus-within:border-brand-red transition-colors bg-white">
                {/* Instagram brand badge */}
                <div className="flex items-center gap-1.5 px-3 bg-neutral-50 border-r border-neutral-200 flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <defs>
                      <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f09433"/>
                        <stop offset="25%" stopColor="#e6683c"/>
                        <stop offset="50%" stopColor="#dc2743"/>
                        <stop offset="75%" stopColor="#cc2366"/>
                        <stop offset="100%" stopColor="#bc1888"/>
                      </linearGradient>
                    </defs>
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" fill="url(#ig-grad)"/>
                    <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
                  </svg>
                  <span className="text-neutral-500 text-sm font-bold select-none">@</span>
                </div>
                <input
                  id="truck-instagram"
                  value={profile.instagram}
                  onChange={e => setProfile(p => ({ ...p, instagram: e.target.value.replace("@","").slice(0, 30) }))}
                  placeholder="yourtruck"
                  maxLength={30}
                  className="flex-1 px-3 py-3 text-base focus:outline-none bg-white text-neutral-800 placeholder-neutral-300"
                />
              </div>
              {profile.instagram ? (
                <a
                  href={`https://instagram.com/${profile.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-red font-semibold mt-1.5 hover:underline"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  instagram.com/{profile.instagram}
                </a>
              ) : null}
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
                              ? <Image src={item.photo} alt={item.name} fill sizes="64px" className="object-cover"/>
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
                              {/* Reorder within this category — the order customers see */}
                              {items.length > 1 && (
                                <div className="flex items-center gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => moveMenuItem(item, -1)}
                                    disabled={idx === 0 || reorderingId !== null}
                                    aria-label={`Move ${item.name} up`}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="m18 15-6-6-6 6"/>
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => moveMenuItem(item, 1)}
                                    disabled={idx === items.length - 1 || reorderingId !== null}
                                    aria-label={`Move ${item.name} down`}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 disabled:opacity-25 disabled:hover:bg-transparent transition-colors">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="m6 9 6 6 6-6"/>
                                    </svg>
                                  </button>
                                </div>
                              )}
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
              /* ── Skeleton loader — mirrors the exact layout of the analytics tab ── */
              <div className="flex flex-col gap-4 animate-pulse">

                {/* All-time hero section */}
                <div className="bg-neutral-900 px-5 pt-6 pb-5 flex flex-col gap-4">
                  <div className="h-3 w-16 bg-neutral-700 rounded-full" />
                  <div className="grid grid-cols-2 gap-3">
                    {/* Followers card skeleton */}
                    <div className="bg-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-neutral-700" />
                        <div className="h-3 w-16 bg-neutral-700 rounded-full" />
                      </div>
                      <div className="h-9 w-16 bg-neutral-700 rounded-lg" />
                      <div className="h-2.5 w-28 bg-neutral-700 rounded-full" />
                    </div>
                    {/* Orders card skeleton */}
                    <div className="bg-neutral-800 rounded-2xl p-4 flex flex-col gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-neutral-700" />
                        <div className="h-3 w-14 bg-neutral-700 rounded-full" />
                      </div>
                      <div className="h-9 w-12 bg-neutral-700 rounded-lg" />
                      <div className="h-2.5 w-24 bg-neutral-700 rounded-full" />
                    </div>
                  </div>
                  {/* Revenue banner skeleton */}
                  <div className="bg-neutral-800 rounded-2xl px-4 py-3 flex items-center justify-between">
                    <div className="h-4 w-28 bg-neutral-700 rounded-full" />
                    <div className="h-6 w-20 bg-neutral-700 rounded-full" />
                  </div>
                </div>

                {/* Period breakdown */}
                <div className="px-4 flex flex-col gap-4">
                  {/* Range selector skeleton */}
                  <div className="bg-neutral-100 rounded-2xl p-1 flex gap-1">
                    {[1,2,3].map(i => (
                      <div key={i} className="flex-1 py-2.5 rounded-xl bg-neutral-200" />
                    ))}
                  </div>

                  {/* Period stat cards skeleton */}
                  <div className="grid grid-cols-2 gap-3">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-neutral-100 flex flex-col gap-2">
                        <div className="h-3 w-24 bg-neutral-100 rounded-full" />
                        <div className="h-8 w-14 bg-neutral-100 rounded-lg" />
                        <div className="h-2.5 w-20 bg-neutral-100 rounded-full" />
                      </div>
                    ))}
                  </div>

                  {/* Chart skeleton */}
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="h-3 w-32 bg-neutral-100 rounded-full mb-4" />
                    <div className="flex items-end justify-between gap-1 h-32">
                      {[40,65,30,80,50,70,45].map((h, i) => (
                        <div key={i} className="flex-1 bg-neutral-100 rounded-t-md" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <div className="flex justify-between mt-2">
                      {[1,2,3,4,5,6,7].map(i => (
                        <div key={i} className="h-2.5 w-6 bg-neutral-100 rounded-full" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : analyticsError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
                <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-neutral-800">Could not load analytics</p>
                  <p className="text-sm text-neutral-400 mt-1">Check your connection and try again.</p>
                </div>
                <button
                  onClick={() => truckId && loadAnalytics(truckId, analyticsRange)}
                  className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm"
                >
                  Retry
                </button>
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
              <div className="flex items-center gap-2">
                {orders.length > 0 && (
                  <span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-3 py-1.5 rounded-full">
                    {orders.length} total
                  </span>
                )}
                {truckId && (
                  <button
                    onClick={exportOrdersCsv}
                    disabled={exportCsvLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-800 text-white text-xs font-bold disabled:opacity-50 transition-opacity"
                  >
                    {exportCsvLoading ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin inline-block" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Export CSV
                      </>
                    )}
                  </button>
                )}
              </div>
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
                {["pending", "preparing", "ready", "picked_up", "no_show", "cancelled"].map((statusGroup) => {
                  const groupOrders = orders.filter((o) => o.status === statusGroup);
                  if (groupOrders.length === 0) return null;
                  const statusLabel: Record<string, string> = {
                    pending: "New Orders",
                    preparing: "Preparing",
                    ready: "Ready for Pickup",
                    picked_up: "Picked Up",
                    no_show: "No-Shows",
                    cancelled: "Cancelled",
                  };
                  const statusColor: Record<string, string> = {
                    pending: "text-amber-600 bg-amber-50 border-amber-200",
                    preparing: "text-blue-600 bg-blue-50 border-blue-200",
                    ready: "text-green-600 bg-green-50 border-green-200",
                    picked_up: "text-neutral-400 bg-neutral-50 border-neutral-200",
                    no_show: "text-red-600 bg-red-50 border-red-200",
                    cancelled: "text-neutral-400 bg-neutral-50 border-neutral-200",
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
                                order.status === "no_show"   ? "border-red-400"   :
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
                              {!["picked_up", "no_show", "cancelled"].includes(order.status) && (
                                <div className="px-4 pb-4 flex gap-2">
                                  {order.status === "pending" && (
                                    <button
                                      onClick={() => updateOrderStatus(order.id, "preparing")}
                                      disabled={updatingOrderId === order.id}
                                      className="flex-1 py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                                    >
                                      {updatingOrderId === order.id ? "Updating..." : "Start Preparing"}
                                    </button>
                                  )}
                                  {order.status === "preparing" && (
                                    <button
                                      onClick={() => updateOrderStatus(order.id, "ready")}
                                      disabled={updatingOrderId === order.id}
                                      className="flex-1 py-2.5 bg-green-500 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                                    >
                                      {updatingOrderId === order.id ? "Updating..." : "Mark Ready"}
                                    </button>
                                  )}
                                  {order.status === "ready" && (
                                    <>
                                      <button
                                        onClick={() => updateOrderStatus(order.id, "picked_up")}
                                        disabled={updatingOrderId === order.id}
                                        className="flex-1 py-2.5 bg-neutral-800 text-white rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                                      >
                                        {updatingOrderId === order.id ? "Updating..." : "Picked Up ✓"}
                                      </button>
                                      <button
                                        onClick={() => {
                                          if (confirm("Mark this order as a no-show? This counts as a strike against the customer.")) {
                                            updateOrderStatus(order.id, "no_show");
                                          }
                                        }}
                                        disabled={updatingOrderId === order.id}
                                        className="py-2.5 px-4 bg-red-100 text-red-600 rounded-xl font-bold text-sm active:scale-95 transition-all disabled:opacity-50"
                                      >
                                        No Show
                                      </button>
                                    </>
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
              <button onClick={closeMenuModal} aria-label="Close menu item editor"
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
            <div className="px-5 py-5 flex flex-col gap-5">
              {/* Photo */}
              <div onClick={() => menuPhotoRef.current?.click()}
                className="w-full h-36 rounded-2xl overflow-hidden cursor-pointer bg-neutral-100 border-2 border-dashed border-neutral-200 hover:border-brand-red transition-colors flex items-center justify-center relative">
                {itemForm.photo
                  ? <Image src={itemForm.photo} alt="preview" fill sizes="96px" className="object-cover"/>
                  : <p className="text-sm text-neutral-400">{menuUploading ? "Uploading..." : "Tap to add photo"}</p>}
                {itemForm.photo && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <p className="text-white text-sm font-bold">Change Photo</p>
                  </div>
                )}
              </div>
              <input ref={menuPhotoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadMenuPhoto(f); }}/>

              <Field label="Item Name *" id="item-name">
                <input id="item-name" value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Al Pastor Taco" maxLength={100}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red"/>
              </Field>

              <Field label="Description" id="item-description">
                <textarea id="item-description" value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Marinated pork, pineapple, cilantro..." rows={2} maxLength={500}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red resize-none"/>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Price *" id="item-price">
                  <div className="flex rounded-xl border border-neutral-200 overflow-hidden focus-within:border-brand-red transition-colors bg-white">
                    <div className="flex items-center px-3 bg-neutral-50 border-r border-neutral-200 flex-shrink-0">
                      <span className="text-neutral-600 font-black text-base select-none">$</span>
                    </div>
                    <input
                      id="item-price"
                      type="number"
                      value={itemForm.price}
                      onChange={e => setItemForm(f => ({ ...f, price: e.target.value }))}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      max="10000"
                      className="flex-1 px-3 py-3 text-base focus:outline-none bg-white text-neutral-800 placeholder-neutral-300"
                    />
                  </div>
                </Field>
                <Field label="Category" id="item-category">
                  <input id="item-category" value={itemForm.category} onChange={e => setItemForm(f => ({ ...f, category: e.target.value }))}
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
              <button onClick={() => setSchedModal(false)} aria-label="Close schedule editor"
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
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
                placeholder="e.g. Main St & 5th Ave, Newark NJ" maxLength={200}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-base focus:outline-none focus:border-brand-red bg-white"/>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                Notes <span className="text-neutral-400 font-normal">(optional)</span>
              </label>
              <input value={schedForm.notes} onChange={e => setSchedForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Near the farmers market entrance" maxLength={200}
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
function Field({ label, id, children }: { label: string; id?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-neutral-700 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
