"use client";

import { useState, useEffect, use } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

const EVENT_TYPES = [
  "Corporate Lunch", "Wedding", "Birthday Party",
  "Festival", "Private Party", "Graduation", "Other"
];

export default function BookCateringPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [truck, setTruck] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    event_date: "",
    event_time: "",
    event_location: "",
    guest_count: "",
    budget: "",
    event_type: "",
    notes: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    const { data: truckData } = await supabase
      .from("trucks")
      .select("*")
      .eq("id", id)
      .single();

    const { data: pkgData } = await supabase
      .from("catering_packages")
      .select("*")
      .eq("truck_id", id)
      .eq("is_active", true);

    setTruck(truckData);
    setPackages(pkgData ?? []);

    if (user) {
      setForm((f) => ({
        ...f,
        customer_email: user.email ?? "",
      }));
    }

    setLoading(false);
  }

  async function handleSubmit() {
    if (
      !form.customer_name ||
      !form.customer_email ||
      !form.event_date ||
      !form.event_location ||
      !form.guest_count
    ) return;

    setSubmitting(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("catering_requests")
      .insert({
        truck_id: id,
        customer_id: user?.id ?? null,
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        event_date: form.event_date,
        event_time: form.event_time,
        event_location: form.event_location,
        guest_count: parseInt(form.guest_count),
        budget: form.budget ? parseFloat(form.budget) : null,
        event_type: form.event_type,
        notes: form.notes,
        status: "pending",
      });

    setSubmitting(false);

    if (!error) {
      setSubmitted(true);
    } else {
      setSubmitError("Something went wrong. Please try again.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-[3px] border-brand-red border-t-transparent rounded-full animate-spin" />
        <p className="text-neutral-400 text-sm">Loading truck details...</p>
      </div>
    );
  }

  if (!truck) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-600 font-semibold">Truck not found</p>
        <Link href="/catering" className="text-brand-red text-sm font-medium">
          Back to catering
        </Link>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-neutral-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
          </div>
          <h2 className="text-xl font-black text-neutral-900 uppercase tracking-wide mb-2">
            Request Sent!
          </h2>
          <p className="text-neutral-500 text-sm mb-2">
            Your catering request has been sent to
          </p>
          <p className="font-black text-brand-red text-base uppercase mb-4">
            {truck.name}
          </p>
          <p className="text-neutral-400 text-xs mb-6 leading-relaxed">
            The operator will review your request and get back to you within 24 hours at{" "}
            <span className="font-semibold text-neutral-600">{form.customer_email}</span>
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/catering"
              className="block w-full py-3 bg-brand-red text-white rounded-xl font-black text-sm text-center uppercase tracking-wide"
            >
              Browse More Trucks
            </Link>
            <Link
              href="/"
              className="block w-full py-3 border-2 border-neutral-200 text-neutral-600 rounded-xl font-bold text-sm text-center"
            >
              Back to Map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-100">

      {/* Navbar */}
      <nav className="bg-neutral-900 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-3">
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
        </Link>
        <Link
          href="/catering"
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Back to catering
        </Link>
      </nav>

      {/* Truck Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="h-40 bg-neutral-200 overflow-hidden relative">
          {truck.profile_photo ? (
            <Image src={truck.profile_photo} alt={truck.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#444" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-6">
            <h1 className="text-2xl font-black text-white uppercase tracking-wide">
              {truck.name}
            </h1>
            <p className="text-brand-orange font-semibold text-sm">
              {truck.cuisine}
            </p>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-neutral-500">
            {truck.catering_description ?? "Available for private catering events"}
          </p>
          <div className="flex items-center gap-4 mt-3">
            {truck.catering_starting_price && (
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
                <span className="text-sm font-bold text-neutral-700">
                  From ${truck.catering_starting_price}/person
                </span>
              </div>
            )}
            {truck.catering_min_guests && (
              <div className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2" strokeLinecap="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span className="text-sm font-bold text-neutral-700">
                  Min {truck.catering_min_guests} guests
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto flex flex-col gap-5">

        {/* Packages */}
        {packages.length > 0 && (
          <div>
            <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
              Select a Package
            </h2>
            <div className="flex flex-col gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setSelectedPackage(
                    selectedPackage === pkg.id ? null : pkg.id
                  )}
                  className={`bg-white rounded-2xl p-4 text-left border-2 transition-all ${
                    selectedPackage === pkg.id
                      ? "border-brand-red"
                      : "border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-black text-neutral-900 uppercase tracking-wide text-sm">
                          {pkg.name}
                        </p>
                        {selectedPackage === pkg.id && (
                          <span className="text-[10px] font-black px-2 py-0.5 bg-brand-red text-white rounded-full">
                            SELECTED
                          </span>
                        )}
                      </div>
                      {pkg.description && (
                        <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                          {pkg.description}
                        </p>
                      )}
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
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-brand-red font-black text-lg">
                        ${pkg.price_per_person}
                      </p>
                      <p className="text-xs text-neutral-400">per person</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Min {pkg.minimum_guests} guests
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Event Details */}
        <div>
          <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
            Event Details
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

            {/* Event Type */}
            <div className="p-4 border-b border-neutral-100">
              <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                Event Type
              </label>
              <div className="flex flex-wrap gap-2">
                {EVENT_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm({ ...form, event_type: type })}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                      form.event_type === type
                        ? "bg-brand-red text-white border-brand-red"
                        : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-0 border-b border-neutral-100">
              <div className="p-4 border-r border-neutral-100">
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Event Date *
                </label>
                <input
                  type="date"
                  value={form.event_date}
                  onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                  min={new Date().toISOString().split("T")[0]}
                  className="w-full text-sm text-neutral-800 focus:outline-none"
                />
              </div>
              <div className="p-4">
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Event Time
                </label>
                <input
                  type="time"
                  value={form.event_time}
                  onChange={(e) => setForm({ ...form, event_time: e.target.value })}
                  className="w-full text-sm text-neutral-800 focus:outline-none"
                />
              </div>
            </div>

            {/* Location */}
            <div className="p-4 border-b border-neutral-100">
              <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                Event Location *
              </label>
              <input
                value={form.event_location}
                onChange={(e) => setForm({ ...form, event_location: e.target.value })}
                placeholder="e.g. 123 Main St, Newark NJ"
                className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 bg-transparent focus:bg-neutral-50 rounded transition-colors"
              />
            </div>

            {/* Guest Count + Budget */}
            <div className="grid grid-cols-2 gap-0">
              <div className="p-4 border-r border-neutral-100">
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Guest Count *
                </label>
                <input
                  type="number"
                  value={form.guest_count}
                  onChange={(e) => setForm({ ...form, guest_count: e.target.value })}
                  placeholder="e.g. 50"
                  min="1"
                  className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 bg-transparent focus:bg-neutral-50 rounded transition-colors"
                />
              </div>
              <div className="p-4">
                <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                  Budget
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-neutral-400 text-sm">$</span>
                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) => setForm({ ...form, budget: e.target.value })}
                    placeholder="Optional"
                    className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 bg-transparent focus:bg-neutral-50 rounded transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
            Additional Notes
          </h2>
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any special requests, dietary requirements, or details about your event..."
              rows={3}
              className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 resize-none"
            />
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h2 className="text-xs font-black text-neutral-500 uppercase tracking-widest mb-3">
            Your Contact Info
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-neutral-100">
              <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                Full Name *
              </label>
              <input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="Your full name"
                className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 bg-transparent focus:bg-neutral-50 rounded transition-colors"
              />
            </div>
            <div className="p-4 border-b border-neutral-100">
              <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                Email *
              </label>
              <input
                type="email"
                value={form.customer_email}
                onChange={(e) => setForm({ ...form, customer_email: e.target.value })}
                placeholder="your@email.com"
                className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 bg-transparent focus:bg-neutral-50 rounded transition-colors"
              />
            </div>
            <div className="p-4">
              <label className="text-xs font-black text-neutral-500 uppercase tracking-wider mb-2 block">
                Phone
              </label>
              <input
                type="tel"
                value={form.customer_phone}
                onChange={(e) => setForm({ ...form, customer_phone: e.target.value })}
                placeholder="(201) 555-0123"
                className="w-full text-sm text-neutral-800 focus:outline-none placeholder-neutral-300 bg-transparent focus:bg-neutral-50 rounded transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        {submitError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center gap-2">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#E8481C" strokeWidth="2.5" strokeLinecap="round" className="flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-sm text-red-600 font-semibold">{submitError}</p>
          </div>
        )}
        <button
          onClick={handleSubmit}
          disabled={
            submitting ||
            !form.customer_name ||
            !form.customer_email ||
            !form.event_date ||
            !form.event_location ||
            !form.guest_count
          }
          className="w-full py-4 bg-brand-red text-white rounded-2xl font-black text-base uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed hover:bg-brand-red-dark transition-colors"
        >
          {submitting ? "Sending Request..." : "Send Catering Request"}
        </button>

        <p className="text-xs text-neutral-400 text-center">
          By submitting you agree to be contacted by the food truck operator.
          No payment is required at this stage.
        </p>

      </div>
    </div>
  );
}