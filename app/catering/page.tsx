import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Food Truck Catering | Hot Truck Map",
  description: "Book a food truck for your next event. Browse catering packages from local food trucks.",
};

export default async function CateringPage() {
  const supabase = await createClient();

  let trucks: any[] = [];
  let loadError = false;
  try {
    const { data, error } = await supabase
      .from("trucks")
      .select("id, name, cuisine, profile_photo, catering_description, catering_starting_price, catering_min_guests")
      .eq("offers_catering", true)
      .order("name", { ascending: true })
      .limit(50);
    if (error) throw error;
    trucks = data ?? [];
  } catch {
    loadError = true;
  }

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-neutral-900 px-4 py-8 text-center">
        <div className="w-16 h-16 bg-brand-red rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M1 3h15v13H1z"/>
            <path d="M16 8h4l3 3v5h-7V8z"/>
            <circle cx="5.5" cy="18.5" r="2.5"/>
            <circle cx="18.5" cy="18.5" r="2.5"/>
          </svg>
        </div>
        <h1 className="text-3xl font-black text-white mb-2">Food Truck Catering</h1>
        <p className="text-neutral-400 max-w-sm mx-auto text-sm leading-relaxed">
          Book a food truck for your event. Browse packages and send a request directly to operators.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Link
            href="/"
            className="px-5 py-2.5 border border-neutral-600 text-neutral-300 rounded-full font-bold text-sm hover:border-neutral-400 hover:text-white transition-colors"
          >
            Back to Map
          </Link>
          <Link
            href="/signup?role=operator"
            className="px-5 py-2.5 bg-brand-red text-white rounded-full font-black text-sm hover:bg-red-600 transition-colors"
          >
            List My Truck
          </Link>
        </div>
      </div>

      {/* Truck grid */}
      <div className="max-w-4xl mx-auto p-4 py-8">
        {loadError ? (
          <div className="text-center py-16">
            <p className="text-neutral-500 font-semibold">Could not load catering trucks</p>
            <p className="text-neutral-400 text-sm mt-1">Check your connection and refresh the page.</p>
          </div>
        ) : trucks.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round">
                <path d="M1 3h15v13H1z"/>
                <path d="M16 8h4l3 3v5h-7V8z"/>
                <circle cx="5.5" cy="18.5" r="2.5"/>
                <circle cx="18.5" cy="18.5" r="2.5"/>
              </svg>
            </div>
            <p className="text-neutral-500 font-semibold">No catering trucks available yet</p>
            <p className="text-neutral-400 text-sm mt-1">Check back soon — more trucks are joining!</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-black text-neutral-400 uppercase tracking-widest mb-4">
              {trucks.length} truck{trucks.length !== 1 ? "s" : ""} available for catering
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {trucks.map((truck) => (
                <Link
                  key={truck.id}
                  href={`/catering/book/${truck.id}`}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="h-36 bg-neutral-200 relative">
                    {truck.profile_photo ? (
                      <Image src={truck.profile_photo} alt={truck.name} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                    ) : (
                      <div className="w-full h-full bg-neutral-800 flex items-center justify-center">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M1 3h15v13H1z"/>
                          <path d="M16 8h4l3 3v5h-7V8z"/>
                          <circle cx="5.5" cy="18.5" r="2.5"/>
                          <circle cx="18.5" cy="18.5" r="2.5"/>
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="font-black text-neutral-900 uppercase tracking-wide text-sm">{truck.name}</p>
                    <p className="text-xs text-brand-red font-medium mt-0.5">{truck.cuisine}</p>
                    {truck.catering_description && (
                      <p className="text-xs text-neutral-400 mt-2 line-clamp-2 leading-relaxed">
                        {truck.catering_description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-3">
                      {truck.catering_starting_price && (
                        <span className="text-xs font-bold text-neutral-600">
                          From ${truck.catering_starting_price}/person
                        </span>
                      )}
                      {truck.catering_min_guests && (
                        <span className="text-xs text-neutral-400">
                          Min {truck.catering_min_guests} guests
                        </span>
                      )}
                    </div>
                    <div className="mt-3">
                      <span className="inline-block px-3 py-1.5 bg-brand-red text-white rounded-full text-xs font-black uppercase tracking-wide">
                        Request Catering →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
