"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM",
  "6:00 PM", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM",
];

type ScheduleEntry = {
  id?: string;
  truck_id: string;
  day_of_week: number;
  location: string;
  open_time: string;
  close_time: string;
  notes: string;
};

const EMPTY_ENTRY = {
  day_of_week: 0,
  location: "",
  open_time: "10:00 AM",
  close_time: "3:00 PM",
  notes: "",
};

export default function SchedulePage() {
  const [truckId, setTruckId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_ENTRY);
  const [saving, setSaving] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  useEffect(() => {
    loadSchedule();
  }, []);

  async function loadSchedule() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: truck } = await supabase
      .from("trucks")
      .select("id")
      .eq("owner_id", user.id)
      .single();

    if (!truck) {
      setLoading(false);
      return;
    }
    setTruckId(truck.id);

    const { data } = await supabase
      .from("schedules")
      .select("*")
      .eq("truck_id", truck.id)
      .order("day_of_week", { ascending: true });

    setSchedule(data ?? []);
    setLoading(false);
  }

  function openAdd(day: number) {
    setForm({ ...EMPTY_ENTRY, day_of_week: day });
    setEditing(null);
    setIsAdding(true);
  }

  function openEdit(entry: ScheduleEntry) {
    setForm({
      day_of_week: entry.day_of_week,
      location: entry.location,
      open_time: entry.open_time,
      close_time: entry.close_time,
      notes: entry.notes,
    });
    setEditing(entry);
    setIsAdding(true);
  }

  async function saveEntry() {
    if (!truckId || !form.location) return;
    setSaving(true);

    const supabase = createClient();
    const payload = {
      truck_id: truckId,
      ...form,
    };

    if (editing?.id) {
      await supabase
        .from("schedules")
        .update(payload)
        .eq("id", editing.id);
    } else {
      await supabase
        .from("schedules")
        .insert(payload);
    }

    setSaving(false);
    setIsAdding(false);
    setEditing(null);
    loadSchedule();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Remove this schedule?")) return;
    const supabase = createClient();
    await supabase.from("schedules").delete().eq("id", id);
    setSchedule(schedule.filter((s) => s.id !== id));
  }

  const todayEntries = schedule.filter((s) => s.day_of_week === selectedDay);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <p className="text-neutral-400 text-sm">Loading schedule...</p>
      </div>
    );
  }

  if (!truckId) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p className="font-bold text-neutral-800 mb-1">Set up your truck profile first</p>
        <p className="text-sm text-neutral-400 mb-6">
          You need to create your truck profile before adding a schedule.
        </p>
        <a
          href="/dashboard/profile"
          className="px-6 py-3 bg-brand-red text-white rounded-2xl font-bold text-sm"
        >
          Create Truck Profile
        </a>
        <button onClick={() => window.history.back()} className="mt-3 text-sm text-neutral-400 hover:text-neutral-600">
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-500 hover:bg-neutral-200 transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-bold text-neutral-800">Weekly Schedule</h1>
            <p className="text-sm text-neutral-400">Plan your locations for the week</p>
          </div>
        </div>
      </div>

      {/* Day Selector */}
      <div className="bg-white border-b border-neutral-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {DAYS.map((day, i) => {
            const hasEntry = schedule.some((s) => s.day_of_week === i);
            const isToday = i === new Date().getDay();
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all ${
                  selectedDay === i
                    ? "bg-brand-red text-white"
                    : "bg-neutral-100 text-neutral-600"
                }`}
              >
                <span className="text-xs font-medium">{day}</span>
                {isToday && (
                  <span className={`text-[9px] font-bold ${
                    selectedDay === i ? "text-red-200" : "text-brand-red"
                  }`}>
                    TODAY
                  </span>
                )}
                {hasEntry && (
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    selectedDay === i ? "bg-red-200" : "bg-brand-red"
                  }`} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Content */}
      <div className="p-4 flex flex-col gap-3">

        {/* Entries for selected day */}
        {todayEntries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-neutral-500 font-medium">
              No stops planned for {DAYS[selectedDay]}
            </p>
            <p className="text-neutral-400 text-sm mt-1">
              Tap below to add a location
            </p>
          </div>
        ) : (
          todayEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-2xl shadow-sm p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-neutral-800">
                      {entry.location}
                    </p>
                  </div>
                  <p className="text-sm text-brand-red font-medium ml-7">
                    {entry.open_time} – {entry.close_time}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-neutral-400 mt-1 ml-7">
                      {entry.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(entry)}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id!)}
                    className="text-xs text-red-300 hover:text-red-500"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Add button */}
        <button
          onClick={() => openAdd(selectedDay)}
          className="w-full py-4 rounded-2xl border-2 border-dashed border-neutral-200 text-neutral-400 font-medium text-sm hover:border-brand-red hover:text-brand-red transition-colors"
        >
          + Add Location for {DAYS[selectedDay]}
        </button>
      </div>

      {/* Weekly Overview */}
      <div className="px-4 pb-8">
        <h2 className="text-sm font-semibold text-neutral-500 mb-3 uppercase tracking-wide">
          Full Week Overview
        </h2>
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {DAYS.map((day, i) => {
            const entries = schedule.filter((s) => s.day_of_week === i);
            const isToday = i === new Date().getDay();
            return (
              <div
                key={day}
                onClick={() => setSelectedDay(i)}
                className={`flex items-center gap-3 px-4 py-3 border-b border-neutral-50 last:border-0 cursor-pointer hover:bg-neutral-50 ${
                  isToday ? "bg-red-50" : ""
                }`}
              >
                <span className={`text-sm font-bold w-8 ${
                  isToday ? "text-brand-red" : "text-neutral-400"
                }`}>
                  {day}
                </span>
                <div className="flex-1">
                  {entries.length === 0 ? (
                    <p className="text-sm text-neutral-300">No stops planned</p>
                  ) : (
                    entries.map((e) => (
                      <p key={e.id} className="text-sm text-neutral-700">
                        {e.location}
                        <span className="text-neutral-400 ml-2 text-xs">
                          {e.open_time} – {e.close_time}
                        </span>
                      </p>
                    ))
                  )}
                </div>
                {isToday && (
                  <span className="text-[10px] font-bold text-brand-red bg-red-50 px-2 py-0.5 rounded-full">
                    TODAY
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-800">
                {editing ? "Edit Stop" : `Add Stop — ${DAYS[form.day_of_week]}`}
              </h2>
              <button
                onClick={() => setIsAdding(false)}
                className="text-neutral-400 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Location */}
            <label className="text-sm font-medium text-neutral-600">Location *</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Main St & 5th Ave, Newark NJ"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 mb-4 focus:outline-none focus:border-brand-red"
            />

            {/* Open Time */}
            <label className="text-sm font-medium text-neutral-600">Opening Time</label>
            <select
              value={form.open_time}
              onChange={(e) => setForm({ ...form, open_time: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 mb-4 focus:outline-none focus:border-brand-red"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            {/* Close Time */}
            <label className="text-sm font-medium text-neutral-600">Closing Time</label>
            <select
              value={form.close_time}
              onChange={(e) => setForm({ ...form, close_time: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 mb-4 focus:outline-none focus:border-brand-red"
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>

            {/* Notes */}
            <label className="text-sm font-medium text-neutral-600">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Near the farmers market"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm mt-1 mb-6 focus:outline-none focus:border-brand-red"
            />

            {/* Save */}
            <button
              onClick={saveEntry}
              disabled={saving || !form.location}
              className="w-full py-4 bg-brand-red text-white rounded-2xl font-bold text-base disabled:opacity-40"
            >
              {saving ? "Saving..." : editing ? "Save Changes" : "Add to Schedule"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}