"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const ALLERGENS = ["Gluten", "Dairy", "Nuts", "Eggs", "Soy", "Shellfish", "Fish"];

const EMPTY_ITEM = {
  name: "",
  description: "",
  price: "",
  category: "",
  allergens: [] as string[],
  is_sold_out: false,
  is_popular: false,
  photo: "",
};

export default function MenuPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMenu();
  }, []);

  async function loadMenu() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: truck } = await supabase
      .from("trucks")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!truck) return;
    setTruckId(truck.id);

    const { data } = await supabase
      .from("menu_items")
      .select("*")
      .eq("truck_id", truck.id)
      .order("created_at", { ascending: true });

    setItems(data ?? []);
    setLoading(false);
  }

  async function uploadPhoto(file: File): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = "menu/" + Date.now() + "." + ext;

    await supabase.storage
      .from("menu-photos")
      .upload(path, file, { upsert: true });

    const { data } = supabase.storage
      .from("menu-photos")
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadPhoto(file);
      setForm({ ...form, photo: url });
    } catch {
      alert("Photo upload failed");
    }
    setUploading(false);
  }

  function openAdd() {
    setForm(EMPTY_ITEM);
    setEditing(null);
    setIsAdding(true);
  }

  function openEdit(item: any) {
    setForm({
      name: item.name,
      description: item.description ?? "",
      price: String(item.price),
      category: item.category ?? "",
      allergens: item.allergens ?? [],
      is_sold_out: item.is_sold_out,
      is_popular: item.is_popular ?? false,
      photo: item.photo ?? "",
    });
    setEditing(item);
    setIsAdding(true);
  }

  function toggleAllergen(tag: string) {
    const next = form.allergens.includes(tag)
      ? form.allergens.filter((a: string) => a !== tag)
      : [...form.allergens, tag];
    setForm({ ...form, allergens: next });
  }

  async function saveItem() {
    if (!truckId || !form.name || !form.price) return;
    setSaving(true);

    const supabase = createClient();
    const payload = {
      truck_id: truckId,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category || "Other",
      allergens: form.allergens,
      is_sold_out: form.is_sold_out,
      is_popular: form.is_popular,
      photo: form.photo,
    };

    if (editing) {
      await supabase
        .from("menu_items")
        .update(payload)
        .eq("id", editing.id);
    } else {
      await supabase.from("menu_items").insert(payload);
    }

    setSaving(false);
    setIsAdding(false);
    setEditing(null);
    loadMenu();
  }

  async function deleteItem(id: string) {
    if (!confirm("Delete this item?")) return;
    const supabase = createClient();
    await supabase.from("menu_items").delete().eq("id", id);
    setItems(items.filter((i) => i.id !== id));
  }

  async function toggleSoldOut(item: any) {
    const supabase = createClient();
    await supabase
      .from("menu_items")
      .update({ is_sold_out: !item.is_sold_out })
      .eq("id", item.id);
    setItems(items.map((i) =>
      i.id === item.id ? { ...i, is_sold_out: !i.is_sold_out } : i
    ));
  }

  // Group items by category
  const grouped = items.reduce((acc: Record<string, any[]>, item) => {
    const cat = item.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <p className="text-neutral-400">Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="w-8 h-8 rounded-full border border-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white hover:border-neutral-500 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </a>
          <span className="text-neutral-400 text-sm font-medium">Menu Manager</span>
        </div>
      </nav>

      {/* Header */}
      <div className="bg-white px-6 py-5 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-neutral-900 uppercase tracking-wide">
              Menu Manager
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold hover:bg-brand-red-dark transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Item
          </button>
        </div>
      </div>

      {/* Menu List */}
      <div className="px-4 py-6 max-w-2xl mx-auto">
        {items.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                <line x1="6" y1="1" x2="6" y2="4"/>
                <line x1="10" y1="1" x2="10" y2="4"/>
                <line x1="14" y1="1" x2="14" y2="4"/>
              </svg>
            </div>
            <p className="text-neutral-500 font-semibold">No menu items yet</p>
            <p className="text-neutral-400 text-sm mt-1 mb-4">
              Add your first item to get started
            </p>
            <button
              onClick={openAdd}
              className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-bold"
            >
              Add First Item
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([category, categoryItems]) => (
            <div key={category} className="mb-6">

              {/* Category Header */}
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest">
                  {category}
                </h2>
                <div className="flex-1 h-px bg-neutral-200" />
                <span className="text-xs text-neutral-400">
                  {categoryItems.length} item{categoryItems.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Items */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {categoryItems.map((item, index) => (
                  <div
                    key={item.id}
                    className={`flex gap-3 p-4 ${
                      index !== categoryItems.length - 1
                        ? "border-b border-neutral-100"
                        : ""
                    } ${item.is_sold_out ? "opacity-50" : ""}`}
                  >
                    {/* Photo */}
                    <div className="w-20 h-20 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                      {item.photo ? (
                        <img
                          src={item.photo}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <path d="M21 15l-5-5L5 21"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`font-black text-neutral-900 text-sm uppercase tracking-wide ${
                            item.is_sold_out ? "line-through" : ""
                          }`}>
                            {item.name}
                          </p>
                          {item.is_popular && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-brand-red rounded-full border border-red-200">
                              POPULAR
                            </span>
                          )}
                        </div>
                        <p className="text-brand-red font-black flex-shrink-0">
                          ${parseFloat(item.price).toFixed(2)}
                        </p>
                      </div>

                      {item.description && (
                        <p className="text-neutral-400 text-xs mt-0.5 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Allergens */}
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

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-2.5">
                        <button
                          onClick={() => toggleSoldOut(item)}
                          className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                            item.is_sold_out
                              ? "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                              : "bg-red-50 text-brand-red hover:bg-red-100"
                          }`}
                        >
                          {item.is_sold_out ? "Mark Available" : "Mark Sold Out"}
                        </button>
                        <button
                          onClick={() => openEdit(item)}
                          className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-xs text-red-300 hover:text-red-500 font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-black text-neutral-900 uppercase tracking-wide">
                {editing ? "Edit Item" : "New Item"}
              </h2>
              <button
                onClick={() => setIsAdding(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Photo Upload */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Photo
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-40 rounded-2xl overflow-hidden cursor-pointer relative bg-neutral-100 border-2 border-dashed border-neutral-200 hover:border-brand-red transition-colors"
                >
                  {form.photo ? (
                    <img
                      src={form.photo}
                      alt="preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                      <p className="text-sm text-neutral-400 font-medium">
                        {uploading ? "Uploading..." : "Tap to add photo"}
                      </p>
                    </div>
                  )}
                  {form.photo && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <p className="text-white text-sm font-bold">Change Photo</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Item Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Al Pastor Taco"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Marinated pork, pineapple, onion, cilantro..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors resize-none"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                    Price *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">
                      $
                    </span>
                    <input
                      type="number"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                      className="w-full pl-7 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                    Category
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Tacos, Sides..."
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                  />
                </div>
              </div>

              {/* Allergens */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Allergens
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALLERGENS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleAllergen(tag)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                        form.allergens.includes(tag)
                          ? "bg-orange-50 border-orange-400 text-orange-600"
                          : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-0 border border-neutral-200 rounded-2xl overflow-hidden">

                {/* Popular Toggle */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-neutral-100">
                  <div>
                    <p className="text-sm font-bold text-neutral-800">Mark as Popular</p>
                    <p className="text-xs text-neutral-400">Shows a Popular badge</p>
                  </div>
                  <button
                    onClick={() => setForm({ ...form, is_popular: !form.is_popular })}
                    className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      form.is_popular ? "bg-brand-red" : "bg-neutral-200"
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      form.is_popular ? "translate-x-6" : "translate-x-0"
                    }`} />
                  </button>
                </div>

                {/* Sold Out Toggle */}
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div>
                    <p className="text-sm font-bold text-neutral-800">Mark as Sold Out</p>
                    <p className="text-xs text-neutral-400">Item greyed out on menu</p>
                  </div>
                  <button
                    onClick={() => setForm({ ...form, is_sold_out: !form.is_sold_out })}
                    className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                      form.is_sold_out ? "bg-brand-red" : "bg-neutral-200"
                    }`}
                  >
                    <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                      form.is_sold_out ? "translate-x-6" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={saveItem}
                disabled={saving || !form.name || !form.price}
                className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-red-dark transition-colors mb-2"
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Add to Menu"}
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}