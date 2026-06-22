"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

type MenuItem = {
  id: string;
  truck_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
  allergens: string[];
  is_popular: boolean;
  is_sold_out: boolean;
  photo: string | null;
  sort_order: number | null;
  created_at: string;
};

type ItemForm = {
  name: string;
  description: string;
  price: string;
  allergens: string[];
  is_sold_out: boolean;
  photo: string;
};

const ALLERGEN_OPTIONS = ["Nuts", "Dairy", "Gluten", "Soy", "Eggs"];
const EMPTY_FORM: ItemForm = {
  name: "", description: "", price: "", allergens: [], is_sold_out: false, photo: "",
};

export default function MenuPage() {
  const mountedRef = useRef(true);
  const addItemInFlightRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Add-item inline form
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [formSaving, setFormSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // 2-tap delete confirm
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    loadMenu();
    return () => {
      mountedRef.current = false;
      if (toastRef.current) clearTimeout(toastRef.current);
    };
  }, []);

  function showToast(msg: string, isError = false) {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ msg, isError });
    toastRef.current = setTimeout(() => {
      if (mountedRef.current) setToast(null);
    }, 4000);
  }

  async function loadMenu() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) throw new Error("Not authenticated");

      const { data: truck, error: truckErr } = await supabase
        .from("trucks")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (truckErr) throw new Error(truckErr.message);

      if (!mountedRef.current) return;

      if (truck) {
        setTruckId(truck.id);
        const { data: menuData, error: menuErr } = await supabase
          .from("menu_items")
          .select("id, truck_id, name, description, price, category, allergens, is_popular, is_sold_out, photo, sort_order, created_at")
          .eq("truck_id", truck.id)
          .order("sort_order", { ascending: true, nullsFirst: false })
          .order("created_at", { ascending: true });
        if (menuErr) throw new Error(menuErr.message);
        if (mountedRef.current) setItems(menuData ?? []);
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to load menu");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  async function uploadPhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) { showToast("Photo must be under 5 MB", true); return; }
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      showToast("Only JPG, PNG, or WebP images are allowed.", true);
      return;
    }
    setPhotoUploading(true);
    try {
      const supabase = createClient();
      const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const ext = rawExt || "jpg";
      const safeName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9._-]/g, "-")
        .slice(0, 64);
      const path = `menu/${truckId ?? "shared"}/${safeName}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("menu-photos").upload(path, file, { upsert: true });
      if (uploadErr) throw new Error(uploadErr.message);
      const { data } = supabase.storage.from("menu-photos").getPublicUrl(path);
      if (!data?.publicUrl) throw new Error("Could not get photo URL");
      if (mountedRef.current) setForm((f) => ({ ...f, photo: data.publicUrl }));
    } catch (err: any) {
      if (mountedRef.current) showToast(err?.message ?? "Photo upload failed", true);
    } finally {
      if (mountedRef.current) setPhotoUploading(false);
    }
  }

  async function addItem() {
    if (addItemInFlightRef.current) return; // in-flight guard
    if (!truckId || !form.name.trim() || !form.price) return;
    const parsedPrice = parseFloat(form.price);
    if (isNaN(parsedPrice) || parsedPrice <= 0 || parsedPrice > 10_000) {
      showToast("Please enter a valid price between $0.01 and $10,000.", true);
      return;
    }
    addItemInFlightRef.current = true;
    setFormSaving(true);
    try {
      const supabase = createClient();
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.sort_order ?? 0)) : 0;
      const { error: insertErr } = await supabase.from("menu_items").insert({
        truck_id: truckId,
        name: form.name.trim(),
        description: form.description || null,
        price: parsedPrice,
        allergens: form.allergens,
        is_sold_out: form.is_sold_out,
        photo: form.photo || null,
        sort_order: maxOrder + 1,
        category: "Other",
        is_popular: false,
      });
      if (insertErr) throw new Error(insertErr.message);

      // Reload items
      const { data: fresh, error: fetchErr } = await supabase
        .from("menu_items")
        .select("id, truck_id, name, description, price, category, allergens, is_popular, is_sold_out, photo, sort_order, created_at")
        .eq("truck_id", truckId)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (fetchErr) throw new Error(fetchErr.message);

      if (!mountedRef.current) return;
      setItems(fresh ?? []);
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      showToast("Item added!", false);
    } catch (err: any) {
      if (mountedRef.current) showToast(err?.message ?? "Could not add item", true);
    } finally {
      addItemInFlightRef.current = false;
      if (mountedRef.current) setFormSaving(false);
    }
  }

  async function toggleSoldOut(item: MenuItem) {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_sold_out: !i.is_sold_out } : i));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("menu_items")
        .update({ is_sold_out: !item.is_sold_out })
        .eq("id", item.id)
        .eq("truck_id", truckId!);
      if (error) {
        // Roll back
        setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_sold_out: item.is_sold_out } : i));
        if (mountedRef.current) showToast("Could not update item: " + error.message, true);
      }
    } catch {
      setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_sold_out: item.is_sold_out } : i));
      if (mountedRef.current) showToast("Could not update item — check your connection", true);
    }
  }

  async function deleteItem(id: string) {
    if (deletingId !== id) {
      setDeletingId(id);
      return;
    }
    setDeletingId(null);
    // Optimistic
    const prev = items;
    setItems((list) => list.filter((i) => i.id !== id));
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id)
        .eq("truck_id", truckId!);
      if (error) {
        setItems(prev);
        if (mountedRef.current) showToast("Delete failed: " + error.message, true);
      } else {
        if (mountedRef.current) showToast("Item deleted", false);
      }
    } catch {
      setItems(prev);
      if (mountedRef.current) showToast("Delete failed — check your connection", true);
    }
  }

  async function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...items];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newItems.length) return;

    // Capture snapshot before optimistic update for rollback
    const snapshot = [...items];

    // Swap
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];

    // Reassign sort_order values sequentially
    const updated = newItems.map((item, i) => ({ ...item, sort_order: i + 1 }));
    setItems(updated);

    try {
      const supabase = createClient();
      // Batch update sort_order for the two swapped items
      await Promise.all([
        supabase.from("menu_items").update({ sort_order: updated[index].sort_order }).eq("id", updated[index].id).eq("truck_id", truckId!),
        supabase.from("menu_items").update({ sort_order: updated[swapIndex].sort_order }).eq("id", updated[swapIndex].id).eq("truck_id", truckId!),
      ]);
    } catch {
      // Roll back on error using snapshot (avoids stale closure on `items`)
      if (mountedRef.current) {
        setItems(snapshot);
        showToast("Could not reorder — please try again", true);
      }
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Loading menu...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 text-center">
      <div>
        <p className="font-bold text-neutral-800 mb-2">Could not load menu</p>
        <p className="text-sm text-neutral-500 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); loadMenu(); }}
          className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-2xl shadow-lg text-sm font-semibold transition-all ${
          toast.isError ? "bg-red-600 text-white" : "bg-green-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-neutral-800">Menu</h1>
          <p className="text-sm text-neutral-400">{items.length} item{items.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => { setForm(EMPTY_FORM); setShowAddForm((v) => !v); }}
          className="flex items-center gap-1.5 px-4 py-2 bg-brand-red text-white rounded-xl text-sm font-bold"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Item
        </button>
      </div>

      <div className="p-4 flex flex-col gap-3 max-w-2xl mx-auto pb-10">

        {/* Inline Add Form */}
        {showAddForm && (
          <div className="bg-white rounded-2xl shadow-sm p-4 border-2 border-brand-red">
            <p className="text-sm font-bold text-neutral-800 mb-4">New Menu Item</p>

            {/* Photo upload */}
            <div
              onClick={() => photoInputRef.current?.click()}
              className="w-full h-32 rounded-xl overflow-hidden cursor-pointer bg-neutral-100 border-2 border-dashed border-neutral-200 hover:border-brand-red transition-colors flex items-center justify-center relative mb-4"
            >
              {form.photo ? (
                <Image src={form.photo} alt="preview" fill sizes="96px" className="object-cover" />
              ) : (
                <p className="text-sm text-neutral-400">
                  {photoUploading ? "Uploading..." : "Tap to add photo"}
                </p>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); }}
            />

            {/* Name */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Al Pastor Taco"
                maxLength={100}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red"
              />
            </div>

            {/* Description */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Optional — what makes this item special?"
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red resize-none"
              />
            </div>

            {/* Price */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Price *</label>
              <div className="flex rounded-xl border border-neutral-200 overflow-hidden focus-within:border-brand-red transition-colors bg-white">
                <div className="flex items-center px-3 bg-neutral-50 border-r border-neutral-200 flex-shrink-0">
                  <span className="text-neutral-600 font-black text-sm select-none">$</span>
                </div>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  max="10000"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white"
                />
              </div>
            </div>

            {/* Allergens */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-neutral-500 mb-2">Allergens</label>
              <div className="flex flex-wrap gap-2">
                {ALLERGEN_OPTIONS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setForm((f) => ({
                      ...f,
                      allergens: f.allergens.includes(a)
                        ? f.allergens.filter((x) => x !== a)
                        : [...f.allergens, a],
                    }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                      form.allergens.includes(a)
                        ? "bg-orange-50 border-orange-400 text-orange-600"
                        : "bg-white border-neutral-200 text-neutral-500"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Sold out toggle */}
            <div className="flex items-center justify-between border border-neutral-200 rounded-xl px-4 py-3 mb-4">
              <div>
                <p className="text-sm font-bold text-neutral-800">Mark as Sold Out</p>
                <p className="text-xs text-neutral-400">Item greyed out on menu</p>
              </div>
              <button
                onClick={() => setForm((f) => ({ ...f, is_sold_out: !f.is_sold_out }))}
                className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${form.is_sold_out ? "bg-brand-red" : "bg-neutral-200"}`}
              >
                <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${form.is_sold_out ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}
                className="flex-1 py-3 border border-neutral-200 text-neutral-600 rounded-xl text-sm font-bold"
              >
                Cancel
              </button>
              <button
                onClick={addItem}
                disabled={formSaving || !form.name.trim() || !form.price || photoUploading}
                className="flex-1 py-3 bg-brand-red text-white rounded-xl text-sm font-bold disabled:opacity-40"
              >
                {formSaving ? "Adding..." : "Add to Menu"}
              </button>
            </div>
          </div>
        )}

        {/* Items list */}
        {items.length === 0 && !showAddForm ? (
          <div className="bg-white rounded-2xl shadow-sm flex flex-col items-center py-16 gap-3">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <p className="text-neutral-500 font-semibold">No menu items yet</p>
            <p className="text-neutral-400 text-sm text-center px-8">
              Tap &quot;Add Item&quot; above to start building your menu.
            </p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden flex items-stretch gap-0 transition-opacity ${item.is_sold_out ? "opacity-60" : ""}`}
            >
              {/* Photo thumbnail */}
              <div className="w-20 h-20 flex-shrink-0 bg-neutral-100 relative self-center ml-3 rounded-xl overflow-hidden">
                {item.photo ? (
                  <Image src={item.photo} alt={item.name} fill sizes="80px" className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
                    </svg>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 px-3 py-3 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-neutral-900 text-sm truncate">{item.name}</p>
                    <p className="text-sm font-black text-brand-red">${(item.price ?? 0).toFixed(2)}</p>
                  </div>
                  {/* Up/Down arrows */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => moveItem(index, "up")}
                      disabled={index === 0}
                      className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 disabled:opacity-30 hover:bg-neutral-200 transition-colors"
                      aria-label="Move up"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="18 15 12 9 6 15" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveItem(index, "down")}
                      disabled={index === items.length - 1}
                      className="w-6 h-6 rounded-lg bg-neutral-100 flex items-center justify-center text-neutral-400 disabled:opacity-30 hover:bg-neutral-200 transition-colors"
                      aria-label="Move down"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {item.is_sold_out && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full">SOLD OUT</span>
                  )}
                  {item.allergens?.length > 0 && (
                    <span className="text-[10px] text-neutral-400">{item.allergens.join(", ")}</span>
                  )}
                </div>

                {/* Actions row */}
                <div className="flex items-center gap-2 mt-2">
                  {/* Sold out toggle */}
                  <button
                    onClick={() => toggleSoldOut(item)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      item.is_sold_out
                        ? "bg-neutral-100 text-neutral-600"
                        : "bg-orange-50 text-orange-600"
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full border-2 inline-flex items-center justify-center flex-shrink-0 ${item.is_sold_out ? "border-neutral-400 bg-neutral-400" : "border-orange-400"}`}>
                      {item.is_sold_out && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      )}
                    </span>
                    {item.is_sold_out ? "Undo Sold Out" : "Mark Sold Out"}
                  </button>

                  {/* Delete (2-tap) */}
                  <button
                    onClick={() => deleteItem(item.id)}
                    onBlur={() => { if (deletingId === item.id) setDeletingId(null); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      deletingId === item.id
                        ? "bg-red-600 text-white"
                        : "bg-neutral-100 text-neutral-500 hover:bg-red-50 hover:text-red-500"
                    }`}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" />
                    </svg>
                    {deletingId === item.id ? "Confirm Delete" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
