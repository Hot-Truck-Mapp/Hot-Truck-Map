"use client";

import { useState, useEffect, useRef, use } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MenuItemSkeleton } from "@/components/ui/Skeleton";

// ── Types ─────────────────────────────────────────────────────────────────────
type TruckPhoto = {
  id: string;
  photo_url: string;
  created_at: string;
};

type SpottedPost = {
  id: string;
  location: string;
  note: string | null;
  created_at: string;
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export default function TruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [truck, setTruck] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"menu" | "reviews" | "photos" | "info">("menu");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Cart state: maps menu item id → quantity
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartConflict, setCartConflict] = useState<string | null>(null);
  const [cartClearConfirm, setCartClearConfirm] = useState(false);
  const [orderGateMsg, setOrderGateMsg] = useState<string | null>(null);
  const orderGateMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Photos state
  const [photos, setPhotos] = useState<TruckPhoto[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Spotted posts state
  const [spottedPosts, setSpottedPosts] = useState<SpottedPost[]>([]);
  const [spottedLocation, setSpottedLocation] = useState("");
  const [spottedNote, setSpottedNote] = useState("");
  const [spottedSubmitting, setSpottedSubmitting] = useState(false);
  const [spottedSuccess, setSpottedSuccess] = useState(false);
  const [spottedError, setSpottedError] = useState<string | null>(null);
  const spottedSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Review form
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const reviewSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followLoadingRef = useRef(false); // prevent concurrent follow/unfollow
  const photoUploadCountRef = useRef(0); // per-session upload rate limit (max 5)

  // Computed cart values
  const cartEntries = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartCount = cartEntries.reduce((sum, [, qty]) => sum + qty, 0);
  const cartTotal = cartEntries.reduce((sum, [itemId, qty]) => {
    const item = menuItems.find((m) => m.id === itemId);
    return sum + (item?.price ?? 0) * qty;
  }, 0);

  function addToCart(itemId: string) {
    setCart((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }));
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const next = { ...prev };
      if ((next[itemId] ?? 0) <= 1) delete next[itemId];
      else next[itemId]--;
      return next;
    });
  }

  function goToOrder() {
    if (!truck?.is_live) {
      if (orderGateMsgTimerRef.current) clearTimeout(orderGateMsgTimerRef.current);
      setOrderGateMsg("This truck is not currently accepting orders.");
      orderGateMsgTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setOrderGateMsg(null);
      }, 4000);
      return;
    }
    const items = cartEntries.map(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === itemId);
      return {
        id: itemId,
        name: item?.name ?? "",
        price: item?.price ?? 0,
        quantity: qty,
        photo: item?.photo ?? null,
      };
    });
    try {
      localStorage.setItem(
        "hot-truck-cart",
        JSON.stringify({ truckId: id, truckName: truck?.name ?? "", items })
      );
    } catch {
      // localStorage unavailable (e.g. Safari private browsing) — proceed anyway,
      // the order page will redirect back if it can't read the cart
    }
    router.push(`/truck/${id}/order`);
  }

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (reviewSuccessTimerRef.current) clearTimeout(reviewSuccessTimerRef.current);
      if (spottedSuccessTimerRef.current) clearTimeout(spottedSuccessTimerRef.current);
      if (orderGateMsgTimerRef.current) clearTimeout(orderGateMsgTimerRef.current);
    };
  }, []);

  useEffect(() => {
    // Check for an existing cart from a DIFFERENT truck
    try {
      const raw = localStorage.getItem("hot-truck-cart");
      if (raw) {
        const existingCart = JSON.parse(raw);
        if (existingCart.truckId && existingCart.truckId !== id) {
          setCartConflict(existingCart.truckName || "another truck");
        }
      }
    } catch { /* ignore */ }
    loadTruck();
  }, [id]);

  async function loadTruck() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: truckData } = await supabase
        .from("trucks")
        .select("id, name, cuisine, description, profile_photo, is_live, dietary_tags, instagram, phone, avg_rating, review_count, catering_description, catering_starting_price, catering_min_guests")
        .eq("id", id)
        .maybeSingle();

      if (!truckData) { setLoading(false); return; }

      const [
        { data: locationData },
        { data: menu },
        { data: reviewData },
        { count: followers },
        { data: photoData },
        { data: spottedData },
      ] = await Promise.all([
        supabase.from("locations").select("id, lat, lng, address, broadcasted_at").eq("truck_id", id).order("broadcasted_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("menu_items").select("id, truck_id, name, description, price, category, allergens, is_popular, is_sold_out, photo, sort_order").eq("truck_id", id).order("created_at", { ascending: true }).limit(200),
        supabase.from("reviews").select("id, rating, comment, created_at, truck_id").eq("truck_id", id).order("created_at", { ascending: false }).limit(50),
        supabase.from("follows").select("id", { count: "exact", head: true }).eq("truck_id", id),
        supabase.from("truck_photos").select("id, photo_url, created_at").eq("truck_id", id).order("created_at", { ascending: false }).limit(100),
        supabase.from("spotted_posts").select("id, location, note, created_at").eq("truck_id", id).order("created_at", { ascending: false }).limit(5),
      ]);

      let isFollowing = false;
      if (user) {
        const { data: follow } = await supabase
          .from("follows").select("user_id").eq("truck_id", id).eq("user_id", user.id).maybeSingle();
        isFollowing = !!follow;
      }

      // Track view — deduplicated per session so refreshes don't inflate counts (fire-and-forget)
      try {
        const viewKey = `viewed_${id}`;
        if (!sessionStorage.getItem(viewKey)) {
          const viewPayload: Record<string, string> = { truck_id: id };
          if (user) viewPayload.viewer_id = user.id;
          void supabase.from("truck_views").insert(viewPayload);
          sessionStorage.setItem(viewKey, "1");
        }
      } catch { /* ignore — view tracking is non-critical */ }

      if (!mountedRef.current) return;
      setTruck(truckData);
      setLocation(locationData ?? null);
      setMenuItems(menu ?? []);
      setReviews(reviewData ?? []);
      setFollowerCount(followers ?? 0);
      setFollowing(isFollowing);
      setPhotos(photoData ?? []);
      setSpottedPosts(spottedData ?? []);
    } catch {
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function toggleFollow() {
    if (!userId) { router.push("/account"); return; }
    if (followLoadingRef.current) return; // prevent concurrent ops
    followLoadingRef.current = true;
    const wasFollowing = following;

    // Optimistic update
    setFollowing(!wasFollowing);
    setFollowerCount((c) => wasFollowing ? c - 1 : c + 1);

    try {
      const supabase = createClient();
      const { error } = wasFollowing
        ? await supabase.from("follows").delete().eq("truck_id", id).eq("user_id", userId)
        : await supabase.from("follows").insert({ truck_id: id, user_id: userId });

      if (error && mountedRef.current) {
        // Roll back on DB error
        setFollowing(wasFollowing);
        setFollowerCount((c) => wasFollowing ? c + 1 : c - 1);
      }
    } catch {
      // Roll back on network error
      if (mountedRef.current) {
        setFollowing(wasFollowing);
        setFollowerCount((c) => wasFollowing ? c + 1 : c - 1);
      }
    } finally {
      followLoadingRef.current = false;
    }
  }

  async function submitReview() {
    if (!userId) { router.push("/account"); return; }
    if (!reviewRating) return;
    setReviewSubmitting(true);
    setReviewError(null);
    const supabase = createClient();
    try {
      // Prevent duplicate reviews — check if user already reviewed this truck
      const { data: existing } = await supabase
        .from("reviews").select("id").eq("truck_id", id).eq("user_id", userId).maybeSingle();
      if (existing) {
        setReviewError("You've already reviewed this truck.");
        setReviewSubmitting(false);
        return;
      }
      const { error } = await supabase.from("reviews").insert({
        truck_id: id,
        user_id: userId,
        rating: reviewRating,
        comment: reviewText.trim() || null,
      });
      // Handle unique constraint violation (race condition between check and insert)
      if (error) {
        if (error.code === "23505") {
          setReviewError("You've already reviewed this truck.");
          setReviewSubmitting(false);
          return;
        }
        throw new Error(error.message);
      }
      const { data } = await supabase.from("reviews").select("id, rating, comment, created_at, user_id, truck_id").eq("truck_id", id).order("created_at", { ascending: false }).limit(50);
      if (!mountedRef.current) return;
      setReviewSuccess(true);
      setReviewRating(0);
      setReviewText("");
      setReviews(data ?? []);
      reviewSuccessTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setReviewSuccess(false);
      }, 3000);
    } catch (err: any) {
      if (mountedRef.current) setReviewError(err?.message ?? "Could not submit review. Please try again.");
    } finally {
      if (mountedRef.current) setReviewSubmitting(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (!userId) { router.push("/account"); return; }
    if (photoUploadCountRef.current >= 5) {
      setPhotoError("You've uploaded the maximum of 5 photos this session. Come back later!");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Photo must be under 5MB.");
      return;
    }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setPhotoError("Only JPG, PNG, or WebP images are allowed.");
      return;
    }
    setPhotoUploading(true);
    setPhotoError(null);
    const supabase = createClient();
    try {
      const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt || "jpg";
      const safeName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 64);
      const path = `truck-photos/${id}/${safeName}-${userId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("truck-photos").upload(path, file, { upsert: false });
      if (uploadError) throw new Error(uploadError.message);
      const { data: urlData } = supabase.storage.from("truck-photos").getPublicUrl(path);
      const photoUrl = urlData.publicUrl;
      const { error: dbError } = await supabase.from("truck_photos").insert({
        truck_id: id,
        user_id: userId,
        photo_url: photoUrl,
      });
      if (dbError) {
        // Clean up the orphaned storage object before surfacing the error
        void supabase.storage.from("truck-photos").remove([path]).catch(() => {});
        throw new Error(dbError.message);
      }
      const { data: refreshed } = await supabase.from("truck_photos").select("id, photo_url, created_at").eq("truck_id", id).order("created_at", { ascending: false }).limit(100);
      photoUploadCountRef.current += 1;
      if (mountedRef.current) setPhotos(refreshed ?? []);
    } catch (err: any) {
      if (mountedRef.current) setPhotoError(err?.message ?? "Upload failed. Please try again.");
    } finally {
      if (mountedRef.current) setPhotoUploading(false);
    }
  }

  async function submitSpotted() {
    if (!userId) { router.push("/account"); return; }
    if (!spottedLocation.trim()) return;
    setSpottedSubmitting(true);
    setSpottedError(null);
    const supabase = createClient();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not authenticated.");

      const res = await fetch("/api/spotted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          truck_id: id,
          location: spottedLocation.trim(),
          note: spottedNote.trim() || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? "Could not post sighting. Please try again.");
      }

      const { data } = await supabase.from("spotted_posts").select("id, location, note, created_at").eq("truck_id", id).order("created_at", { ascending: false }).limit(5);
      if (!mountedRef.current) return;
      setSpottedSuccess(true);
      setSpottedLocation("");
      setSpottedNote("");
      setSpottedPosts(data ?? []);
      spottedSuccessTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setSpottedSuccess(false);
      }, 3000);
    } catch (err: any) {
      if (mountedRef.current) setSpottedError(err?.message ?? "Could not post sighting. Please try again.");
    } finally {
      if (mountedRef.current) setSpottedSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 pb-32 md:pb-10">
        {/* Navbar skeleton */}
        <nav className="bg-neutral-900 px-6 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-20 h-[52px]" />
        {/* Hero skeleton */}
        <div className="relative h-48 sm:h-56 md:h-72 mt-14 bg-neutral-800 animate-pulse" />
        {/* Profile card skeleton */}
        <div className="max-w-3xl mx-auto w-full">
          <div className="bg-white px-5 py-5 shadow-sm md:mt-4 md:rounded-2xl md:mx-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-6 w-48 bg-neutral-200 rounded animate-pulse" />
                <div className="h-4 w-24 bg-neutral-200 rounded animate-pulse" />
              </div>
              <div className="h-9 w-20 bg-neutral-200 rounded-full animate-pulse flex-shrink-0" />
            </div>
            <div className="h-3 w-full bg-neutral-100 rounded animate-pulse" />
            <div className="h-3 w-3/4 bg-neutral-100 rounded animate-pulse" />
          </div>
          {/* Tabs + menu items skeleton */}
          <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-neutral-100 px-4 py-3 gap-6">
              {["Menu", "Reviews", "Photos", "Info"].map((t) => (
                <div key={t} className="h-3 w-12 bg-neutral-200 rounded animate-pulse" />
              ))}
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <MenuItemSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!loading && loadError) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-neutral-700 font-semibold text-lg">Connection error</p>
        <p className="text-neutral-500 text-sm">Could not load this truck. Check your connection and try again.</p>
        <button
          onClick={() => { setLoadError(false); setLoading(true); loadTruck(); }}
          className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-semibold"
        >
          Retry
        </button>
        <Link href="/trucks" className="text-brand-red text-sm font-medium">Browse all trucks</Link>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-600 font-semibold">Truck not found</p>
        <Link href="/trucks" className="text-brand-red text-sm font-medium">Browse all trucks</Link>
      </div>
    );
  }

  // Use the DB-maintained denormalized columns for instant display (no wait for reviews to load)
  const avgRating: number = truck.avg_rating ?? 0;
  const reviewCount: number = truck.review_count ?? reviews.length;

  const mapsUrl = location
    ? "https://maps.google.com/?q=" + location.lat + "," + location.lng
    : null;

  // Group menu items by category
  const categories = Array.from(new Set(menuItems.map((m) => m.category ?? "Menu")));

  return (
    <div className="min-h-screen bg-neutral-100 pb-32 md:pb-10">

      {/* Navbar */}
      <nav className="bg-neutral-900 px-6 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
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
        <button
          onClick={() => router.push("/trucks")}
          aria-label="Back to trucks list"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors min-w-[44px] min-h-[44px]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          <span className="text-sm font-medium">Back</span>
        </button>
      </nav>

      {/* Hero Photo */}
      <div className="relative h-48 sm:h-56 md:h-72 mt-14 overflow-hidden bg-neutral-800">
        {truck.profile_photo ? (
          <Image src={truck.profile_photo} alt={truck.name} fill priority sizes="100vw" className="object-cover" />
        ) : (
          <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
        )}
        {truck.is_live && (
          <div className="absolute top-4 right-4 bg-brand-red text-white px-4 py-2 rounded-full flex items-center gap-2 font-black text-sm tracking-wide shadow-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
            OPEN NOW
          </div>
        )}
      </div>

      {/* Cart conflict banner — existing cart from a different truck */}
      {cartConflict && (
        <div className="max-w-3xl mx-auto w-full px-4 pt-3">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-amber-800 font-semibold truncate">
                You have items in your cart from <span className="font-black">{cartConflict}</span>
              </p>
            </div>
            {cartClearConfirm ? (
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setCartClearConfirm(false)}
                  className="text-xs font-bold text-amber-600 px-2 py-1.5 rounded-lg hover:bg-amber-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { localStorage.removeItem("hot-truck-cart"); setCartConflict(null); setCartClearConfirm(false); }}
                  className="text-xs font-bold text-white bg-amber-500 px-3 py-1.5 rounded-lg hover:bg-amber-600 transition-colors"
                >
                  Yes, clear
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCartClearConfirm(true)}
                className="flex-shrink-0 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg hover:bg-amber-200 transition-colors"
              >
                Clear Cart
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content wrapper: constrain width on desktop ── */}
      <div className="max-w-3xl mx-auto w-full">

      {/* Profile Section */}
      <div className="bg-white px-5 py-5 shadow-sm md:mt-4 md:rounded-2xl md:shadow-sm md:mx-4">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-wide leading-tight">
              {truck.name}
            </h1>
            <p className="text-brand-red font-bold mt-0.5">{truck.cuisine ?? "Food Truck"}</p>
          </div>
          <button
            onClick={toggleFollow}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all active:scale-95 ${
              following
                ? "border-brand-red bg-brand-red text-white"
                : "border-neutral-200 text-neutral-500 bg-white hover:border-brand-red hover:text-brand-red"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill={following ? "white" : "none"} stroke={following ? "white" : "currentColor"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            {following ? "Saved" : "Save"}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {avgRating > 0 && (
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5A623" stroke="#F5A623" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span className="font-bold text-neutral-800">{avgRating.toFixed(1)}</span>
              <span className="text-neutral-400">({reviewCount})</span>
            </div>
          )}
          {followerCount > 0 && (
            <span className="text-neutral-300">·</span>
          )}
          {followerCount > 0 && (
            <span className="text-neutral-500">{followerCount} follower{followerCount !== 1 ? "s" : ""}</span>
          )}
        </div>

        {truck.description && (
          <p className="text-neutral-600 text-sm leading-relaxed mb-4">{truck.description}</p>
        )}

        {/* Contact links */}
        <div className="flex items-center gap-4">
          {truck.phone && (
            <a href={"tel:" + truck.phone} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand-red transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {truck.phone}
            </a>
          )}
          {truck.instagram && /^[\w.]+$/.test(truck.instagram) && (
            <a href={"https://instagram.com/" + encodeURIComponent(truck.instagram)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand-red transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
              @{truck.instagram}
            </a>
          )}
        </div>
      </div>

      {/* Today's Location */}
      {location && (
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">Today's Location</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 truncate">{location.address}</p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Updated {new Date(location.broadcasted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1.5 bg-brand-red text-white text-xs font-bold rounded-full">
                Directions
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-none">
          {[
            { id: "menu", label: "Menu" },
            { id: "reviews", label: "Reviews" },
            { id: "photos", label: "Photos" },
            { id: "info", label: "Info" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-3.5 text-sm font-bold tracking-wide transition-colors ${
                activeTab === tab.id
                  ? "text-brand-red border-b-2 border-brand-red"
                  : "text-neutral-400 hover:text-neutral-600"
              }`}
            >
              {tab.label}
              {tab.id === "menu" && cartCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 bg-brand-red text-white text-[10px] font-black rounded-full">
                  {cartCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── MENU TAB ── */}
        {activeTab === "menu" && (
          <div>
            {menuItems.length === 0 ? (
              <div className="py-16 px-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                    <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                    <line x1="6" y1="1" x2="6" y2="4"/>
                    <line x1="10" y1="1" x2="10" y2="4"/>
                    <line x1="14" y1="1" x2="14" y2="4"/>
                  </svg>
                </div>
                <p className="font-black text-neutral-700 text-base mb-1">Menu coming soon</p>
                <p className="text-sm text-neutral-400 leading-relaxed max-w-xs">
                  This truck hasn&apos;t added their menu yet. Follow them to get notified when they go live!
                </p>
              </div>
            ) : (
              categories.map((cat) => {
                const catItems = menuItems.filter((m) => (m.category ?? "Menu") === cat);
                return (
                  <div key={cat}>
                    {categories.length > 1 && (
                      <p className="px-4 pt-4 pb-1 text-xs font-black text-neutral-400 uppercase tracking-widest">
                        {cat}
                      </p>
                    )}
                    <div className="divide-y divide-neutral-50">
                      {catItems.map((item) => {
                        const qty = cart[item.id] ?? 0;
                        return (
                          <div key={item.id} className={`flex gap-3 p-4 ${item.is_sold_out ? "opacity-40" : ""}`}>
                            {/* Item photo */}
                            <div className="w-[72px] h-[72px] rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden relative">
                              {item.photo ? (
                                <Image src={item.photo} alt={item.name} fill sizes="72px" className="object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                                    <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                                    <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                                  </svg>
                                </div>
                              )}
                            </div>

                            {/* Item info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className={`font-bold text-neutral-900 text-sm leading-tight ${item.is_sold_out ? "line-through" : ""}`}>
                                    {item.name}
                                    {item.is_popular && !item.is_sold_out && (
                                      <span className="ml-1.5 text-[10px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">
                                        Popular
                                      </span>
                                    )}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">{item.description}</p>
                                  )}
                                  {item.allergens?.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                      {item.allergens.map((a: string) => (
                                        <span key={a} className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded">
                                          {a}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Price + Cart controls */}
                              <div className="flex items-center justify-between mt-2">
                                <p className="text-brand-red font-black text-sm">
                                  ${(item.price ?? 0).toFixed(2)}
                                </p>
                                {item.is_sold_out ? (
                                  <span className="text-xs text-neutral-400 font-semibold">Sold out</span>
                                ) : qty === 0 ? (
                                  <button
                                    onClick={() => addToCart(item.id)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-red text-white text-xs font-black rounded-full hover:bg-red-600 active:scale-95 transition-all"
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                      <path d="M12 5v14M5 12h14"/>
                                    </svg>
                                    Add
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => removeFromCart(item.id)}
                                      className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 active:scale-90 transition-all"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="3" strokeLinecap="round">
                                        <path d="M5 12h14"/>
                                      </svg>
                                    </button>
                                    <span className="text-sm font-black text-neutral-900 w-4 text-center">{qty}</span>
                                    <button
                                      onClick={() => addToCart(item.id)}
                                      className="w-7 h-7 rounded-full bg-brand-red flex items-center justify-center hover:bg-red-600 active:scale-90 transition-all"
                                    >
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                                        <path d="M12 5v14M5 12h14"/>
                                      </svg>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── REVIEWS TAB ── */}
        {activeTab === "reviews" && (
          <div>
            {/* Submit form */}
            <div className="p-4 border-b border-neutral-100">
              <p className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
                Leave a Review
              </p>
              {reviewSuccess ? (
                <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <p className="text-sm font-semibold text-green-700">Thanks for your review!</p>
                </div>
              ) : (
                <>
                  {/* Star picker */}
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setReviewHover(star)}
                        onMouseLeave={() => setReviewHover(0)}
                        className="transition-transform active:scale-90"
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24"
                          fill={star <= (reviewHover || reviewRating) ? "#F5A623" : "none"}
                          stroke={star <= (reviewHover || reviewRating) ? "#F5A623" : "#d1d5db"}
                          strokeWidth="1.5">
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                        </svg>
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder={userId ? "Share your experience (optional)..." : "Sign in to leave a review"}
                    disabled={!userId}
                    rows={3}
                    maxLength={500}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red resize-none transition-colors disabled:bg-neutral-50 disabled:cursor-not-allowed"
                  />
                  {reviewError && (
                    <p className="mt-2 text-xs text-red-500 font-semibold">{reviewError}</p>
                  )}
                  <button
                    onClick={submitReview}
                    disabled={reviewSubmitting || !reviewRating}
                    className="mt-2 w-full py-2.5 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-40 hover:bg-brand-red-dark transition-colors active:scale-95"
                  >
                    {!userId ? "Sign in to Review" : reviewSubmitting ? "Submitting..." : "Submit Review"}
                  </button>
                </>
              )}
            </div>

            {/* Reviews list */}
            <div className="divide-y divide-neutral-50">
              {reviews.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-neutral-400 text-sm">No reviews yet — be the first!</p>
                </div>
              ) : (
                reviews.map((review) => (
                  <div key={review.id} className="p-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <svg key={star} width="12" height="12" viewBox="0 0 24 24"
                            fill={star <= review.rating ? "#F5A623" : "#e5e7eb"}
                            stroke={star <= review.rating ? "#F5A623" : "#e5e7eb"} strokeWidth="1">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-neutral-400">
                        {new Date(review.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-neutral-600 leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── PHOTOS TAB ── */}
        {activeTab === "photos" && (
          <div className="p-4">
            {/* Upload section */}
            <div className="mb-4">
              <p className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">Add a Photo</p>
              {userId ? (
                <>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadPhoto(file);
                      e.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    disabled={photoUploading}
                    className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-500 hover:border-brand-red hover:text-brand-red transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {photoUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="17 8 12 3 7 8"/>
                          <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        Upload a Food Photo (max 5MB)
                      </>
                    )}
                  </button>
                  {photoError && (
                    <p className="mt-2 text-xs text-red-500 font-semibold">{photoError}</p>
                  )}
                </>
              ) : (
                <button
                  onClick={() => router.push("/account")}
                  className="w-full py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-400"
                >
                  Sign in to upload a photo
                </button>
              )}
            </div>

            {/* Lightbox */}
            {lightboxUrl && (
              <div
                className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                onClick={() => setLightboxUrl(null)}
              >
                <button
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
                  onClick={() => setLightboxUrl(null)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
                <div className="relative max-w-2xl w-full max-h-[80vh] aspect-square" onClick={(e) => e.stopPropagation()}>
                  <Image src={lightboxUrl} alt="Food photo" fill sizes="(max-width: 768px) 100vw, 672px" className="object-contain" />
                </div>
              </div>
            )}

            {/* Photos grid */}
            {photos.length === 0 ? (
              <div className="py-10 text-center">
                <svg className="mx-auto mb-3 text-neutral-200" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
                <p className="text-neutral-400 text-sm">No photos yet — be the first to share!</p>
              </div>
            ) : (
              <div className="columns-2 md:columns-3 gap-3 space-y-3">
                {photos.map((photo) => (
                  <div
                    key={photo.id}
                    className="break-inside-avoid rounded-xl overflow-hidden relative cursor-pointer group"
                    onClick={() => setLightboxUrl(photo.photo_url)}
                  >
                    <div className="relative aspect-square bg-neutral-100">
                      <Image src={photo.photo_url} alt="Food photo" fill className="object-cover" sizes="(max-width: 768px) 50vw, 33vw" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] truncate">Community photo</p>
                      <p className="text-white/70 text-[10px]">{new Date(photo.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INFO TAB ── */}
        {activeTab === "info" && (
          <div className="p-4 flex flex-col gap-4">
            {truck.phone && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Phone</p>
                  <a href={"tel:" + truck.phone} className="text-sm font-semibold text-neutral-800">{truck.phone}</a>
                </div>
              </div>
            )}
            {truck.instagram && /^[\w.]+$/.test(truck.instagram) && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Instagram</p>
                  <a href={"https://instagram.com/" + encodeURIComponent(truck.instagram)} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-neutral-800">@{truck.instagram}</a>
                </div>
              </div>
            )}
            {location && (
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 font-medium">Current Location</p>
                  <p className="text-sm font-semibold text-neutral-800">{location.address}</p>
                </div>
              </div>
            )}
            {mapsUrl && (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
                className="w-full py-3 bg-brand-red text-white rounded-xl font-bold text-sm text-center">
                Get Directions
              </a>
            )}

            {/* ── SPOTTED HERE section ── */}
            <div className="pt-2">
              <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-3">Spotted Here!</p>

              {/* Post form */}
              {spottedSuccess ? (
                <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-xl mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <p className="text-sm font-semibold text-green-700">Sighting posted!</p>
                </div>
              ) : (
                <div className="mb-4 flex flex-col gap-2">
                  <input
                    value={spottedLocation}
                    onChange={(e) => setSpottedLocation(e.target.value.slice(0, 100))}
                    placeholder={userId ? "Where did you spot them? (max 100 chars)" : "Sign in to post a sighting"}
                    disabled={!userId}
                    maxLength={100}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red transition-colors disabled:bg-neutral-50 disabled:cursor-not-allowed"
                  />
                  <textarea
                    value={spottedNote}
                    onChange={(e) => setSpottedNote(e.target.value.slice(0, 200))}
                    placeholder="Add a note (optional, max 200 chars)"
                    disabled={!userId}
                    rows={2}
                    maxLength={200}
                    className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red resize-none transition-colors disabled:bg-neutral-50 disabled:cursor-not-allowed"
                  />
                  {spottedError && (
                    <p className="text-xs text-red-500 font-semibold">{spottedError}</p>
                  )}
                  <button
                    onClick={submitSpotted}
                    disabled={spottedSubmitting || !spottedLocation.trim() || !userId}
                    className="py-2.5 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-40 hover:bg-red-600 transition-colors active:scale-95"
                  >
                    {!userId ? "Sign in to Post" : spottedSubmitting ? "Posting..." : "Post Sighting"}
                  </button>
                </div>
              )}

              {/* Recent sightings list */}
              {spottedPosts.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-4">No sightings yet — be the first!</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {spottedPosts.map((post) => (
                    <div key={post.id} className="bg-neutral-50 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          <p className="text-sm font-semibold text-neutral-800 truncate">{post.location}</p>
                        </div>
                        <span className="text-[10px] text-neutral-400 flex-shrink-0">{timeAgo(post.created_at)}</span>
                      </div>
                      {post.note && (
                        <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{post.note}</p>
                      )}
                      <p className="text-[10px] text-neutral-400 mt-1">Community sighting</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      </div> {/* end max-w-3xl content wrapper */}

      {/* Order gate error toast (replaces alert()) */}
      {orderGateMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-neutral-900 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap pointer-events-none">
          {orderGateMsg}
        </div>
      )}

      {/* Floating Cart Bar — appears when items are in cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pt-2 md:flex md:justify-center safe-bottom" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="md:w-full md:max-w-lg">
            <p className="text-center text-[11px] text-white/80 font-semibold mb-2 drop-shadow">
              Pay with cash or card at the truck — no online payment required
            </p>
            <button
              onClick={goToOrder}
              className="w-full bg-brand-red text-white rounded-2xl py-4 px-5 flex items-center justify-between active:scale-95 transition-all"
              style={{ boxShadow: "0 8px 30px rgba(232,72,28,0.45)" }}
            >
              <span className="bg-red-700 text-white text-xs font-black px-2.5 py-1 rounded-lg min-w-[28px] text-center">
                {cartCount}
              </span>
              <span className="font-black text-base tracking-wide">Review Order</span>
              <span className="font-black text-base">${cartTotal.toFixed(2)}</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
