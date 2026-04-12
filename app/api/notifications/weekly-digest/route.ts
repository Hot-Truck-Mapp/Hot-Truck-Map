import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToPlayers } from "@/lib/onesignal";

/**
 * GET /api/notifications/weekly-digest
 * Triggered every Sunday at 11am EST by Vercel Cron (see vercel.json).
 * Sends each opted-in user a summary of the trucks they follow.
 *
 * Protected by CRON_SECRET — Vercel passes this automatically via the
 * Authorization header when it calls a cron route.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== "Bearer " + process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Users who have weekly digest enabled
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("user_id")
    .eq("weekly_digest", true);

  if (!prefs?.length) return NextResponse.json({ sent: 0 });

  const userIds = prefs.map((p) => p.user_id);

  // 2. Get their followed trucks
  const { data: follows } = await supabase
    .from("follows")
    .select("user_id, trucks(id, name, is_live)")
    .in("user_id", userIds);

  // 3. Group truck names by user
  const trucksByUser = new Map<string, string[]>();
  for (const f of follows ?? []) {
    if (!f.trucks) continue;
    const names = trucksByUser.get(f.user_id) ?? [];
    names.push((f.trucks as any).name);
    trucksByUser.set(f.user_id, names);
  }

  // 4. Get push subscriptions for opted-in users
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, onesignal_player_id")
    .in("user_id", userIds);

  const subsByUser = new Map<string, string[]>();
  for (const s of subs ?? []) {
    const playerIds = subsByUser.get(s.user_id) ?? [];
    playerIds.push(s.onesignal_player_id);
    subsByUser.set(s.user_id, playerIds);
  }

  // 5. Send one digest per user
  let totalSent = 0;
  for (const [userId, truckNames] of trucksByUser.entries()) {
    const playerIds = subsByUser.get(userId);
    if (!playerIds?.length) continue;

    const listed = truckNames.slice(0, 3).join(", ");
    const overflow = truckNames.length > 3 ? " +" + (truckNames.length - 3) + " more" : "";

    const body =
      truckNames.length === 1
        ? truckNames[0] + " is rolling this week — tap to see their schedule."
        : listed + overflow + " are rolling this week.";

    await sendPushToPlayers(playerIds, "Your trucks this week", body, {
      url: "/account",
    });

    totalSent += playerIds.length;
  }

  return NextResponse.json({ sent: totalSent });
}
