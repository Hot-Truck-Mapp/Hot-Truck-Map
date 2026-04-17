"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  confirmed: "bg-green-50 text-green-700 border-green-200",
  declined: "bg-red-50 text-red-600 border-red-200",
  completed: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

export default function CateringDashboardPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [truckId, setTruckId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<any | null>(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [cateringEnabled, setCateringEnabled] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: truck } = await supabase
      .from("trucks")
      .select("id, offers_catering")
      .eq("owner_id", user.id)
      .single();

    if (!truck) return;
    setTruckId(truck.id);
    setCateringEnabled(truck.offers_catering ?? false);

    const { data } = await supabase
      .from("catering_requests")
      .select("*")
      .eq("truck_id", truck.id)
      .order("created_at", { ascending: false });

    setRequests(data ?? []);
    setLoading(false);
  }

  async function loadMessages(requestId: string) {
    const supabase = createClient();
    const { data } = await supabase
      .from("catering_messages")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });

    setMessages(data ?? []);
  }

  async function selectRequest(request: any) {
    setSelected(request);
    await loadMessages(request.id);
  }

  async function updateStatus(requestId: string, status: string) {
    setUpdating(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("catering_requests")
      .update({ status })
      .eq("id", requestId);

    if (!error) {
      setRequests(requests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      ));

      if (selected?.id === requestId) {
        setSelected({ ...selected, status });
      }
    }

    setUpdating(false);
  }

  async function sendMessage() {
    if (!message.trim() || !selected) return;
    setSending(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("catering_messages").insert({
      request_id: selected.id,
      sender_id: user?.id,
      message: message.trim(),
    });

    if (!error) {
      setMessage("");
      await loadMessages(selected.id);
    }
    setSending(false);
  }

  async function toggleCatering() {
    if (!truckId) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("trucks")
      .update({ offers_catering: !cateringEnabled })
      .eq("id", truckId);
    if (!error) setCateringEnabled(!cateringEnabled);
  }

  const filtered = requests.filter((r) =>
    filter === "all" ? true : r.status === filter
  );

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    confirmed: requests.filter((r) => r.status === "confirmed").length,
    declined: requests.filter((r) => r.status === "declined").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

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
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Dashboard
        </button>
      </nav>

      {/* Header */}
      <div className="bg-white px-6 py-5 border-b border-neutral-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black text-neutral-900 uppercase tracking-wide">
              Catering Requests
            </h1>
            <p className="text-sm text-neutral-400 mt-0.5">
              {counts.pending} pending · {counts.confirmed} confirmed
            </p>
          </div>

          {/* Catering Toggle */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-black text-neutral-500 uppercase tracking-wider">
                Accept Catering
              </p>
              <p className="text-xs text-neutral-400">
                {cateringEnabled ? "Visible on catering page" : "Hidden from catering page"}
              </p>
            </div>
            <button
              onClick={toggleCatering}
              className={`w-14 h-7 rounded-full transition-colors flex-shrink-0 ${
                cateringEnabled ? "bg-brand-red" : "bg-neutral-200"
              }`}
            >
              <span className={`block w-6 h-6 bg-white rounded-full shadow transition-transform mx-0.5 ${
                cateringEnabled ? "translate-x-7" : "translate-x-0"
              }`} />
            </button>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex gap-2 mt-4">
          <Link
            href="/dashboard/catering/packages"
            className="flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-full text-xs font-black uppercase tracking-wide hover:bg-brand-red-dark transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Manage Packages
          </Link>
          <Link
            href="/dashboard/profile"
            className="flex items-center gap-2 px-4 py-2 border border-neutral-200 text-neutral-600 rounded-full text-xs font-bold hover:border-neutral-400 transition-colors"
          >
            Edit Catering Info
          </Link>
        </div>
      </div>

      {/* Status Filter */}
      <div className="bg-white border-b border-neutral-100 px-4 py-3">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "confirmed", label: "Confirmed" },
            { id: "declined", label: "Declined" },
            { id: "completed", label: "Completed" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide transition-all border-2 ${
                filter === tab.id
                  ? "bg-brand-red text-white border-brand-red"
                  : "bg-white text-neutral-500 border-neutral-200"
              }`}
            >
              {tab.label}
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                filter === tab.id
                  ? "bg-white/20 text-white"
                  : "bg-neutral-100 text-neutral-500"
              }`}>
                {counts[tab.id as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[calc(100vh-220px)]">

        {/* Request List */}
        <div className="w-full md:w-96 bg-white border-r border-neutral-200 overflow-y-auto flex-shrink-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
              </div>
              <p className="text-neutral-500 font-semibold">No requests yet</p>
              <p className="text-neutral-400 text-xs mt-1">
                {cateringEnabled
                  ? "Requests will appear here"
                  : "Enable catering to receive requests"}
              </p>
            </div>
          ) : (
            filtered.map((request) => (
              <button
                key={request.id}
                onClick={() => selectRequest(request)}
                className={`w-full text-left p-4 border-b border-neutral-100 hover:bg-neutral-50 transition-colors ${
                  selected?.id === request.id ? "bg-red-50 border-l-4 border-l-brand-red" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-black text-neutral-900 text-sm uppercase tracking-wide truncate">
                    {request.customer_name}
                  </p>
                  <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${
                    STATUS_COLORS[request.status] ?? STATUS_COLORS.pending
                  }`}>
                    {request.status}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 font-medium">
                  {request.event_type ?? "Event"} · {request.guest_count} guests
                </p>
                <p className="text-xs text-neutral-400 mt-0.5">
                  📅 {new Date(request.event_date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </p>
                <p className="text-xs text-neutral-400 truncate mt-0.5">
                  📍 {request.event_location}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Request Detail */}
        {selected ? (
          <div className="flex-1 overflow-y-auto hidden md:flex flex-col">

            {/* Detail Header */}
            <div className="bg-white border-b border-neutral-200 px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-neutral-900 uppercase tracking-wide">
                    {selected.customer_name}
                  </h2>
                  <p className="text-sm text-neutral-500 mt-0.5">
                    {selected.event_type} · {selected.guest_count} guests
                  </p>
                </div>
                <span className={`text-xs font-black px-3 py-1.5 rounded-full border uppercase tracking-wide ${
                  STATUS_COLORS[selected.status] ?? STATUS_COLORS.pending
                }`}>
                  {selected.status}
                </span>
              </div>

              {/* Action Buttons */}
              {selected.status === "pending" && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => updateStatus(selected.id, "confirmed")}
                    disabled={updating}
                    className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-green-700 transition-colors disabled:opacity-40"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => updateStatus(selected.id, "declined")}
                    disabled={updating}
                    className="flex-1 py-2.5 bg-neutral-200 text-neutral-600 rounded-xl font-black text-sm uppercase tracking-wide hover:bg-neutral-300 transition-colors disabled:opacity-40"
                  >
                    Decline
                  </button>
                </div>
              )}
              {selected.status === "confirmed" && (
                <button
                  onClick={() => updateStatus(selected.id, "completed")}
                  disabled={updating}
                  className="w-full mt-4 py-2.5 bg-neutral-900 text-white rounded-xl font-black text-sm uppercase tracking-wide hover:bg-neutral-800 transition-colors disabled:opacity-40"
                >
                  Mark as Completed
                </button>
              )}
            </div>

            {/* Event Info */}
            <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-wider">
                  Event Details
                </p>
              </div>
              <div className="divide-y divide-neutral-100">
                {[
                  { label: "Date", value: new Date(selected.event_date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) },
                  { label: "Time", value: selected.event_time ?? "Not specified" },
                  { label: "Location", value: selected.event_location },
                  { label: "Guests", value: selected.guest_count + " people" },
                  { label: "Budget", value: selected.budget ? "$" + selected.budget : "Not specified" },
                  { label: "Event Type", value: selected.event_type ?? "Not specified" },
                ].map((item) => (
                  <div key={item.label} className="flex items-start justify-between px-4 py-3 gap-4">
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-wide flex-shrink-0">
                      {item.label}
                    </p>
                    <p className="text-sm text-neutral-700 font-medium text-right">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact Info */}
            <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-100">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-wider">
                  Contact Info
                </p>
              </div>
              <div className="divide-y divide-neutral-100">
                <div className="flex items-center justify-between px-4 py-3">
                  <p className="text-xs font-black text-neutral-400 uppercase tracking-wide">Email</p>
                  <a
                    href={"mailto:" + selected.customer_email}
                    className="text-sm text-brand-red font-semibold hover:underline"
                  >
                    {selected.customer_email}
                  </a>
                </div>
                {selected.customer_phone && (
                  <div className="flex items-center justify-between px-4 py-3">
                    <p className="text-xs font-black text-neutral-400 uppercase tracking-wide">Phone</p>
                    <a
                      href={"tel:" + selected.customer_phone}
                      className="text-sm text-brand-red font-semibold hover:underline"
                    >
                      {selected.customer_phone}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {selected.notes && (
              <div className="bg-white mx-4 mt-4 rounded-2xl shadow-sm p-4">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-wider mb-2">
                  Customer Notes
                </p>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {selected.notes}
                </p>
              </div>
            )}

            {/* Messages */}
            <div className="mx-4 mt-4 mb-4 bg-white rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-neutral-100">
                <p className="text-xs font-black text-neutral-400 uppercase tracking-wider">
                  Messages
                </p>
              </div>

              <div className="flex-1 p-4 flex flex-col gap-3 min-h-32">
                {messages.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-4">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="bg-neutral-50 rounded-xl p-3">
                      <p className="text-sm text-neutral-700">{msg.message}</p>
                      <p className="text-[10px] text-neutral-400 mt-1">
                        {new Date(msg.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-3 border-t border-neutral-100 flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:border-brand-red transition-colors"
                />
                <button
                  onClick={sendMessage}
                  disabled={sending || !message.trim()}
                  className="px-4 py-2 bg-brand-red text-white rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-brand-red-dark transition-colors"
                >
                  Send
                </button>
              </div>
            </div>

          </div>
        ) : (
          <div className="flex-1 hidden md:flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
                </svg>
              </div>
              <p className="text-neutral-400 font-semibold text-sm">
                Select a request to view details
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
