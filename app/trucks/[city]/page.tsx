import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type Props = {
  params: { city: string };
};

export async function generateMetadata({ params }: Props) {
  const city = params.city
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  return {
    title: "Food Trucks in " + city + " | HotTruckMap",
    description:
      "Find the best food trucks in " +
      city +
      ". Real-time locations, menus, and reviews. Updated live.",
  };
}

export default async function CityPage({ params }: Props) {
  const city = params.city
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

  const supabase = createClient();

  const { data: trucks } = await supabase
    .from("trucks")
    .select("*, locations(*)")
    .ilike("locations.address", "%" + city + "%")
    .eq("is_live", true);

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <div className="bg-white border-b border-neutral-100 px-4 py-6">
        <Link href="/" className="text-brand-red text-sm font-medium mb-4 block">
          ← Back to map
        </Link>
        <h1 className="text-2xl font-bold text-neutral-800">
          Food Trucks in {city}
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          {trucks?.length ?? 0} truck{trucks?.length !== 1 ? "s" : ""} active in {city}
        </p>
      </div>

      {/* SEO Content */}
      <div className="px-4 py-4 bg-white border-b border-neutral-50">
        <p className="text-sm text-neutral-600 leading-relaxed">
          Looking for food trucks in {city}? HotTruckMap shows you real-time
          locations of all active food trucks near you. Browse menus, check
          hours, and get directions — all in one place.
        </p>
      </div>

      {/* Truck List */}
      <div className="p-4 flex flex-col gap-3">
        {!trucks || trucks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🚚</p>
            <p className="text-neutral-500 font-medium">
              No active trucks in {city} right now
            </p>
            <p className="text-neutral-400 text-sm mt-1">
              Check back later or browse all trucks
            </p>
            <Link
              href="/trucks"
              className="inline-block mt-4 px-4 py-2 bg-brand-red text-white rounded-full text-sm font-semibold"
            >
              Browse All Trucks
            </Link>
          </div>
        ) : (
          trucks.map((truck) => (
            <Link
              key={truck.id}
              href={"/truck/" + truck.id}
              className="bg-white rounded-2xl shadow-sm p-4 flex gap-3"
            >
              <div className="w-16 h-16 rounded-xl bg-neutral-100 flex-shrink-0 overflow-hidden">
                {truck.profile_photo ? (
                  <img
                    src={truck.profile_photo}
                    alt={truck.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    🚚
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-neutral-800 truncate">
                    {truck.name}
                  </p>
                  {truck.is_live && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-brand-red rounded-full flex-shrink-0">
                      LIVE
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-red font-medium mt-0.5">
                  {truck.cuisine}
                </p>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                  {truck.description}
                </p>
                {truck.locations?.[0] && (
                  <p className="text-xs text-neutral-400 mt-1">
                    📍 {truck.locations[0].address}
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>

      {/* SEO Footer */}
      <div className="px-4 py-8 text-center">
        <p className="text-xs text-neutral-400">
          HotTruckMap — Real-time food truck discovery in {city} and beyond.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mt-3">
          {["Newark", "New-York", "Jersey-City", "Hoboken", "Trenton"].map((c) => (
            <Link
              key={c}
              href={"/trucks/" + c.toLowerCase()}
              className="text-xs text-brand-red hover:underline"
            >
              Food Trucks in {c.replace("-", " ")}
            </Link>
          ))}
        </div>
      </div>

    </div>
  );
}