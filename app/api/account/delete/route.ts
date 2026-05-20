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

  const errors: string[] = [];

  // 1. Delete push subscriptions
  const { error: pushErr } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);
  if (pushErr) errors.push(`push_subscriptions: ${pushErr.message}`);

  // 2. Remove follows
  const { error: followErr } = await admin
    .from("follows")
    .delete()
    .eq("user_id", userId);
  if (followErr) errors.push(`follows: ${followErr.message}`);

  // 3. Disassociate orders (keep order records for operator bookkeeping,
  //    but strip customer identity)
  const { error: orderErr } = await admin
    .from("orders")
    .update({ customer_id: null })
    .eq("customer_id", userId);
  if (orderErr) errors.push(`orders: ${orderErr.message}`);

  // 4. Delete avatar from storage (best-effort)
  try {
    const extensions = ["jpg", "png", "webp"];
    const paths = extensions.map((ext) => `customers/${userId}.${ext}`);
    await admin.storage.from("avatars").remove(paths);
  } catch {
    // Avatar cleanup is non-critical
  }

  // 5. Delete the auth account (irreversible)
  const { error: deleteErr } = await admin.auth.admin.deleteUser(userId);
  if (deleteErr) {
    return NextResponse.json(
      { error: "Failed to delete account: " + deleteErr.message, partialErrors: errors },
      { status: 500 }
    );
  }

  return NextResponse.json({ deleted: true });
}
