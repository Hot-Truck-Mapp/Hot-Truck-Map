import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Account Deletion API — Apple App Store Guideline 5.1.1(v)
//
// Deletes user data (follows, orders association, push subscriptions, avatar)
// and then deletes the Supabase auth account. Requires a valid session token.
//
// This is irreversible. The client should confirm with the user before calling.
// ---------------------------------------------------------------------------

export async function DELETE(req: NextRequest) {
  // Authenticate via bearer token
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Create a user-scoped client to verify the token
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const {
    data: { user },
    error: authErr,
  } = await userClient.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const userId = user.id;

  // Use the service role client to clean up data and delete the account
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ── Operators: this deletes their whole business, not just an account ──
  //
  // trucks.owner_id is ON DELETE CASCADE, so deleting the auth user takes the
  // truck row with it — and menu_items, schedules, locations, follows,
  // catering_packages, reviews and truck_views all cascade from trucks in
  // turn. orders.truck_id is ON DELETE SET NULL, so orders survive but with a
  // null truck_id, which makes them unreachable to the dashboard (every query
  // there filters on truck_id). The "keep order records for operator
  // bookkeeping" intent below is defeated for the operator's own truck.
  //
  // None of that was surfaced anywhere: the account page said only
  // "Permanently delete your account and all associated data". Require an
  // explicit acknowledgement so an operator cannot destroy their listing by
  // clicking through a generic confirm.
  const { data: ownedTruck } = await admin
    .from("trucks")
    .select("id, name")
    .eq("owner_id", userId)
    .maybeSingle();

  if (ownedTruck) {
    let acknowledged = false;
    try {
      const body = await req.json();
      acknowledged = body?.deleteTruck === true;
    } catch { /* no body sent */ }

    if (!acknowledged) {
      const [{ count: menuCount }, { count: followerCount }] = await Promise.all([
        admin.from("menu_items").select("id", { count: "exact", head: true }).eq("truck_id", ownedTruck.id),
        admin.from("follows").select("user_id", { count: "exact", head: true }).eq("truck_id", ownedTruck.id),
      ]);
      return NextResponse.json(
        {
          error: "This account owns a food truck listing.",
          requiresTruckAck: true,
          truck: {
            name: ownedTruck.name,
            menuItems: menuCount ?? 0,
            followers: followerCount ?? 0,
          },
        },
        { status: 409 }
      );
    }

    // Acknowledged — remove the truck's storage before the cascade removes the
    // rows that point at it. Previously only customers/<uid>.<ext> was cleaned
    // up, so every truck profile photo and menu photo was orphaned in storage
    // permanently, with nothing left in the database to find them by.
    for (const [bucket, prefix] of [
      ["avatars", `trucks/${ownedTruck.id}`],
      ["menu-photos", `menu/${ownedTruck.id}`],
    ] as const) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
        if (files?.length) {
          await admin.storage.from(bucket).remove(files.map((f) => `${prefix}/${f.name}`));
        }
      } catch {
        // Storage cleanup is best-effort — it must not block the deletion the
        // user has explicitly asked for and already confirmed twice.
      }
    }
  }

  // 1. Delete push subscriptions
  const { error: pushErr } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

  // 2. Remove follows
  const { error: followErr } = await admin
    .from("follows")
    .delete()
    .eq("user_id", userId);

  // 3. Disassociate orders (keep order records for operator bookkeeping,
  //    but strip customer identity)
  const { error: orderErr } = await admin
    .from("orders")
    .update({ customer_id: null })
    .eq("customer_id", userId);

  // 4. Delete profile row. The profiles table was created out-of-band by the
  //    Supabase quickstart with a non-cascading FK on auth.users(id), which
  //    blocks deleteUser. supabase_patch_005.sql adds ON DELETE CASCADE; this
  //    explicit delete is the belt-and-suspenders fallback in case the patch
  //    hasn't been applied yet. Missing-table errors (42P01) are ignored.
  const { error: profileErr } = await admin
    .from("profiles")
    .delete()
    .eq("id", userId);
  const profileBlockingErr =
    profileErr && (profileErr as { code?: string }).code !== "42P01"
      ? profileErr
      : null;

  // If any critical cleanup step failed, abort before deleting the auth account —
  // deleting the account first would permanently orphan the rows.
  if (pushErr || followErr || orderErr || profileBlockingErr) {
    console.error("Account deletion cleanup failed:", {
      pushErr,
      followErr,
      orderErr,
      profileErr: profileBlockingErr,
    });
    return NextResponse.json(
      { error: "Could not fully clean up account data. Please try again." },
      { status: 500 }
    );
  }

  // 5. Delete avatar from storage (best-effort — non-critical)
  try {
    const extensions = ["jpg", "png", "webp"];
    const paths = extensions.map((ext) => `customers/${userId}.${ext}`);
    await admin.storage.from("avatars").remove(paths);
  } catch {
    // Avatar cleanup failure does not block account deletion
  }

  // 6. Delete the auth account (irreversible)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    console.error("Account auth deletion failed:", deleteErr);
    return NextResponse.json(
      { error: "Failed to delete account. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
