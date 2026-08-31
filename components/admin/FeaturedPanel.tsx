"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PanelHeader, PanelState, useAdminSection } from "./shared";

type FeaturedData = {
  trucks: { id: string; name: string; cuisine: string | null }[];
  featured_truck_id: string;
  featured_message: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Drives the homepage's featured-truck banner via site_settings. */
export default function FeaturedPanel({ refreshToken }: { refreshToken: number }) {
  const { data, loading, error, reload } = useAdminSection<FeaturedData>("featured", refreshToken);
  const [truckId, setTruckId] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  // Seed the form from whatever is currently live once the fetch lands.
  useEffect(() => {
    if (!data) return;
    setTruckId(data.featured_truck_id);
    setMessage(data.featured_message);
  }, [data]);

  const trucks = data?.trucks ?? [];

  async function save() {
    if (saving) return;
    const trimmed = truckId.trim();
    if (trimmed && !UUID_RE.test(trimmed)) {
      setSaveError("Invalid truck ID — pick a truck from the list.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/save-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured_truck_id: trimmed || null, featured_message: message }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Failed to save settings");
      }
      if (!mountedRef.current) return;
      setSaved(true);
      savedTimer.current = setTimeout(() => {
        if (mountedRef.current) setSaved(false);
      }, 3000);
    } catch (err: any) {
      if (mountedRef.current) setSaveError(err?.message ?? "Failed to save. Please try again.");
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-lg">
      <PanelHeader title="Truck of the Week" />

      <PanelState loading={loading} error={error} empty={false} emptyLabel="" onRetry={reload} />

      {!loading && !error && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
              Select Truck
            </label>
            <select
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 focus:outline-none focus:border-brand-red bg-white"
            >
              <option value="">— None (clear featured truck) —</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.cuisine ? ` · ${t.cuisine}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider block mb-1.5">
              Featured Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="e.g. This week's must-try truck!"
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm text-neutral-800 placeholder-neutral-300 focus:outline-none focus:border-brand-red resize-none"
            />
          </div>

          {saveError && <p className="text-xs text-red-500 font-semibold">{saveError}</p>}

          {saved ? (
            <div className="flex items-center gap-2 py-3 px-4 bg-green-50 rounded-xl">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p className="text-sm font-semibold text-green-700">Saved! Homepage banner updated.</p>
            </div>
          ) : (
            <button
              onClick={save}
              disabled={saving}
              className="py-2.5 bg-brand-red text-white rounded-xl font-black text-sm uppercase tracking-wide disabled:opacity-40 hover:bg-red-600 transition-colors active:scale-95"
            >
              {saving ? "Saving..." : "Save Truck of the Week"}
            </button>
          )}

          {truckId && (
            <div className="bg-neutral-50 rounded-xl p-4 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div>
                <p className="text-sm font-semibold text-neutral-700">Currently featured</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {trucks.find((t) => t.id === truckId)?.name ?? truckId}
                  {message && ` — "${message}"`}
                </p>
                <Link href="/" target="_blank" rel="noopener noreferrer" className="text-xs text-brand-red font-semibold mt-1 inline-block hover:underline">
                  Preview homepage →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
