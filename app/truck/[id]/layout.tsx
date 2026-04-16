import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: truck } = await supabase
    .from("trucks")
    .select("name, description, cuisine, profile_photo, is_live")
    .eq("id", id)
    .single();

  if (!truck) {
    return {
      title: "Food Truck | Hot Truck Maps",
      description: "Find food trucks near you on Hot Truck Maps.",
    };
  }

  const title = `${truck.name} | Hot Truck Maps`;
  const description =
    truck.description ||
    `${truck.cuisine ? truck.cuisine + " food truck" : "Food truck"} — order ahead and pay at the truck. Find us on Hot Truck Maps.`;
  const status = truck.is_live ? "🟢 Open Now · " : "";
  const fullDescription = status + description;

  return {
    title,
    description: fullDescription,
    openGraph: {
      title: truck.name,
      description: fullDescription,
      type: "website",
      siteName: "Hot Truck Maps",
      ...(truck.profile_photo && {
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
      ...(truck.profile_photo && { images: [truck.profile_photo] }),
    },
  };
}

export default function TruckLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
