"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

export default function MenuPage({ params }: { params: { id: string } }) {
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
      .eq("id", params.id)
      .single();

    const { data: menuData } = await supabase
      .from("menu_items")
      .select("*")
      .eq("truck_id", params.id)
      .order("created_at", { ascending: true });

    setTruck(truckData);
    setItems(menuData ?? []);
    setLoading(false);
  }

  // Get unique categories from menu items
  const categories = ["ALL", ...Array.from(
    new Set(items.map((i) => i.category?.toUpperCase()).filter(Boolean))
  )];

  const filtered = activeCategory === "ALL"
    ? items
    : items.filter((i) => i.category?.toUpperCase() === activeCategory);

  // Group filtered items by category
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
          href={"/truck/" + params.id}
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
              🔥
              OPEN NOW
            </div>
          )}
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 1 && (
        <div className="bg-white border-b border-neutral-200 px-6 py-4">
          <div className="flex gap-2 overflow-x-auto">
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
          // Grouped by category
          Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category} className="mb-6">
              {/* Category Header */}
              <div className="bg-white rounded-t-2xl px-5 py-4 border-b border-neutral-100">
                <h2 className="text-sm font-black text-neutral-800 uppercase tracking-widest">
                  {category}
                </h2>
              </div>

              {/* Items */}
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
          // Single category view
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

function MenuItemRow({ item, isLast }: { item: any; isLast: boolean }) {
  const [showPhoto, setShowPhoto] = useState(false);

  return (
    <div
      className={`flex items-start gap-4 px-5 py-5 cursor-pointer hover:bg-neutral-50 transition-colors ${
        !isLast ? "border-b border-neutral-100" : ""
      } ${item.is_sold_out ? "opacity-50" : ""}`}
      onClick={() => item.photo && setShowPhoto(!showPhoto)}
    >
      {/* Item Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
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

        {/* Allergens */}
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

        {/* Photo Thumbnail */}
        {item.photo && (
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-100 flex-shrink-0">
            <img
              src={item.photo}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>
    </div>
  );
}