"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const CUISINE_TYPES = [
  "Tacos", "BBQ", "Burgers", "Asian Fusion", "Desserts",
  "Pizza", "Sandwiches", "Healthy", "Breakfast", "Seafood",
  "Mediterranean", "Vegan", "Halal", "Other",
];

type Profile = {
  name: string;
  description: string;
  cuisine: string;
  phone: string;
  instagram: string;
  profile_photo: string;
};

const EMPTY_PROFILE: Profile = {
  name: "",
  description: "",
  cuisine: "",
  phone: "",
  instagram: "",
  profile_photo: "",
};

export default function ProfilePage() {
  const [form, setForm] = useState<Profile>(EMPTY_PROFILE);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);

    const { data: truck } = await supabase
      .from("trucks")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (truck) {
      setTruckId(truck.id);
      setForm({
        name: truck.name ?? "",
        description: truck.description ?? "",
        cuisine: truck.cuisine ?? "",
        phone: truck.phone ?? "",
        instagram: truck.instagram ?? "",
        profile_photo: truck.profile_photo ?? "",
      });
    }
    // Always clear loading — even when no truck found
    setLoading(false);
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop();
      const path = `trucks/${Date.now()}.${ext}`;

      await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      const { data } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      setForm((prev) => ({ ...prev, profile_photo: data.publicUrl }));
    } catch {
      alert("Photo upload failed. Check your storage bucket settings.");
    }

    setUploading(false);
  }

  async function saveProfile() {
    if (!form.name.trim() || !userId) return;
    setSaving(true);

    const supabase = createClient();

    if (truckId) {
      // Update existing truck
      await supabase
        .from("trucks")
        .update({
          name: form.name.trim(),
          description: form.description,
          cuisine: form.cuisine,
          phone: form.phone,
          instagram: form.instagram,
          profile_photo: form.profile_photo,
        })
        .eq("id", truckId);
    } else {
      // Create truck for the first time
      const { data: newTruck } = await supabase
        .from("trucks")
        .insert({
          owner_id: userId,
          name: form.name.trim(),
          description: form.description,
          cuisine: form.cuisine,
          phone: form.phone,
          instagram: form.instagram,
          profile_photo: form.profile_photo,
          is_live: false,
        })
        .select("id")
        .single();

      if (newTruck) setTruckId(newTruck.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-400 text-sm">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </a>
          <div>
            <h1 className="text-lg font-bold text-neutral-800">Truck Profile</h1>
            <p className="text-sm text-neutral-400">
              {truckId ? "What customers see on the map" : "Set up your truck to get started"}
            </p>
          </div>
        </div>
        <button
          onClick={saveProfile}
          disabled={saving || !form.name.trim()}
          className="px-4 py-2 bg-brand-red text-white rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : truckId ? "Save" : "Create Truck"}
        </button>
      </div>

      {/* First-time setup banner */}
      {!truckId && (
        <div className="bg-brand-red/10 border-b border-brand-red/20 px-4 py-3 flex items-center gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-sm text-brand-red font-medium">
            Fill in your truck name and hit <strong>Create Truck</strong> to get started. You can update everything later.
          </p>
        </div>
      )}

      <div className="p-4 flex flex-col gap-5 max-w-lg mx-auto">

        {/* Profile Photo */}
        <div className="flex flex-col items-center py-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="w-28 h-28 rounded-full bg-neutral-100 overflow-hidden cursor-pointer relative mb-3 border-4 border-white shadow-md"
          >
            {form.profile_photo ? (
              <img
                src={form.profile_photo}
                alt="Truck"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-neutral-200">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M1 3h15v13H1z"/>
                  <path d="M16 8h4l3 3v5h-7V8z"/>
                  <circle cx="5.5" cy="18.5" r="2.5"/>
                  <circle cx="18.5" cy="18.5" r="2.5"/>
                </svg>
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-full">
              <span className="text-white text-xs font-semibold">Change</span>
            </div>
          </div>
          <p className="text-sm text-neutral-400">
            {uploading ? "Uploading..." : "Tap to add truck photo"}
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Truck Name */}
        <div>
          <label className="text-sm font-semibold text-neutral-700">
            Truck Name <span className="text-brand-red">*</span>
          </label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. The Taco Truck"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none focus:border-brand-red bg-white"
          />
        </div>

        {/* Cuisine Type */}
        <div>
          <label className="text-sm font-semibold text-neutral-700">
            Cuisine Type
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CUISINE_TYPES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, cuisine: form.cuisine === c ? "" : c })}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  form.cuisine === c
                    ? "bg-brand-red text-white border-brand-red"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-sm font-semibold text-neutral-700">
            Description
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, 200) })}
            placeholder="Tell customers what makes your truck special..."
            rows={3}
            maxLength={200}
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none focus:border-brand-red resize-none bg-white"
          />
          <p className={`text-xs mt-1 ${form.description.length >= 190 ? "text-brand-red" : "text-neutral-400"}`}>
            {form.description.length}/200 characters
          </p>
        </div>

        {/* Phone */}
        <div>
          <label className="text-sm font-semibold text-neutral-700">
            Phone Number
          </label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="(201) 555-0123"
            type="tel"
            className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 focus:outline-none focus:border-brand-red bg-white"
          />
        </div>

        {/* Instagram */}
        <div>
          <label className="text-sm font-semibold text-neutral-700">
            Instagram
          </label>
          <div className="relative mt-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">
              @
            </span>
            <input
              value={form.instagram}
              onChange={(e) => setForm({ ...form, instagram: e.target.value.replace("@", "") })}
              placeholder="yourtruck"
              className="w-full pl-9 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"
            />
          </div>
        </div>

        {/* Live Preview */}
        {(form.name || form.cuisine || form.description) && (
          <div>
            <p className="text-sm font-semibold text-neutral-700 mb-2">Preview</p>
            <div className="bg-white rounded-2xl shadow-sm p-4 flex gap-3">
              <div className="w-14 h-14 rounded-full bg-neutral-100 overflow-hidden flex-shrink-0">
                {form.profile_photo ? (
                  <img src={form.profile_photo} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-100">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M1 3h15v13H1z"/>
                      <path d="M16 8h4l3 3v5h-7V8z"/>
                      <circle cx="5.5" cy="18.5" r="2.5"/>
                      <circle cx="18.5" cy="18.5" r="2.5"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-neutral-800 truncate">{form.name || "Your Truck Name"}</p>
                <p className="text-xs text-brand-red font-medium">{form.cuisine || "Cuisine Type"}</p>
                {form.description && (
                  <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{form.description}</p>
                )}
                <div className="flex gap-3 mt-1">
                  {form.phone && <span className="text-xs text-neutral-400">{form.phone}</span>}
                  {form.instagram && <span className="text-xs text-neutral-400">@{form.instagram}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={saveProfile}
          disabled={saving || !form.name.trim()}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40 mb-8 transition-opacity"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : truckId ? "Save Profile" : "Create My Truck"}
        </button>

      </div>
    </div>
  );
}
