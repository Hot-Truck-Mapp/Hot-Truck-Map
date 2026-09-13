import type { Metadata } from "next";
import { cache, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";
import { JsonLd } from "@/components/JsonLd";
import { parseClock } from "@/lib/discovery";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// cache() so generateMetadata and the layout share one query per request.
const getTruck = cache(async (id: string) => {
  const { data } = await anonClient()
    .from("trucks")
    .select("name, description, cuisine, profile_photo, is_live, phone, instagram, avg_rating, review_count")
    .eq("id", id)
    .maybeSingle();
  return data;
});

/** Only our own storage — never an arbitrary operator-supplied host. */
function ownImage(url: string | null | undefined): string | null {
  return url && url.startsWith("https://") && (url.includes("supabase.co") || url.includes("hottruckmap.com")) ? url : null;
}

/** "4:00 PM" → "16:00", the form schema.org opening hours use. */
function to24h(clock: string | null): string | null {
  const m = parseClock(clock);
  if (m == null) return null;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const truck = await getTruck(id);

  if (!truck) {
    return {
      title: "Food Truck | Hot Truck Map",
      description: "Find food trucks near you on Hot Truck Map.",
    };
  }

  const title = `${truck.name} | Hot Truck Map`;
  const description =
    truck.description ||
    `${truck.cuisine ? truck.cuisine + " food truck" : "Food truck"} — order ahead and pay at the truck. Find us on Hot Truck Map.`;
  const status = truck.is_live ? "Open Now · " : "";
  const fullDescription = status + description;

  return {
    title,
    description: fullDescription,
    openGraph: {
      title: truck.name,
      description: fullDescription,
      type: "website",
      siteName: "Hot Truck Map",
      // Only embed the OG image if it's from our own storage origin —
      // prevents SSRF-adjacent crawls from operator-supplied arbitrary URLs.
      ...(truck.profile_photo && truck.profile_photo.startsWith("https://") &&
        (truck.profile_photo.includes("supabase.co") || truck.profile_photo.includes("hottruckmap.com")) && {
        images: [
          {
            url: truck.profile_photo,
            width: 1200,
            height: 630,
            alt: truck.name,
          },
        ],
      }),
    },
    twitter: {
      card: truck.profile_photo ? "summary_large_image" : "summary",
      title: truck.name,
      description: fullDescription,
      ...(truck.profile_photo &&
        truck.profile_photo.startsWith("https://") &&
        (truck.profile_photo.includes("supabase.co") || truck.profile_photo.includes("hottruckmap.com")) && {
          images: [truck.profile_photo],
        }),
    },
  };
}

// The truck page itself is a client component, so its structured data —
// what lets search engines show it as a restaurant with a menu, hours and
// rating — is rendered here on the server. It streams in behind its own
// Suspense boundary so the page never waits on these queries.
export default function TruckLayout({ params, children }: Props) {
  return (
    <>
      <Suspense fallback={null}>
        <TruckJsonLd params={params} />
      </Suspense>
      {children}
    </>
  );
}

async function TruckJsonLd({ params }: { params: Props["params"] }) {
  const { id } = await params;
  const truck = await getTruck(id);
  if (!truck) return null;

  const db = anonClient();
  const [{ data: menu }, { data: schedules }] = await Promise.all([
    db.from("menu_items").select("name, description, price, category, is_sold_out").eq("truck_id", id).limit(200),
    db.from("schedules").select("day_of_week, open_time, close_time").eq("truck_id", id).limit(50),
  ]);

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hottruckmap.com";
  const image = ownImage(truck.profile_photo);
  const hours = (schedules ?? []).flatMap((s) => {
    const opens = to24h(s.open_time);
    const closes = to24h(s.close_time);
    const day = DAYS[s.day_of_week];
    return opens && closes && day
      ? [{ "@type": "OpeningHoursSpecification", dayOfWeek: `https://schema.org/${day}`, opens, closes }]
      : [];
  });
  const sections = new Map<string, NonNullable<typeof menu>>();
  for (const item of menu ?? []) {
    const key = item.category?.trim() || "Menu";
    sections.set(key, [...(sections.get(key) ?? []), item]);
  }

  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FoodEstablishment",
    "@id": `${base}/truck/${id}`,
    url: `${base}/truck/${id}`,
    name: truck.name,
    ...(truck.description && { description: truck.description }),
    ...(truck.cuisine && { servesCuisine: truck.cuisine }),
    ...(image && { image }),
    ...(truck.phone && { telephone: truck.phone }),
    ...(truck.instagram && { sameAs: [`https://instagram.com/${String(truck.instagram).replace(/^@/, "")}`] }),
    ...((truck.review_count ?? 0) > 0 && (truck.avg_rating ?? 0) > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Number(truck.avg_rating).toFixed(1),
        reviewCount: truck.review_count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(hours.length > 0 && { openingHoursSpecification: hours }),
    ...(sections.size > 0 && {
      hasMenu: {
        "@type": "Menu",
        url: `${base}/truck/${id}/menu`,
        hasMenuSection: [...sections].map(([name, items]) => ({
          "@type": "MenuSection",
          name,
          hasMenuItem: items.map((item) => ({
            "@type": "MenuItem",
            name: item.name,
            ...(item.description && { description: item.description }),
            offers: {
              "@type": "Offer",
              price: Number(item.price).toFixed(2),
              priceCurrency: "USD",
              availability: item.is_sold_out ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
            },
          })),
        })),
      },
    }),
  };

  return <JsonLd data={data} />;
}
