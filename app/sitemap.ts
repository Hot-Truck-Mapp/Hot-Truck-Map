import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { US_STATES } from "@/lib/us-states";
import { UPDATES } from "@/lib/updates";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://hottruckmap.com";

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base,                          lastModified: new Date(), changeFrequency: "hourly",  priority: 1 },
    { url: `${base}/trucks`,              lastModified: new Date(), changeFrequency: "hourly",  priority: 0.9 },
    { url: `${base}/trucks/leaderboard`,  lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/catering`,            lastModified: new Date(), changeFrequency: "daily",   priority: 0.8 },
    { url: `${base}/about`,               lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/reviews`,             lastModified: new Date(), changeFrequency: "daily",   priority: 0.6 },
    { url: `${base}/contact`,             lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`,             lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/terms`,               lastModified: new Date(), changeFrequency: "yearly",  priority: 0.3 },
    { url: `${base}/events`,              lastModified: new Date(), changeFrequency: "daily",   priority: 0.7 },
    { url: `${base}/updates`,             lastModified: new Date(), changeFrequency: "weekly",  priority: 0.5 },
    // Newsletter issues — biweekly, so lastModified tracks each issue's own date
    ...UPDATES.map((u) => ({
      url: `${base}/updates/${u.slug}`,
      lastModified: new Date(u.dateISO),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    // City landing pages
    ...["newark", "new-york", "jersey-city", "hoboken", "trenton"].map((c) => ({
      url: `${base}/trucks/${c}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
    // Per-state events pages — fully static, no DB fetch needed
    ...US_STATES.map((s) => ({
      url: `${base}/events/${s.code.toLowerCase()}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];

  // Dynamic truck pages
  let truckRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("trucks")
      .select("id, updated_at")
      .limit(1000);
    if (data) {
      truckRoutes = data.map((t) => ({
        url: `${base}/truck/${t.id}`,
        lastModified: t.updated_at ? new Date(t.updated_at) : new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      }));
    }
  } catch {
    // DB unavailable at build time — skip dynamic routes
  }

  return [...staticRoutes, ...truckRoutes];
}
