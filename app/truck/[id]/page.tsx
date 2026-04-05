"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function TruckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [truck, setTruck] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [activeTab, setActiveTab] = useState<"menu" | "reviews">("menu");

  useEffect(() => {
    loadTruck();
  }, []);

  async function loadTruck() {
    const supabase = createClient();

    const { data } = await supabase
      .from("trucks")
      .select("*")
      .eq("id", id)
      .single();

    setTruck(data);
    setLoading(false);
  }

  async function toggleFollow() {
    setFollowing(!following);
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
          <div className="absolute top-4 right-4 bg-brand-red text-white text-xs font-bold px-3 py-1.5 rounded-full">
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
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold ${
              following
                ? "bg-neutral-100 text-neutral-600"
                : "bg-brand-red text-white"
            }`}
          >
            {following ? "Following" : "+ Follow"}
          </button>
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
              className="text-xs text-neutral-500"
            >
              📞 {truck.phone}
            </a>
          )}
          {truck.instagram && (
            <a
              href={"https://instagram.com/" + truck.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-neutral-500"
            >
              📸 @{truck.instagram}
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-neutral-100">
          <button
            onClick={() => setActiveTab("menu")}
            className={`flex-1 py-3 text-sm font-semibold ${
              activeTab === "menu"
                ? "text-brand-red border-b-2 border-brand-red"
                : "text-neutral-400"
            }`}
          >
            Menu
          </button>
          <button
            onClick={() => setActiveTab("reviews")}
            className={`flex-1 py-3 text-sm font-semibold ${
              activeTab === "reviews"
                ? "text-brand-red border-b-2 border-brand-red"
                : "text-neutral-400"
            }`}
          >
            Reviews
          </button>
        </div>

        {activeTab === "menu" && (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">🍽️</p>
            <p className="text-neutral-400 text-sm">No menu items yet</p>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="py-12 text-center">
            <p className="text-3xl mb-2">⭐</p>
            <p className="text-neutral-400 text-sm">No reviews yet</p>
          </div>
        )}
      </div>

      {/* Bottom CTA */}
      <div className="px-4 py-6">
        <button
          onClick={toggleFollow}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base"
        >
          {following ? "Following" : "Follow this truck"}
        </button>
      </div>

    </div>
  );
}
