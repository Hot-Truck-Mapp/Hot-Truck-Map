"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function CateringPage() {
  const [trucks, setTrucks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  useEffect(() => {
    loadCateringTrucks();
  }, []);

  async function loadCateringTrucks() {
    const supabase = createClient();
    const { data } = await supabase
      .from("trucks")
      .select("*, catering_packages(*)")
      .eq("offers_catering", true)
      .order("created_at", { ascending: false });

    setTrucks(data ?? []);
    setLoading(false);
  }

  const filtered = trucks.filter((t) =>
    search.trim() === "" ||
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.cuisine?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center">
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
            <span className="font-black text-brand-orange text-sm leading-none">MAPS</span>
          </div>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to map
        </Link>
      </nav>

      {/* Hero */}
      <div className="bg-neutral-900 px-6 py-14 text-center">
        <div className="inline-block bg-brand-red/20 text-brand-red text-xs font-black px-3 py-1.5 rounded-full uppercase tracking-widest mb-4">
          Private Catering
        </div>
        <h1 className="text-4xl font-black text-white uppercase tracking-wide mb-3">
          Book a Food Truck
          <br />
          <span className="text-brand-orange">For Your Event</span>
        </h1>
        <p className="text-neutral-400 text-base max-w-md mx-auto mb-8">
          From corporate lunches to weddings — bring the best local food trucks to your next event.
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mb-8">
          {[
            { value: trucks.length + "+", label: "Trucks Available" },
            { value: "50+", label: "Events Booked" },
            { value: "4.9", label: "Average Rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-black text-white">{stat.value}</p>
              <p className="text-xs text-neutral-400 font-medium">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="max-w-md mx-auto relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by truck name or cuisine..."
            className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30 transition-all"
          />
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-white px-6 py-10">
        <h2 className="text-center text-xs font-black text-neutral-400 uppercase tracking-widest mb-8">
          How It Works
        </h2>
        <div className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
          {[
            {
              step: "01",
              title: "Browse Trucks",
              desc: "Find the perfect food truck for your event"
            },
            {
              step: "02",
              title: "Submit Request",
              desc: "Tell us your date, location and guest count"
            },
            {
              step: "03",
              title: "Get Confirmed",
              desc: "Operator reviews and confirms your booking"
            },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 bg-brand-red rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-white font-black text-sm">{item.step}</span>
              </div>
              <p className="font-black text-neutral-900 text-sm uppercase tracking-wide mb-1">
                {item.title}
              </p>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Truck Grid */}
      <div className="px-4 pb-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-neutral-500 font-medium">
            <span className="font-black text-neutral-900">{filtered.length}</span>
            {" "}truck{filtered.length !== 1 ? "s" : ""} available for catering
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <p className="text-neutral-400">Loading trucks...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <p className="text-neutral-500 font-semibold">No catering trucks found</p>
            <p className="text-neutral-400 text-sm mt-1">Try a different search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((truck) => (
              <div
                key={truck.id}
                className="bg-white rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Photo */}
                <div className="h-48 bg-neutral-200 relative overflow-hidden">
                  {truck.profile_photo ? (
                    <Image src={truck.profile_photo} alt={truck.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M1 3h15v13H1z"/>
                        <path d="M16 8h4l3 3v5h-7V8z"/>
                        <circle cx="5.5" cy="18.5" r="2.5"/>
                        <circle cx="18.5" cy="18.5" r="2.5"/>
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-neutral-900/80 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {truck.cuisine}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-black text-neutral-900 uppercase tracking-wide text-base mb-1">
                    {truck.name}
                  </h3>

                  {truck.catering_description && (
                    <p className="text-sm text-neutral-500 mb-3 line-clamp-2">
                      {truck.catering_description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 mb-4">
                    {truck.catering_starting_price && (
                      <div>
                        <p className="text-xs text-neutral-400 font-medium">Starting from</p>
                        <p className="text-brand-red font-black text-lg">
                          ${truck.catering_starting_price}
                          <span className="text-xs font-normal text-neutral-400">/person</span>
                        </p>
                      </div>
                    )}
                    {truck.catering_min_guests && (
                      <div>
                        <p className="text-xs text-neutral-400 font-medium">Min guests</p>
                        <p className="font-black text-neutral-800 text-lg">
                          {truck.catering_min_guests}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Packages */}
                  {truck.catering_packages?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {truck.catering_packages.slice(0, 3).map((pkg: any) => (
                        <span
                          key={pkg.id}
                          className="text-[10px] font-bold px-2 py-1 bg-red-50 text-brand-red rounded-full"
                        >
                          {pkg.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={"/catering/book/" + truck.id}
                    className="block w-full py-3 bg-brand-red text-white rounded-xl font-black text-sm text-center uppercase tracking-wide hover:bg-brand-red-dark transition-colors"
                  >
                    Book This Truck
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}