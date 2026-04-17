"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const DIETARY_COLORS: Record<string, string> = {
  "GF":    "bg-green-50 text-green-700",
  "Vegan": "bg-green-50 text-green-700",
  "Halal": "bg-teal-50 text-teal-700",
  "Spicy": "bg-red-50 text-red-600",
};

export default function MenuPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [truck, setTruck] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");

  useEffect(() => {
    loadMenu();
  }, []);

  async function loadMenu() {
    const supabase = createClient();

    const { data: truckData } = await supabase
      .from("trucks")
      .select("*")
      .eq("id", id)
      .single();

    const { data: menuData } = await supabase
      .from("menu_items")
      .select("*")
      .eq("truck_id", id)
      .order("created_at", { ascending: true });

    setTruck(truckData);
    setItems(menuData ?? []);
    setLoading(false);
  }

  const categories = ["ALL", ...Array.from(
    new Set(items.map((i) => i.category?.toUpperCase()).filter(Boolean))
  )];

  const filtered = activeCategory === "ALL"
    ? items
    : items.filter((i) => i.category?.toUpperCase() === activeCategory);

  const grouped = filtered.reduce((acc: Record<string, any[]>, item) => {
    const cat = item.category?.toUpperCase() ?? "OTHER";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-neutral-400">Loading menu...</p>
      </div>
    );
  }

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
          href={"/truck/" + id}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to profile
        </Link>
      </nav>

      {/* Header */}
      <div className="bg-white pt-20 pb-5 px-6 border-b border-neutral-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-neutral-900 uppercase tracking-wide">
              {truck?.name}
            </h1>
            <p className="text-brand-red font-semibold mt-1">
              {truck?.cuisine ?? "Food Truck"}
              <span className="text-neutral-300 mx-2">•</span>
              <span className="text-brand-red">Menu</span>
            </p>
          </div>

          {truck?.is_live && (
            <div className="flex-shrink-0 flex items-center gap-2 bg-brand-red text-white px-5 py-2.5 rounded-full font-black text-sm tracking-wide">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-200" />
              </span>
              OPEN NOW
            </div>
          )}
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 1 && (
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-black tracking-wide transition-all border-2 ${
                  activeCategory === cat
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-white text-neutral-700 border-neutral-200 hover:border-neutral-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="px-4 py-6 max-w-3xl mx-auto">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <p className="text-neutral-500 font-semibold">No menu items yet</p>
            <p className="text-neutral-400 text-sm mt-1">Check back soon!</p>
          </div>
        ) : activeCategory === "ALL" ? (
          Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category} className="mb-6">
              <div className="bg-white rounded-t-2xl px-5 py-4 border-b border-neutral-100">
                <h2 className="text-sm font-black text-neutral-800 uppercase tracking-widest">
                  {category}
                </h2>
              </div>
              <div className="bg-white rounded-b-2xl shadow-sm overflow-hidden">
                {categoryItems.map((item, index) => (
                  <MenuItemRow
                    key={item.id}
                    item={item}
                    isLast={index === categoryItems.length - 1}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {filtered.map((item, index) => (
              <MenuItemRow
                key={item.id}
                item={item}
                isLast={index === filtered.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getDietaryBadges(item: any): string[] {
  const badges: string[] = [];
  const allergens: string[] = item.allergens ?? [];

  if (!allergens.includes("Gluten")) badges.push("GF");
  if (!allergens.includes("Dairy") && !allergens.includes("Eggs")) badges.push("Vegan");

  // Explicit tags from dietary_tags field if present
  const tags: string[] = item.dietary_tags ?? [];
  if (tags.includes("Halal")) badges.push("Halal");
  if (tags.includes("Spicy")) badges.push("Spicy");

  return badges;
}

function MenuItemRow({ item, isLast }: { item: any; isLast: boolean }) {
  const dietaryBadges = getDietaryBadges(item);

  return (
    <div
      className={`flex items-start gap-4 px-5 py-5 ${
        !isLast ? "border-b border-neutral-100" : ""
      } ${item.is_sold_out ? "opacity-50" : ""}`}
    >
      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <p className={`font-black text-neutral-900 uppercase tracking-wide text-sm ${
            item.is_sold_out ? "line-through" : ""
          }`}>
            {item.name}
          </p>
          {item.is_popular && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-brand-red rounded-full border border-red-200">
              POPULAR
            </span>
          )}
          {item.is_sold_out && (
            <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-400 rounded-full">
              SOLD OUT
            </span>
          )}
        </div>

        {item.description && (
          <p className="text-sm text-neutral-500 leading-relaxed mb-2">
            {item.description}
          </p>
        )}

        {/* Dietary badges */}
        {dietaryBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {dietaryBadges.map((badge) => (
              <span
                key={badge}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  DIETARY_COLORS[badge] ?? "bg-neutral-100 text-neutral-500"
                }`}
              >
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Allergen warnings */}
        {item.allergens?.length > 0 && (
          <div className="flex flex-wrap gap-1">
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

      {/* Price + Photo */}
      <div className="flex items-start gap-3 flex-shrink-0">
        <p className="text-brand-red font-black text-lg">
          ${item.price?.toFixed(2)}
        </p>

        {item.photo && (
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0 relative">
            <Image
              src={item.photo}
              alt={item.name}
              fill
              className="object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}
