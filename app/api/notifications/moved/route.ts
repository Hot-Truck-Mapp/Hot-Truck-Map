import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToPlayers } from "@/lib/onesignal";

/**
 * POST /api/notifications/moved
 * Emergency update — operator has moved to a new location.
 * Sent to ALL followers regardless of distance (they chose to follow this truck).
 *
 * Body: { truck_id, truck_name, new_address }
 */
export async function POST(req: NextRequest) {
  const { truck_id, truck_name, new_address } = await req.json();

  if (!truck_id || !new_address) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Get all followers
  const { data: follows } = await supabase
    .from("follows")
    .select("user_id")
    .eq("truck_id", truck_id);

  if (!follows?.length) return NextResponse.json({ sent: 0 });

  const followerIds = follows.map((f) => f.user_id);

  // 2. Get push subscriptions
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("onesignal_player_id, user_id")
    .in("user_id", followerIds);

  if (!subs?.length) return NextResponse.json({ sent: 0 });

  // 3. Respect moved_alerts opt-out
  const { data: optOuts } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .in("user_id", followerIds)
    .eq("moved_alerts", false);

  const optedOut = new Set((optOuts ?? []).map((p) => p.user_id));

  const playerIds = subs
    .filter((sub) => !optedOut.has(sub.user_id))
    .map((sub) => sub.onesignal_player_id);

  if (!playerIds.length) return NextResponse.json({ sent: 0 });

  await sendPushToPlayers(
    playerIds,
    (truck_name ?? "A truck you follow") + " has moved!",
    "New location: " + new_address,
    { url: "/truck/" + truck_id, truck_id }
  );

  return NextResponse.json({ sent: playerIds.length });
}
