"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const EMPTY_PACKAGE = {
  name: "",
  description: "",
  price_per_person: "",
  minimum_guests: "20",
  maximum_guests: "500",
  includes: [] as string[],
  photo: "",
  is_active: true,
};

export default function CateringPackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_PACKAGE);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [includeInput, setIncludeInput] = useState("");
  const [cateringInfo, setCateringInfo] = useState({
    catering_description: "",
    catering_starting_price: "",
    catering_min_guests: "20",
  });
  const [savingInfo, setSavingInfo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: truck } = await supabase
      .from("trucks")
      .select("id, catering_description, catering_starting_price, catering_min_guests")
      .eq("owner_id", user.id)
      .single();

    if (!truck) return;
    setTruckId(truck.id);
    setCateringInfo({
      catering_description: truck.catering_description ?? "",
      catering_starting_price: truck.catering_starting_price
        ? String(truck.catering_starting_price)
        : "",
      catering_min_guests: truck.catering_min_guests
        ? String(truck.catering_min_guests)
        : "20",
    });

    const { data } = await supabase
      .from("catering_packages")
      .select("*")
      .eq("truck_id", truck.id)
      .order("created_at", { ascending: true });

    setPackages(data ?? []);
    setLoading(false);
  }

  async function saveCateringInfo() {
    if (!truckId) return;
    setSavingInfo(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("trucks")
      .update({
        catering_description: cateringInfo.catering_description,
        catering_starting_price: cateringInfo.catering_starting_price
          ? parseFloat(cateringInfo.catering_starting_price)
          : null,
        catering_min_guests: cateringInfo.catering_min_guests
          ? parseInt(cateringInfo.catering_min_guests)
          : null,
      })
      .eq("id", truckId);
    if (error) showToast("Save failed: " + error.message);
    setSavingInfo(false);
  }

  async function uploadPhoto(file: File): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = "catering/" + Date.now() + "." + ext;
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
      showToast("Photo upload failed");
    }
    setUploading(false);
  }

  function addInclude() {
    if (!includeInput.trim()) return;
    setForm({
      ...form,
      includes: [...form.includes, includeInput.trim()],
    });
    setIncludeInput("");
  }

  function removeInclude(index: number) {
    setForm({
      ...form,
      includes: form.includes.filter((_, i) => i !== index),
    });
  }

  function openAdd() {
    setForm(EMPTY_PACKAGE);
    setEditing(null);
    setIsAdding(true);
  }

  function openEdit(pkg: any) {
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      price_per_person: String(pkg.price_per_person),
      minimum_guests: String(pkg.minimum_guests),
      maximum_guests: String(pkg.maximum_guests),
      includes: pkg.includes ?? [],
      photo: pkg.photo ?? "",
      is_active: pkg.is_active,
    });
    setEditing(pkg);
    setIsAdding(true);
  }

  async function savePackage() {
    if (!truckId || !form.name || !form.price_per_person) return;
    setSaving(true);

    const supabase = createClient();
    const payload = {
      truck_id: truckId,
      name: form.name,
      description: form.description,
      price_per_person: parseFloat(form.price_per_person),
      minimum_guests: parseInt(form.minimum_guests),
      maximum_guests: parseInt(form.maximum_guests),
      includes: form.includes,
      photo: form.photo,
      is_active: form.is_active,
    };

    let error;
    if (editing) {
      ({ error } = await supabase
        .from("catering_packages")
        .update(payload)
        .eq("id", editing.id));
    } else {
      ({ error } = await supabase.from("catering_packages").insert(payload));
    }

    setSaving(false);
    if (error) { showToast("Save failed: " + error.message); return; }
    setIsAdding(false);
    setEditing(null);
    loadPackages();
  }

  async function deletePackage(id: string) {
    if (deletingId !== id) { setDeletingId(id); return; }
    setDeletingId(null);
    const supabase = createClient();
    const { error } = await supabase.from("catering_packages").delete().eq("id", id);
    if (!error) setPackages(packages.filter((p) => p.id !== id));
    else showToast("Delete failed: " + error.message);
  }

  async function toggleActive(pkg: any) {
    const supabase = createClient();
    const { error } = await supabase
      .from("catering_packages")
      .update({ is_active: !pkg.is_active })
      .eq("id", pkg.id);
    if (!error) setPackages(packages.map((p) =>
      p.id === pkg.id ? { ...p, is_active: !p.is_active } : p
    ));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
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
        <Link
          href="/dashboard/catering"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to requests
        </Link>
      </nav>

      {/* Header */}
      <div className="bg-white px-6 py-5 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-neutral-900 uppercase tracking-wide">
              Catering Packages
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">
              {packages.length} package{packages.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-red text-white rounded-full text-sm font-black uppercase tracking-wide hover:bg-brand-red-dark transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Add Package
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-6">

        {/* Catering Info */}
        <div>
          <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
            Catering Info
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-100">
              <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                Catering Description
              </label>
              <textarea
                value={cateringInfo.catering_description}
                onChange={(e) => setCateringInfo({
                  ...cateringInfo,
                  catering_description: e.target.value
                })}
                placeholder="Describe your catering service..."
                rows={3}
                className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-0">
              <div className="p-4 border-r border-neutral-100">
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Starting Price/Person
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-neutral-400 text-sm font-bold">$</span>
                  <input
                    type="number"
                    value={cateringInfo.catering_starting_price}
                    onChange={(e) => setCateringInfo({
                      ...cateringInfo,
                      catering_starting_price: e.target.value
                    })}
                    placeholder="0.00"
                    className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300"
                  />
                </div>
              </div>
              <div className="p-4">
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Min Guests
                </label>
                <input
                  type="number"
                  value={cateringInfo.catering_min_guests}
                  onChange={(e) => setCateringInfo({
                    ...cateringInfo,
                    catering_min_guests: e.target.value
                  })}
                  placeholder="20"
                  className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300"
                />
              </div>
            </div>
            <div className="p-4 border-t border-neutral-100">
              <button
                onClick={saveCateringInfo}
                disabled={savingInfo}
                className="w-full py-3 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-40 hover:bg-brand-red-dark transition-colors"
              >
                {savingInfo ? "Saving..." : "Save Catering Info"}
              </button>
            </div>
          </div>
        </div>

        {/* Packages List */}
        <div>
          <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
            Your Packages
          </h2>

          {packages.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
              <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/>
                </svg>
              </div>
              <p className="text-neutral-500 font-semibold">No packages yet</p>
              <p className="text-neutral-400 text-xs mt-1 mb-4">
                Create packages to show customers what you offer
              </p>
              <button
                onClick={openAdd}
                className="px-5 py-2.5 bg-brand-red text-white rounded-full text-sm font-black uppercase tracking-wide"
              >
                Create First Package
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`bg-white rounded-2xl shadow-sm overflow-hidden ${
                    !pkg.is_active ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex gap-3 p-4">

                    {/* Photo */}
                    <div className="w-20 h-20 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden relative">
                      {pkg.photo ? (
                        <Image src={pkg.photo} alt={pkg.name} fill className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-neutral-900 uppercase tracking-wide text-sm">
                            {pkg.name}
                          </p>
                          {!pkg.is_active && (
                            <span className="text-[10px] font-black text-neutral-400 uppercase">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="text-brand-red font-black text-lg flex-shrink-0">
                          ${pkg.price_per_person}
                          <span className="text-xs font-normal text-neutral-400">/person</span>
                        </p>
                      </div>

                      {pkg.description && (
                        <p className="text-xs text-neutral-400 mt-0.5 line-clamp-2">
                          {pkg.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-neutral-400 mt-1.5">
                        <span>Min {pkg.minimum_guests} guests</span>
                        <span>·</span>
                        <span>Max {pkg.maximum_guests} guests</span>
                      </div>

                      {pkg.includes?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {pkg.includes.map((item: string) => (
                            <span
                              key={item}
                              className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-500 rounded-full"
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-3 mt-2.5">
                        <button
                          onClick={() => toggleActive(pkg)}
                          className={`text-xs font-bold px-3 py-1 rounded-full transition-colors ${
                            pkg.is_active
                              ? "bg-red-50 text-brand-red hover:bg-red-100"
                              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                          }`}
                        >
                          {pkg.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => openEdit(pkg)}
                          className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold"
                        >
                          Edit
                        </button>
                        {deletingId === pkg.id ? (
                          <>
                            <button onClick={() => setDeletingId(null)} className="text-xs text-neutral-400 font-semibold">Cancel</button>
                            <button onClick={() => deletePackage(pkg.id)} className="text-xs text-red-500 font-bold">Confirm</button>
                          </>
                        ) : (
                          <button onClick={() => deletePackage(pkg.id)} className="text-xs text-red-300 hover:text-red-500 font-semibold">Delete</button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] overflow-y-auto">

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 sticky top-0 bg-white z-10">
              <h2 className="text-lg font-black text-neutral-900 uppercase tracking-wide">
                {editing ? "Edit Package" : "New Package"}
              </h2>
              <button
                onClick={() => setIsAdding(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-5">

              {/* Photo */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Package Photo
                </label>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-36 rounded-2xl overflow-hidden cursor-pointer bg-neutral-100 border-2 border-dashed border-neutral-200 hover:border-brand-red transition-colors flex items-center justify-center relative"
                >
                  {form.photo ? (
                    <Image src={form.photo} alt="preview" fill className="object-cover" />
                  ) : (
                    <div className="text-center">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round" className="mx-auto mb-2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                      <p className="text-sm text-neutral-400">
                        {uploading ? "Uploading..." : "Tap to add photo"}
                      </p>
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
                  Package Name *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Classic Taco Package"
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
                  placeholder="What's included in this package..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors resize-none"
                />
              </div>

              {/* Price + Guests */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                    Price/Person *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-sm">$</span>
                    <input
                      type="number"
                      value={form.price_per_person}
                      onChange={(e) => setForm({ ...form, price_per_person: e.target.value })}
                      placeholder="0.00"
                      step="0.01"
                      className="w-full pl-7 pr-3 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                    Min Guests
                  </label>
                  <input
                    type="number"
                    value={form.minimum_guests}
                    onChange={(e) => setForm({ ...form, minimum_guests: e.target.value })}
                    placeholder="20"
                    className="w-full px-3 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                    Max Guests
                  </label>
                  <input
                    type="number"
                    value={form.maximum_guests}
                    onChange={(e) => setForm({ ...form, maximum_guests: e.target.value })}
                    placeholder="500"
                    className="w-full px-3 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                  />
                </div>
              </div>

              {/* Includes */}
              <div>
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  What's Included
                </label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={includeInput}
                    onChange={(e) => setIncludeInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addInclude()}
                    placeholder="e.g. Tacos, Drinks, Setup..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                  />
                  <button
                    onClick={addInclude}
                    className="px-4 py-2.5 bg-brand-red text-white rounded-xl font-bold text-sm hover:bg-brand-red-dark transition-colors"
                  >
                    Add
                  </button>
                </div>
                {form.includes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.includes.map((item, index) => (
                      <span
                        key={index}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-neutral-100 text-neutral-600 rounded-full"
                      >
                        {item}
                        <button
                          onClick={() => removeInclude(index)}
                          className="text-neutral-400 hover:text-red-500 transition-colors"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between py-3 border border-neutral-200 rounded-2xl px-4">
                <div>
                  <p className="text-sm font-bold text-neutral-800">Active</p>
                  <p className="text-xs text-neutral-400">
                    Show this package to customers
                  </p>
                </div>
                <button
                  onClick={() => setForm({ ...form, is_active: !form.is_active })}
                  className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                    form.is_active ? "bg-brand-red" : "bg-neutral-200"
                  }`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${
                    form.is_active ? "translate-x-6" : "translate-x-0"
                  }`} />
                </button>
              </div>

              {/* Save */}
              <button
                onClick={savePackage}
                disabled={saving || !form.name || !form.price_per_person}
                className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base uppercase tracking-wide disabled:opacity-40 hover:bg-brand-red-dark transition-colors mb-2"
              >
                {saving ? "Saving..." : editing ? "Save Changes" : "Create Package"}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl bg-neutral-900 text-sm font-semibold text-white max-w-xs text-center pointer-events-none">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {toast}
        </div>
      )}
    </div>
  );
}