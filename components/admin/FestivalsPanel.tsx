"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { US_STATES } from "@/lib/us-states";
import type { Festival } from "@/lib/types";
import { PanelHeader } from "./shared";

/**
 * City/state food-truck events shown at /events. Reads and writes go through
 * /api/admin/festivals (service role) — the table is public-read but
 * client-write-blocked by RLS.
 */
export default function FestivalsPanel({ refreshToken }: { refreshToken: number }) {
  const mountedRef = useRef(true);
  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/festivals", { cache: "no-store" });
      if (!mountedRef.current) return;
      if (res.ok) {
        const json = await res.json();
        setFestivals(json.festivals ?? []);
      }
    } catch {
      // Network blip — keep showing the last loaded list
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshToken]);

  function resetForm() {
    setEditingId(null);
    setName(""); setStateCode(""); setCity(""); setVenue("");
    setDescription(""); setStartDate(""); setEndDate("");
    setWebsiteUrl(""); setImageUrl("");
    setError(null);
  }

  function startEdit(f: Festival) {
    setEditingId(f.id);
    setName(f.name);
    setStateCode(f.state_code);
    setCity(f.city);
    setVenue(f.venue ?? "");
    setDescription(f.description ?? "");
    setStartDate(f.start_date);
    setEndDate(f.end_date);
    setWebsiteUrl(f.website_url ?? "");
    setImageUrl(f.image_url ?? "");
    setError(null);
  }

  async function save() {
    if (saving) return;
    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    if (!trimmedName) return setError("Festival name is required.");
    if (!stateCode) return setError("Select a state.");
    if (!trimmedCity) return setError("City is required.");
    if (!startDate || !endDate) return setError("Start and end dates are required.");
    if (endDate < startDate) return setError("End date must be on or after the start date.");

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/festivals", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingId ? { id: editingId } : {}),
          name: trimmedName,
          state_code: stateCode,
          city: trimmedCity,
          venue: venue.trim() || null,
          description: description.trim() || null,
          start_date: startDate,
          end_date: endDate,
          website_url: websiteUrl.trim() || null,
          image_url: imageUrl.trim() || null,
        }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to save festival");
      }
      await load();
      if (!mountedRef.current) return;
      resetForm();
      setSaved(true);
      savedTimer.current = setTimeout(() => {
        if (mountedRef.current) setSaved(false);
      }, 3000);
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to save. Please try again.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this festival? This can't be undone.")) return;
    try {
      const res = await fetch(`/api/admin/festivals?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to delete festival");
      }
      if (mountedRef.current) {
        setFestivals((prev) => prev.filter((f) => f.id !== id));
        if (editingId === id) resetForm();
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to delete. Please try again.");
    }
  }

  const todayISO = new Date().toISOString().split("T")[0];
  const visible = showAll ? festivals : festivals.filter((f) => f.end_date >= todayISO);

  const inputClass =
    "w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red";
  const labelClass =
    "text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5";

  return (
    <div className="p-6">
      <PanelHeader title={editingId ? "Edit festival" : "Add festival"} />

      <div className="flex flex-col gap-4 max-w-lg mb-8">
        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            maxLength={200} placeholder="e.g. Newark Food Truck Fest" className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>State</label>
            <select
              value={stateCode} onChange={(e) => setStateCode(e.target.value)}
              className={`${inputClass} bg-white`}
            >
              <option value="">Select state…</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>City</label>
            <input
              type="text" value={city} onChange={(e) => setCity(e.target.value)}
              maxLength={100} placeholder="e.g. Newark" className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Venue / Address <span className="normal-case text-neutral-300">(optional)</span>
          </label>
          <input
            type="text" value={venue} onChange={(e) => setVenue(e.target.value)}
            maxLength={200} placeholder="e.g. Military Park" className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>End Date</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            Description <span className="normal-case text-neutral-300">(optional)</span>
          </label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            rows={3} maxLength={2000}
            placeholder="A short description shown on the event listing"
            className={`${inputClass} resize-none`}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>
              Website <span className="normal-case text-neutral-300">(optional)</span>
            </label>
            <input
              type="text" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://…" className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>
              Image URL <span className="normal-case text-neutral-300">(optional)</span>
            </label>
            <input
              type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…" className={inputClass}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        {saved ? (
          <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-xl">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p className="text-sm font-semibold text-green-700">Saved!</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="py-2.5 px-5 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-40 hover:bg-red-600 transition-colors active:scale-95"
            >
              {saving ? "Saving..." : editingId ? "Save Changes" : "Add Festival"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="py-2.5 px-4 text-neutral-500 rounded-xl font-bold text-sm hover:text-neutral-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-black text-neutral-500 uppercase tracking-widest">All Festivals</p>
        <label className="flex items-center gap-2 text-xs font-semibold text-neutral-500">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Show past events
        </label>
      </div>

      <div className="divide-y divide-neutral-50 border border-neutral-100 rounded-xl overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="py-10 text-center text-sm text-neutral-400">
            No {showAll ? "" : "upcoming "}festivals yet — add one above.
          </div>
        ) : (
          visible.map((f) => (
            <div key={f.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-neutral-50 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-800 truncate">{f.name}</p>
                <p className="text-xs text-neutral-400">
                  {f.city}, {f.state_code} ·{" "}
                  {new Date(f.start_date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}
                  {f.end_date !== f.start_date && (
                    <> – {new Date(f.end_date + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric" })}</>
                  )}
                </p>
              </div>
              <button onClick={() => startEdit(f)} className="text-xs text-brand-red font-bold hover:underline flex-shrink-0">
                Edit
              </button>
              <button onClick={() => remove(f.id)} className="text-xs text-neutral-400 font-bold hover:text-red-500 transition-colors flex-shrink-0">
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
