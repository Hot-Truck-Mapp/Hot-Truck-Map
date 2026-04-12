"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const CUISINES = [
  "American",
  "Asian Fusion",
  "BBQ",
  "Breakfast & Brunch",
  "Burgers",
  "Caribbean",
  "Chinese",
  "Desserts & Ice Cream",
  "Ethiopian",
  "Greek",
  "Halal",
  "Healthy & Bowls",
  "Indian",
  "Italian",
  "Japanese & Sushi",
  "Mediterranean",
  "Mexican & Tacos",
  "Middle Eastern",
  "Pizza",
  "Sandwiches & Wraps",
  "Seafood",
  "Soul Food",
  "Thai",
  "Vegan & Plant-Based",
  "Other",
];

interface MenuItem {
  name: string;
  price: string;
}

type Step = 1 | 2;

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [truckId, setTruckId] = useState<string | null>(null);

  // Step 1 fields
  const [truckName, setTruckName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [description, setDescription] = useState("");
  const [cuisineOpen, setCuisineOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Step 2 fields
  const [menuItems, setMenuItems] = useState<MenuItem[]>([{ name: "", price: "" }]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) window.location.href = "/login";
        else setUserId(user.id);
      });
  }, []);

  // Close cuisine dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCuisineOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function saveStep1() {
    if (!truckName.trim() || !cuisine || !userId) return;
    setSaving(true);
    setError(null);

    const supabase = createClient();

    // Upsert the truck row (in case they refresh and come back)
    const { data: existing } = await supabase
      .from("trucks")
      .select("id")
      .eq("owner_id", userId)
      .single();

    let id = existing?.id ?? null;

    if (id) {
      await supabase
        .from("trucks")
        .update({ name: truckName.trim(), cuisine, description: description.trim() })
        .eq("id", id);
    } else {
      const { data: inserted, error: insertErr } = await supabase
        .from("trucks")
        .insert({ owner_id: userId, name: truckName.trim(), cuisine, description: description.trim() })
        .select("id")
        .single();

      if (insertErr || !inserted) {
        setError("Could not save your truck. Please try again.");
        setSaving(false);
        return;
      }
      id = inserted.id;
    }

    setTruckId(id);
    setSaving(false);
    setStep(2);
  }

  function addMenuRow() {
    setMenuItems([...menuItems, { name: "", price: "" }]);
  }

  function updateMenuItem(index: number, field: keyof MenuItem, value: string) {
    setMenuItems(menuItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }

  function removeMenuRow(index: number) {
    if (menuItems.length === 1) return;
    setMenuItems(menuItems.filter((_, i) => i !== index));
  }

  async function saveMenuAndFinish() {
    if (!truckId) return;
    setSaving(true);

    const valid = menuItems.filter((item) => item.name.trim() && item.price.trim());

    if (valid.length > 0) {
      const supabase = createClient();
      await supabase.from("menu_items").insert(
        valid.map((item) => ({
          truck_id: truckId,
          name: item.name.trim(),
          price: parseFloat(item.price),
          category: "Menu",
        }))
      );
    }

    window.location.href = "/dashboard/go-live";
  }

  function skipMenu() {
    window.location.href = "/dashboard/go-live";
  }

  const step1Valid = truckName.trim().length > 0 && cuisine.length > 0;

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">

      {/* Top bar */}
      <div className="bg-white border-b border-neutral-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-red rounded-full flex items-center justify-center flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M1 3h15v13H1z"/>
              <path d="M16 8h4l3 3v5h-7V8z"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
          </div>
          <div className="flex items-center gap-1 leading-none">
            <span className="font-black text-brand-red text-base tracking-tight">HOT</span>
            <span className="font-black text-neutral-900 text-base tracking-tight">TRUCK</span>
            <span className="font-black text-brand-orange text-base tracking-tight">MAPS</span>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
            step >= 1 ? "bg-brand-red text-white" : "bg-neutral-200 text-neutral-400"
          }`}>
            {step > 1 ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            ) : "1"}
          </div>
          <div className="w-8 h-px bg-neutral-300" />
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
            step >= 2 ? "bg-brand-red text-white" : "bg-neutral-200 text-neutral-400"
          }`}>
            2
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-5 pt-10 pb-16 max-w-lg mx-auto w-full">

        {/* ── STEP 1: Truck Info ── */}
        {step === 1 && (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">
                Tell us about your truck
              </h1>
              <p className="text-neutral-400 text-sm mt-2">
                This is what customers will see on the map.
              </p>
            </div>

            <div className="w-full flex flex-col gap-5">

              {/* Truck Name */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Company / Truck Name *
                </label>
                <input
                  value={truckName}
                  onChange={(e) => setTruckName(e.target.value)}
                  placeholder="e.g. The Taco Truck"
                  className="w-full px-4 py-3.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors bg-white"
                />
              </div>

              {/* Cuisine Dropdown */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Cuisine Type *
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setCuisineOpen(!cuisineOpen)}
                    className={`w-full px-4 py-3.5 rounded-xl border text-sm text-left flex items-center justify-between transition-colors bg-white ${
                      cuisineOpen
                        ? "border-brand-red"
                        : "border-neutral-200 hover:border-neutral-300"
                    }`}
                  >
                    <span className={cuisine ? "text-neutral-900 font-medium" : "text-neutral-400"}>
                      {cuisine || "Select a cuisine..."}
                    </span>
                    <svg
                      width="16" height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className={`text-neutral-400 transition-transform flex-shrink-0 ${cuisineOpen ? "rotate-180" : ""}`}
                    >
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </button>

                  {cuisineOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div className="max-h-64 overflow-y-auto py-1">
                        {CUISINES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => {
                              setCuisine(c);
                              setCuisineOpen(false);
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-neutral-50 ${
                              cuisine === c
                                ? "font-bold text-brand-red bg-red-50"
                                : "text-neutral-700"
                            }`}
                          >
                            {c}
                            {cuisine === c && (
                              <svg className="inline ml-2" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                                <path d="M20 6L9 17l-5-5"/>
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Description (optional) */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Short Description
                  <span className="ml-1 font-medium text-neutral-400 normal-case tracking-normal">
                    (optional)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tell customers what makes your truck special..."
                  rows={3}
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors bg-white resize-none"
                />
                <p className="text-xs text-neutral-400 mt-1 text-right">
                  {description.length}/200
                </p>
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
              )}

              <button
                onClick={saveStep1}
                disabled={!step1Valid || saving}
                className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                {saving ? "Saving..." : "Next — Add Your Menu"}
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: Menu Items ── */}
        {step === 2 && (
          <>
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-black text-neutral-900 uppercase tracking-tight">
                Build your menu
              </h1>
              <p className="text-neutral-400 text-sm mt-2">
                Add your items and prices. You can always edit these later.
              </p>
            </div>

            <div className="w-full flex flex-col gap-4">

              {menuItems.map((item, index) => (
                <div key={index} className="bg-white rounded-2xl border border-neutral-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-black text-neutral-500 uppercase tracking-wider">
                      Item {index + 1}
                    </p>
                    {menuItems.length > 1 && (
                      <button
                        onClick={() => removeMenuRow(index)}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <path d="M18 6 6 18M6 6l12 12"/>
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    {/* Item name */}
                    <div className="flex-1">
                      <input
                        value={item.name}
                        onChange={(e) => updateMenuItem(index, "name", e.target.value)}
                        placeholder="Item name"
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                      />
                    </div>
                    {/* Price */}
                    <div className="w-28 flex-shrink-0">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          value={item.price}
                          onChange={(e) => updateMenuItem(index, "price", e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full pl-7 pr-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add another item */}
              <button
                onClick={addMenuRow}
                className="w-full py-3 rounded-2xl border-2 border-dashed border-neutral-300 text-neutral-500 font-bold text-sm flex items-center justify-center gap-2 hover:border-brand-red hover:text-brand-red transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
                Add Another Item
              </button>

              <div className="flex flex-col gap-3 mt-2">
                <button
                  onClick={saveMenuAndFinish}
                  disabled={saving}
                  className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base uppercase tracking-wide disabled:opacity-40"
                >
                  {saving ? "Saving..." : "Done — Go to Dashboard"}
                </button>

                <button
                  onClick={skipMenu}
                  className="w-full py-3 text-neutral-400 text-sm font-semibold hover:text-neutral-600 transition-colors"
                >
                  Skip for now — I'll add my menu later
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
