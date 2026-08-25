import { createClient } from "@/lib/supabase/server";
import { isValidStateCode, stateNameForCode } from "@/lib/us-states";
import type { Festival } from "@/lib/types";
import Link from "next/link";

type Props = {
  params: Promise<{ state: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { state } = await params;
  const code = state.toUpperCase();
  if (!isValidStateCode(code)) {
    return { title: "Festivals & Events | HotTruckMap" };
  }
  const stateName = stateNameForCode(code);

  return {
    title: `Food Truck Festivals & Events in ${stateName} | HotTruckMap`,
    description: `Find upcoming food truck festivals and events across ${stateName}, by city. Updated monthly.`,
  };
}

function formatDateRange(startDate: string, endDate: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const start = new Date(startDate + "T00:00:00").toLocaleDateString([], opts);
  if (endDate === startDate) return start;
  const end = new Date(endDate + "T00:00:00").toLocaleDateString([], opts);
  return `${start} – ${end}`;
}

export default async function StateEventsPage({ params }: Props) {
  const { state } = await params;
  const code = state.toUpperCase();

  if (!isValidStateCode(code)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  const stateName = stateNameForCode(code)!;

  const supabase = await createClient();

  let festivals: Festival[] = [];
  try {
    const todayISO = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("festivals")
      .select("*")
      .eq("state_code", code)
      .gte("end_date", todayISO)
      .order("start_date");
    if (!error && data) festivals = data as Festival[];
  } catch {
    // Network error on server — render empty state rather than crashing
  }

  const byCity = festivals.reduce<Record<string, Festival[]>>((acc, f) => {
    (acc[f.city] ??= []).push(f);
    return acc;
  }, {});
  const cities = Object.keys(byCity).sort();

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-6">
        <Link href="/events" className="text-brand-red text-sm font-medium mb-4 block">
          ← All states
        </Link>
        <h1 className="text-2xl font-bold text-neutral-800">
          Festivals & Events in {stateName}
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          {festivals.length} upcoming event{festivals.length !== 1 ? "s" : ""} across {cities.length} cit{cities.length !== 1 ? "ies" : "y"}
        </p>
      </div>

      {/* SEO Content */}
      <div className="px-4 py-4 bg-white border-b border-neutral-50">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Looking for food truck festivals and events in {stateName}? HotTruckMap lists
          upcoming festivals by city, updated monthly — dates, venues, and links so you
          never miss a food truck gathering near you.
        </p>
      </div>

      {/* Event list, grouped by city */}
      <div className="p-4 flex flex-col gap-6">
        {cities.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎪</span>
            </div>
            <p className="text-neutral-500 font-medium">
              No upcoming festivals in {stateName} yet
            </p>
            <p className="text-neutral-400 text-sm mt-1">
              Check back soon — new events are added monthly
            </p>
            <Link
              href="/events"
              className="inline-block mt-4 px-4 py-2 bg-brand-red text-white rounded-full text-sm font-semibold"
            >
              Browse Other States
            </Link>
          </div>
        ) : (
          cities.map((city) => (
            <div key={city}>
              <h2 className="text-sm font-black text-neutral-500 uppercase tracking-widest mb-3">
                {city}
              </h2>
              <div className="flex flex-col gap-3">
                {byCity[city].map((f) => (
                  <div key={f.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-neutral-800">{f.name}</p>
                        <p className="text-xs text-brand-red font-medium mt-0.5">
                          {formatDateRange(f.start_date, f.end_date)}
                        </p>
                        {f.venue && (
                          <p className="text-xs text-neutral-400 mt-1">{f.venue}</p>
                        )}
                        {f.description && (
                          <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
                            {f.description}
                          </p>
                        )}
                        {f.website_url && (
                          <a
                            href={f.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-red font-semibold mt-2 inline-block hover:underline"
                          >
                            Visit website →
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* SEO Footer */}
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-neutral-400">
          HotTruckMap — Food truck festivals and events in {stateName} and beyond.
        </p>
        <Link href="/events" className="text-xs text-brand-red hover:underline mt-3 inline-block">
          Browse all states →
        </Link>
      </div>

    </div>
  );
}
