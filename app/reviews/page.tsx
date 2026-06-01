"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Review = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  truck_id: string;
  truck_name?: string;
  truck_cuisine?: string;
};

type RatingFilter = "all" | "5" | "4+" | "3+";

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

export default function ReviewsFeedPage() {
  const mountedRef = useRef(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: reviewData } = await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, truck_id")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mountedRef.current || !reviewData) return;

      // Fetch truck names for the review set
      const truckIds = [...new Set(reviewData.map((r) => r.truck_id))];
      const { data: truckData } = await supabase
        .from("trucks")
        .select("id, name, cuisine")
        .in("id", truckIds);

      if (!mountedRef.current) return;

      const truckMap: Record<string, { name: string; cuisine: string }> = {};
      for (const t of truckData ?? []) {
        truckMap[t.id] = { name: t.name, cuisine: t.cuisine };
      }

      const enriched: Review[] = reviewData.map((r) => ({
        ...r,
        truck_name: truckMap[r.truck_id]?.name,
        truck_cuisine: truckMap[r.truck_id]?.cuisine,
      }));

      setReviews(enriched);
      setLoadError(false);
    } catch {
      if (mountedRef.current) setLoadError(true);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  const filtered = reviews.filter((r) => {
    if (ratingFilter === "5") return r.rating === 5;
    if (ratingFilter === "4+") return r.rating >= 4;
    if (ratingFilter === "3+") return r.rating >= 3;
    return true;
  });

  const ratingFilters: { id: RatingFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "5", label: "5★" },
    { id: "4+", label: "4★+" },
    { id: "3+", label: "3★+" },
  ];

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-4 md:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
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
                <span className="font-black text-brand-red text-sm">HOT</span>
                <span className="font-black text-white text-sm">TRUCK</span>
              </div>
              <span className="font-black text-brand-orange text-sm leading-none">MAP</span>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/trucks" className="px-3 py-1.5 rounded-lg border border-neutral-700 text-neutral-300 text-xs font-semibold hover:border-neutral-500 hover:text-white transition-colors">
            All Trucks
          </Link>
          <Link href="/account" aria-label="Account" className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-black text-neutral-900">Community Reviews</h1>
          <p className="text-neutral-500 text-sm mt-1">Recent reviews from the Hot Truck Map community</p>

          {/* Rating filter pills */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {ratingFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setRatingFilter(f.id)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  ratingFilter === f.id
                    ? "bg-brand-red text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-brand-red border-t-transparent rounded-full animate-spin" />
            <p className="text-neutral-400 text-sm">Loading reviews...</p>
          </div>
        ) : loadError ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 font-semibold">Could not load reviews</p>
            <p className="text-neutral-400 text-sm mt-1">Check your connection and refresh the page.</p>
            <button
              onClick={() => { setLoadError(false); setLoading(true); loadReviews(); }}
              className="mt-4 px-5 py-2 bg-brand-red text-white rounded-xl text-sm font-semibold"
            >Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-neutral-400 text-sm">No reviews match this filter.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl shadow-sm p-4">
                {/* Truck name + link */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    {review.truck_name ? (
                      <Link
                        href={`/truck/${review.truck_id}`}
                        className="font-black text-neutral-900 text-sm uppercase tracking-wide hover:text-brand-red transition-colors leading-tight"
                      >
                        {review.truck_name}
                      </Link>
                    ) : (
                      <p className="font-black text-neutral-900 text-sm">Unknown Truck</p>
                    )}
                    {review.truck_cuisine && (
                      <p className="text-xs text-brand-red font-semibold mt-0.5">{review.truck_cuisine}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-neutral-400 flex-shrink-0">{timeAgo(review.created_at)}</span>
                </div>

                {/* Stars */}
                <div className="flex gap-0.5 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg key={star} width="14" height="14" viewBox="0 0 24 24"
                      fill={star <= review.rating ? "#F5A623" : "#e5e7eb"}
                      stroke={star <= review.rating ? "#F5A623" : "#e5e7eb"} strokeWidth="1">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  ))}
                </div>

                {review.comment && (
                  <p className="text-sm text-neutral-600 leading-relaxed">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
