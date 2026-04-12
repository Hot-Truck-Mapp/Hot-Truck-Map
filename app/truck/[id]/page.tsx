"use client";

import { useState, useEffect, use, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useFollow } from "@/lib/hooks/useFollow";

export default function TruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [truck, setTruck] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [initialFollowing, setInitialFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"menu" | "reviews" | "info">("menu");
  const [loading, setLoading] = useState(true);

  const onCountChange = useCallback((delta: 1 | -1) => {
    setFollowerCount((c) => c + delta);
  }, []);

  const { following, toggleFollow } = useFollow(id, initialFollowing, onCountChange);

  useEffect(() => {
    loadTruck();
  }, []);

  async function loadTruck() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data: truckData } = await supabase
      .from("trucks")
      .select("*")
      .eq("id", id)
      .single();

    if (!truckData) {
      setLoading(false);
      return;
    }

    const { data: locationData } = await supabase
      .from("locations")
      .select("*")
      .eq("truck_id", id)
      .single();

    const { data: menu } = await supabase
      .from("menu_items")
      .select("*")
      .eq("truck_id", id)
      .order("created_at", { ascending: true });

    const { data: reviewData } = await supabase
      .from("reviews")
      .select("*")
      .eq("truck_id", id)
      .order("created_at", { ascending: false });

    const { count: followers } = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("truck_id", id);

    let isFollowing = false;
    if (user) {
      const { data: follow } = await supabase
        .from("follows")
        .select("*")
        .eq("truck_id", id)
        .eq("user_id", user.id)
        .single();
      isFollowing = !!follow;

      await supabase.from("truck_views").insert({
        truck_id: id,
        viewer_id: user.id,
      });
    }

    setTruck(truckData);
    setLocation(locationData ?? null);
    setMenuItems(menu ?? []);
    setReviews(reviewData ?? []);
    setFollowerCount(followers ?? 0);
    setInitialFollowing(isFollowing);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-600 font-semibold">Truck not found</p>
        <Link href="/" className="text-brand-red text-sm font-medium">
          Back to map
        </Link>
      </div>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 4.5;

  const mapsUrl = location
    ? "https://maps.google.com/?q=" + location.lat + "," + location.lng
    : null;

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 px-6 py-3 flex items-center justify-between fixed top-0 left-0 right-0 z-20">
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
            <span className="font-black text-brand-orange text-sm tracking-tight leading-none">MAPS</span>
          </div>
        </div>

        <Link
          href="/"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
      </nav>

      {/* Hero Photo */}
      <div className="relative h-64 md:h-80 mt-14 overflow-hidden bg-neutral-800">
        {truck.profile_photo ? (
          <img
            src={truck.profile_photo}
            alt={truck.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
        )}

        {/* Open Now Badge */}
        {truck.is_live && (
          <div className="absolute top-4 right-4 bg-brand-red text-white px-4 py-2 rounded-full flex items-center gap-2 font-black text-sm tracking-wide">
            <span className="w-2 h-2 bg-white rounded-full" />
            OPEN NOW
          </div>
        )}
      </div>

      {/* Profile Section */}
      <div className="bg-white px-6 py-5 shadow-sm">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-wide">
              {truck.name}
            </h1>
            <p className="text-brand-red font-semibold mt-0.5">
              {truck.cuisine ?? "Food Truck"}
            </p>
          </div>

          {/* View Menu Button */}
          <Link
            href={"/truck/" + id + "/menu"}
            className="flex-shrink-0 flex items-center gap-2 bg-brand-red text-white px-5 py-3 rounded-full font-bold text-sm hover:bg-brand-red-dark transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
            </svg>
            View Menu
          </Link>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 mb-3">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#F5A623" stroke="#F5A623" strokeWidth="1">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          <span className="font-bold text-neutral-800 text-base">
            {avgRating > 0 ? avgRating.toFixed(1) : "4.5"}
          </span>
          <span className="text-neutral-400 text-sm">
            ({reviews.length > 0 ? reviews.length + "+ reviews" : "200+ reviews"})
          </span>
          <span className="text-neutral-200 mx-1">·</span>
          <span className="text-sm text-neutral-500">
            {followerCount} follower{followerCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Description */}
        {truck.description && (
          <p className="text-neutral-600 text-sm leading-relaxed mb-4">
            {truck.description}
          </p>
        )}

        {/* Follow + Contact */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleFollow}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
              following
                ? "border-neutral-200 text-neutral-500 bg-neutral-50"
                : "border-brand-red text-brand-red hover:bg-brand-red hover:text-white"
            }`}
          >
            {following ? "Following ✓" : "+ Follow"}
          </button>
          {truck.phone && (
            <a
              href={"tel:" + truck.phone}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand-red transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              {truck.phone}
            </a>
          )}
          {truck.instagram && (
            <a
              href={"https://instagram.com/" + truck.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-brand-red transition-colors"
            >
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
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
            Today's Location
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 truncate">
                {location.address}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Updated {new Date(location.broadcasted_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 px-3 py-1.5 bg-brand-red text-white text-xs font-bold rounded-full"
              >
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
            </button>
          ))}
        </div>

        {/* Menu Tab */}
        {activeTab === "menu" && (
          <div className="divide-y divide-neutral-50">
            {menuItems.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-neutral-400 text-sm">No menu items yet</p>
              </div>
            ) : (
              menuItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-4 ${item.is_sold_out ? "opacity-40" : ""}`}
                >
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                          <line x1="6" y1="1" x2="6" y2="4"/>
                          <line x1="10" y1="1" x2="10" y2="4"/>
                          <line x1="14" y1="1" x2="14" y2="4"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-bold text-neutral-900 text-sm ${
                        item.is_sold_out ? "line-through" : ""
                      }`}>
                        {item.name}
                        {item.is_sold_out && (
                          <span className="ml-2 text-xs font-normal text-neutral-400">
                            Sold Out
                          </span>
                        )}
                      </p>
                      <p className="text-brand-red font-bold text-sm flex-shrink-0">
                        ${item.price?.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                    {item.allergens?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.allergens.map((a: string) => (
                          <span
                            key={a}
                            className="text-[10px] font-bold px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded"
                          >
                            {a}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reviews Tab */}
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
                        <svg
                          key={star}
                          width="12" height="12"
                          viewBox="0 0 24 24"
                          fill={star <= review.rating ? "#F5A623" : "#e5e7eb"}
                          stroke={star <= review.rating ? "#F5A623" : "#e5e7eb"}
                          strokeWidth="1"
                        >
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

        {/* Info Tab */}
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
                  <a href={"tel:" + truck.phone} className="text-sm font-semibold text-neutral-800">
                    {truck.phone}
                  </a>
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
                  <a
                    href={"https://instagram.com/" + truck.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-neutral-800"
                  >
                    @{truck.instagram}
                  </a>
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
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-6 flex gap-3">
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-4 bg-brand-red text-white rounded-2xl font-bold text-center text-sm tracking-wide"
          >
            Get Directions
          </a>
        )}
        <button
          onClick={toggleFollow}
          className={`flex-1 py-4 rounded-2xl font-bold text-sm tracking-wide border-2 transition-all ${
            following
              ? "border-neutral-200 text-neutral-500"
              : "border-brand-red text-brand-red hover:bg-brand-red hover:text-white"
          }`}
        >
          {following ? "Following ✓" : "+ Follow Truck"}
        </button>
      </div>

    </div>
  );
}
