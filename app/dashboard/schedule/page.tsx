"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DaySchedule = { open: boolean; start: string; end: string; location: string };
type WeekSchedule = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", DaySchedule>;

const DAYS: { key: keyof WeekSchedule; label: string; short: string }[] = [
  { key: "mon", label: "Monday", short: "Mon" },
  { key: "tue", label: "Tuesday", short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday", short: "Thu" },
  { key: "fri", label: "Friday", short: "Fri" },
  { key: "sat", label: "Saturday", short: "Sat" },
  { key: "sun", label: "Sunday", short: "Sun" },
];

const DEFAULT_DAY: DaySchedule = { open: false, start: "10:00", end: "15:00", location: "" };

const DEFAULT_SCHEDULE: WeekSchedule = {
  mon: { ...DEFAULT_DAY },
  tue: { ...DEFAULT_DAY },
  wed: { ...DEFAULT_DAY },
  thu: { ...DEFAULT_DAY },
  fri: { ...DEFAULT_DAY },
  sat: { ...DEFAULT_DAY },
  sun: { ...DEFAULT_DAY },
};

function fmt12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function SchedulePage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [truckName, setTruckName] = useState<string>("");
  const [schedule, setSchedule] = useState<WeekSchedule>(DEFAULT_SCHEDULE);

  useEffect(() => {
    mountedRef.current = true;
    loadSchedule();
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

  async function loadSchedule() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data: { user }, error: authErr } = await supabase.auth.getUser();
      if (authErr || !user) { router.replace("/login"); return; }
      if (mountedRef.current) setUserId(user.id);

      const { data: truck, error: truckErr } = await supabase
        .from("trucks")
        .select("id, name, schedule")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (truckErr) throw new Error(truckErr.message);

      if (!mountedRef.current) return;

      if (truck) {
        setTruckId(truck.id);
        setTruckName(truck.name ?? "");
        if (truck.schedule && typeof truck.schedule === "object") {
          // Merge loaded schedule with defaults to ensure all days exist
          const loaded = truck.schedule as Partial<WeekSchedule>;
          const merged: WeekSchedule = { ...DEFAULT_SCHEDULE };
          for (const day of DAYS) {
            if (loaded[day.key]) {
              merged[day.key] = { ...DEFAULT_DAY, ...loaded[day.key] };
            }
          }
          setSchedule(merged);
        }
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? "Failed to load schedule");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  function updateDay<K extends keyof DaySchedule>(day: keyof WeekSchedule, field: K, value: DaySchedule[K]) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
    setSaved(false);
  }

  async function saveSchedule() {
    if (saving) return; // in-flight guard
    if (!truckId) {
      showToast("Save your truck profile first.", true);
      return;
    }
    // Validate close time is after open time — convert to minutes to avoid
    // lexicographic comparison bugs with single-digit hours (e.g. "9:00" vs "10:00")
    const timeToMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + (m || 0); };
    for (const { key, label } of DAYS) {
      const day = schedule[key];
      if (day.open && day.start && day.end && timeToMinutes(day.end) <= timeToMinutes(day.start)) {
        showToast(`${label}: closing time must be after opening time.`, true);
        return;
      }
    }
    setSaving(true);
    try {
      const supabase = createClient();
      // Re-fetch the user to avoid relying on potentially stale userId state
      const { data: { user: freshUser } } = await supabase.auth.getUser();
      if (!freshUser) { router.replace("/login"); return; }
      // Sanitize schedule before writing — trim and cap location strings
      const sanitized: WeekSchedule = { ...DEFAULT_SCHEDULE };
      for (const { key } of DAYS) {
        sanitized[key] = {
          ...schedule[key],
          location: schedule[key].location.trim().slice(0, 200),
        };
      }
      const { error: saveErr } = await supabase
        .from("trucks")
        .update({ schedule: sanitized })
        .eq("id", truckId)
        .eq("owner_id", freshUser.id);
      if (saveErr) throw new Error(saveErr.message);
      if (!mountedRef.current) return;
      setSaved(true);
      showToast("Schedule saved!", false);
    } catch (err: any) {
      if (mountedRef.current) showToast(err?.message ?? "Save failed — please try again.", true);
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-brand-red border-t-transparent animate-spin" />
        <p className="text-neutral-400 text-sm">Loading schedule...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 text-center">
      <div>
        <p className="font-bold text-neutral-800 mb-2">Could not load schedule</p>
        <p className="text-sm text-neutral-500 mb-4">{error}</p>
        <button
          onClick={() => { setLoading(true); loadSchedule(); }}
          className="px-5 py-2.5 bg-brand-red text-white rounded-xl font-semibold text-sm"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  const openDays = DAYS.filter((d) => schedule[d.key].open);

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
      <div className="bg-white border-b border-neutral-100 px-4 py-4">
        <h1 className="text-lg font-bold text-neutral-800">Weekly Schedule</h1>
        <p className="text-sm text-neutral-400">Set your hours for each day of the week</p>
      </div>

      <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto pb-24">

        {/* Day rows */}
        {DAYS.map(({ key, label }) => {
          const day = schedule[key];
          return (
            <div key={key} className={`bg-white rounded-2xl shadow-sm overflow-hidden transition-all ${day.open ? "" : "opacity-75"}`}>
              {/* Day header with toggle */}
              <div className="flex items-center justify-between px-4 py-4">
                <p className="font-bold text-neutral-800">{label}</p>
                <button
                  onClick={() => updateDay(key, "open", !day.open)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${day.open ? "bg-brand-red" : "bg-neutral-200"}`}
                  aria-label={`Toggle ${label}`}
                >
                  <span className={`block w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${day.open ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              {/* Expandable fields */}
              {day.open && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-neutral-50 pt-3">
                  {/* Hours row */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 mb-1">Open</label>
                      <input
                        type="time"
                        value={day.start}
                        onChange={(e) => updateDay(key, "start", e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 mb-1">Close</label>
                      <input
                        type="time"
                        value={day.end}
                        onChange={(e) => updateDay(key, "end", e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"
                      />
                    </div>
                  </div>
                  {/* Location */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 mb-1">Location</label>
                    <input
                      type="text"
                      value={day.location}
                      onChange={(e) => updateDay(key, "location", e.target.value)}
                      placeholder="e.g. Main St & 5th Ave, Newark NJ"
                      maxLength={200}
                      className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red bg-white"
                    />
                  </div>
                </div>
              )}

              {/* Closed badge */}
              {!day.open && (
                <div className="px-4 pb-3">
                  <span className="text-xs text-neutral-400 font-medium">Closed</span>
                </div>
              )}
            </div>
          );
        })}

        {/* Save button */}
        <button
          onClick={saveSchedule}
          disabled={saving}
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base disabled:opacity-40 transition-opacity sticky bottom-4 shadow-lg"
          style={{ boxShadow: saving ? undefined : "0 4px 24px rgba(232,72,28,0.3)" }}
        >
          {saving ? "Saving..." : saved ? "Schedule Saved ✓" : "Save Schedule"}
        </button>

        {/* Customer preview card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-brand-red flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <p className="text-sm font-bold text-neutral-800">Schedule visible to customers</p>
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            This is how your schedule will appear on your truck profile in the app.
          </p>
          {openDays.length === 0 ? (
            <p className="text-sm text-neutral-400 italic">No days marked as open yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {openDays.map(({ key, label }) => {
                const day = schedule[key];
                return (
                  <div key={key} className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-xs font-black text-neutral-500">{label.slice(0, 3)}</span>
                      <span className="text-xs text-neutral-700">
                        {fmt12(day.start)} – {fmt12(day.end)}
                      </span>
                    </div>
                    {day.location && (
                      <span className="text-xs text-neutral-400 truncate max-w-[140px] text-right">{day.location}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
