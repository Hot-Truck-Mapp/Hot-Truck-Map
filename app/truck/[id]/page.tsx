"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function TruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [truck, setTruck] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"menu" | "reviews" | "info">("menu");
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Cart state: maps menu item id → quantity
  const [cart, setCart] = useState<Record<string, number>>({});

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
    localStorage.setItem(
      "hot-truck-cart",
      JSON.stringify({ truckId: id, truckName: truck?.name ?? "", items })
    );
    window.location.href = `/truck/${id}/order`;
  }

  useEffect(() => {
    loadTruck();
  }, []);

  async function loadTruck() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      const { data: truckData } = await supabase
        .from("trucks")
        .select("*")
        .eq("id", id)
        .single();

      if (!truckData) { setLoading(false); return; }

      const [
        { data: locationData },
        { data: menu },
        { data: reviewData },
        { count: followers },
      ] = await Promise.all([
        supabase.from("locations").select("*").eq("truck_id", id).single(),
        supabase.from("menu_items").select("*").eq("truck_id", id).order("created_at", { ascending: true }),
        supabase.from("reviews").select("*").eq("truck_id", id).order("created_at", { ascending: false }),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("truck_id", id),
      ]);

      let isFollowing = false;
      if (user) {
        const { data: follow } = await supabase
          .from("follows").select("*").eq("truck_id", id).eq("user_id", user.id).single();
        isFollowing = !!follow;
        await supabase.from("truck_views").insert({ truck_id: id, viewer_id: user.id });
      }

      setTruck(truckData);
      setLocation(locationData ?? null);
      setMenuItems(menu ?? []);
      setReviews(reviewData ?? []);
      setFollowerCount(followers ?? 0);
      setFollowing(isFollowing);
    } catch {
      // silently fail — UI will show empty states
    } finally {
      setLoading(false);
    }
  }

  async function toggleFollow() {
    if (!userId) { window.location.href = "/login"; return; }
    const supabase = createClient();
    if (following) {
      await supabase.from("follows").delete().eq("truck_id", id).eq("user_id", userId);
      setFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("follows").insert({ truck_id: id, user_id: userId });
      setFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-brand-red rounded-full flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <p className="text-neutral-400 text-sm">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-600 font-semibold">Truck not found</p>
        <Link href="/" className="text-brand-red text-sm font-medium">Back to map</Link>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const mapsUrl = location
    ? "https://maps.google.com/?q=" + location.lat + "," + location.lng
    : null;

  // Group menu items by category
  const categories = Array.from(new Set(menuItems.map((m) => m.category ?? "Menu")));

  return (
    <div className="min-h-screen bg-neutral-100 pb-32">

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
            <span className="font-black text-brand-orange text-sm tracking-tight leading-none">MAPS</span>
          </div>
        </div>
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
      </nav>

      {/* Hero Photo */}
      <div className="relative h-56 md:h-72 mt-14 overflow-hidden bg-neutral-800">
        {truck.profile_photo ? (
          <img src={truck.profile_photo} alt={truck.name} className="w-full h-full object-cover" />
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

      {/* Profile Section */}
      <div className="bg-white px-5 py-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-wide leading-tight">
              {truck.name}
            </h1>
            <p className="text-brand-red font-bold mt-0.5">{truck.cuisine ?? "Food Truck"}</p>
          </div>
          <button
            onClick={toggleFollow}
            className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
              following
                ? "border-neutral-200 text-neutral-400 bg-neutral-50"
                : "border-brand-red text-brand-red hover:bg-brand-red hover:text-white"
            }`}
          >
            {following ? (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20 6L9 17l-5-5"/></svg>Following</>
            ) : (
              <>+ Follow</>
            )}
          </button>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {reviews.length > 0 && (
            <div className="flex items-center gap-1">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#F5A623" stroke="#F5A623" strokeWidth="1">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span className="font-bold text-neutral-800">{avgRating.toFixed(1)}</span>
              <span className="text-neutral-400">({reviews.length})</span>
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
          {truck.instagram && (
            <a href={"https://instagram.com/" + truck.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand-red transition-colors">
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
        <div className="flex border-b border-neutral-100">
          {[
            { id: "menu", label: "Menu" },
            { id: "reviews", label: "Reviews" },
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
              <div className="py-14 text-center">
                <svg className="mx-auto mb-3 text-neutral-200" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                  <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                </svg>
                <p className="text-neutral-400 text-sm">No menu items yet</p>
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
                            <div className="w-[72px] h-[72px] rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                              {item.photo ? (
                                <img src={item.photo} alt={item.name} className="w-full h-full object-cover" />
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
                                  ${item.price?.toFixed(2)}
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
          <div className="divide-y divide-neutral-50">
            {reviews.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-neutral-400 text-sm">No reviews yet</p>
                <p className="text-neutral-300 text-xs mt-1">Be the first!</p>
              </div>
            ) : (
              reviews.map((review) => (
                <div key={review.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
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
                  <p className="text-sm text-neutral-600">{review.body}</p>
                </div>
              ))
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
            {truck.instagram && (
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
                  <a href={"https://instagram.com/" + truck.instagram} target="_blank" rel="noopener noreferrer"
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
          </div>
        )}
      </div>

      {/* Floating Cart Bar — appears when items are in cart */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black/10 to-transparent">
          <button
            onClick={goToOrder}
            className="w-full bg-brand-red text-white rounded-2xl py-4 px-5 flex items-center justify-between shadow-xl active:scale-95 transition-all"
            style={{ boxShadow: "0 8px 30px rgba(232,72,28,0.4)" }}
          >
            <span className="bg-red-700 text-white text-xs font-black px-2.5 py-1 rounded-lg min-w-[28px] text-center">
              {cartCount}
            </span>
            <span className="font-black text-base tracking-wide">Place Order</span>
            <span className="font-black text-base">${cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}

    </div>
  );
}
