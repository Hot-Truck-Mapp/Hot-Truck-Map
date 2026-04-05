"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Truck, MenuItem, Review, Location } from "@/lib/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

type TruckFull = Truck & {
  location: Location | null;
  menu_items: MenuItem[];
  reviews: Review[];
  follower_count: number;
  is_following: boolean;
};

export default function TruckPage({ params }: PageProps) {
  const { id } = use(params);
  const [truck, setTruck] = useState<TruckFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<"menu" | "reviews">("menu");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadTruck();
  }, []);

  async function loadTruck() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const { data: truckData } = await supabase
      .from("trucks")
      .select("*")
      .eq("id", id)
      .single();

    if (!truckData) {
      setLoading(false);
      return;
    }

    const { data: location } = await supabase
      .from("locations")
      .select("*")
      .eq("truck_id", id)
      .single();

    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("*")
      .eq("truck_id", id)
      .order("created_at", { ascending: true });

    const { data: reviews } = await supabase
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
    }

    if (user) {
      await supabase.from("truck_views").insert({
        truck_id: id,
        viewer_id: user.id,
      });
    }

    setTruck({
      ...truckData,
      location: location ?? null,
      menu_items: menuItems ?? [],
      reviews: reviews ?? [],
      follower_count: followers ?? 0,
      is_following: isFollowing,
    });

    setFollowing(isFollowing);
    setFollowerCount(followers ?? 0);
    setLoading(false);
  }

  async function toggleFollow() {
    if (!userId) {
      window.location.href = "/login";
      return;
    }

    const supabase = createClient();

    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("truck_id", id)
        .eq("user_id", userId);
      setFollowing(false);
      setFollowerCount((c) => c - 1);
    } else {
      await supabase.from("follows").insert({
        truck_id: id,
        user_id: userId,
      });
      setFollowing(true);
      setFollowerCount((c) => c + 1);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-4xl">🚚</p>
        <p className="text-neutral-600 font-semibold">Truck not found</p>
        <Link href="/" className="text-brand-red text-sm font-medium">
          Back to map
        </Link>
      </div>
    );
  }

  const avgRating = truck.reviews.length > 0
    ? truck.reviews.reduce((sum, r) => sum + r.rating, 0) / truck.reviews.length
    : 0;

  const mapsUrl = truck.location
    ? "https://maps.google.com/?q=" + truck.location.lat + "," + truck.location.lng
    : null;

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Back Button */}
      <div className="fixed top-4 left-4 z-20">
        <Link
          href="/"
          className="w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center text-neutral-600"
        >
          ←
        </Link>
      </div>

      {/* Hero Photo */}
      <div className="w-full h-56 bg-neutral-200 relative overflow-hidden">
        {truck.profile_photo ? (
          <img
            src={truck.profile_photo}
            alt={truck.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl bg-red-50">
            🚚
          </div>
        )}
        {truck.is_live && (
          <div className="absolute top-4 right-4 bg-brand-red text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-200" />
            </span>
            LIVE NOW
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white px-4 pt-4 pb-5 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-neutral-800 truncate">
              {truck.name}
            </h1>
            <p className="text-brand-red font-medium text-sm">
              {truck.cuisine}
            </p>
          </div>
          <button
            onClick={toggleFollow}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
              following
                ? "bg-neutral-100 text-neutral-600 border border-neutral-200"
                : "bg-brand-red text-white"
            }`}
          >
            {following ? "Following" : "+ Follow"}
          </button>
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-sm ${
                  star <= Math.round(avgRating)
                    ? "text-yellow-400"
                    : "text-neutral-200"
                }`}
              >
                ★
              </span>
            ))}
            {truck.reviews.length > 0 && (
              <span className="text-xs text-neutral-400 ml-1">
                ({truck.reviews.length})
              </span>
            )}
          </div>
          <span className="text-neutral-200">·</span>
          <span className="text-xs text-neutral-500">
            👥 {followerCount} follower{followerCount !== 1 ? "s" : ""}
          </span>
        </div>

        {truck.description && (
          <p className="text-sm text-neutral-600 leading-relaxed mb-3">
            {truck.description}
          </p>
        )}

        <div className="flex gap-3">
          {truck.phone && (
            <a
              href={"tel:" + truck.phone}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-red"
            >
              <span>📞</span>
              <span>{truck.phone}</span>
            </a>
          )}
          {truck.instagram && (
            <a
              href={"https://instagram.com/" + truck.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-brand-red"
            >
              <span>📸</span>
              <span>@{truck.instagram}</span>
            </a>
          )}
        </div>
      </div>

      {/* Today's Location */}
      {truck.location && (
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-bold text-neutral-400 uppercase tracking-wide mb-2">
            Today's Location
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <span className="text-xl">📍</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-neutral-800 truncate">
                {truck.location.address}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">
                Updated{" "}
                {new Date(truck.location.broadcasted_at).toLocaleTimeString([], {
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
                className="flex-shrink-0 px-3 py-1.5 bg-brand-red text-white text-xs font-semibold rounded-full"
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
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "menu"
                ? "text-brand-red border-b-2 border-brand-red"
                : "text-neutral-400"
            }`}
          >
            Menu ({truck.menu_items.length})
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              activeTab === "reviews"
                ? "text-brand-red border-b-2 border-brand-red"
                : "text-neutral-400"
            }`}
          >
            Reviews ({truck.reviews.length})
          </button>
        </div>

        {/* Menu Tab */}
        {activeTab === "menu" && (
          <div className="divide-y divide-neutral-50">
            {truck.menu_items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">🍽️</p>
                <p className="text-neutral-400 text-sm">No menu items yet</p>
              </div>
            ) : (
              truck.menu_items.map((item) => (
                <div
                  key={item.id}
                  className={`flex gap-3 p-4 ${item.is_sold_out ? "opacity-50" : ""}`}
                >
                  <div className="w-16 h-16 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                    {item.photo ? (
                      <img
                        src={item.photo}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">
                        🍽️
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold text-neutral-800 text-sm ${
                        item.is_sold_out ? "line-through" : ""
                      }`}>
                        {item.name}
                        {item.is_sold_out && (
                          <span className="ml-2 text-xs text-neutral-400">
                            Sold Out
                          </span>
                        )}
                      </p>
                      <p className="text-brand-red font-bold text-sm flex-shrink-0">
                        ${item.price.toFixed(2)}
                      </p>
                    </div>
                    <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                      {item.description}
                    </p>
                    {item.allergens?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {item.allergens.map((a) => (
                          <span
                            key={a}
                            className="text-[10px] px-1.5 py-0.5 bg-orange-50 text-orange-500 rounded-full"
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
            {truck.reviews.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-3xl mb-2">⭐</p>
                <p className="text-neutral-400 text-sm">No reviews yet</p>
              </div>
            ) : (
              truck.reviews.map((review) => (
                <div key={review.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-xs ${
                            star <= review.rating
                              ? "text-yellow-400"
                              : "text-neutral-200"
                          }`}
                        >
                          ★
                        </span>
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
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-6">
        {mapsUrl ? (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-center text-base"
          >
            Get Directions
          </a>
        ) : (
          <button
            onClick={toggleFollow}
            className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base"
          >
            {following
              ? "Following - We'll notify you when they're live"
              : "Follow to get notified when they go live"}
          </button>
        )}
      </div>

    </div>
  );
}
