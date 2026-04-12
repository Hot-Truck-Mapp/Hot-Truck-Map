import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToPlayers, distanceKm, FIVE_MILES_KM } from "@/lib/onesignal";

/**
 * POST /api/notifications/go-live
 * Called by the operator's go-live page after broadcasting their location.
 * Sends a push notification to followers who are within 5 miles of the truck
 * (followers with no stored location receive the notification too — benefit of the doubt).
 *
 * Body: { truck_id, truck_name, lat, lng, address }
 */
export async function POST(req: NextRequest) {
  const { truck_id, truck_name, lat, lng, address } = await req.json();

  if (!truck_id || lat == null || lng == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Use service role to bypass RLS — this is a trusted server-to-server call
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Get all followers of this truck
  const { data: follows } = await supabase
    .from("follows")
    .select("user_id")
    .eq("truck_id", truck_id);

  if (!follows?.length) return NextResponse.json({ sent: 0 });

  const followerIds = follows.map((f) => f.user_id);

  // 2. Get push subscriptions (includes last known location for distance filter)
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("onesignal_player_id, last_lat, last_lng, user_id")
    .in("user_id", followerIds);

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  // 3. Find users who have opted out of go_live_alerts
  const { data: optOuts } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", followerIds)
    .eq("go_live_alerts", false);

  const optedOut = new Set((optOuts ?? []).map((p) => p.user_id));

  // 4. Filter: opted in + within 5 miles (or no location stored)
  const playerIds = subs
    .filter((sub) => !optedOut.has(sub.user_id))
    .filter((sub) => {
      if (sub.last_lat == null || sub.last_lng == null) return true;
      return distanceKm(sub.last_lat, sub.last_lng, lat, lng) <= FIVE_MILES_KM;
    })
    .map((sub) => sub.onesignal_player_id);

  if (!playerIds.length) return NextResponse.json({ sent: 0 });

  await sendPushToPlayers(
    playerIds,
    (truck_name ?? "A truck you follow") + " is now open!",
    "Now serving at " + address + " — come get it while it's hot.",
    { url: "/truck/" + truck_id, truck_id }
  );

  return NextResponse.json({ sent: playerIds.length });
}
