import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { isRateLimited } from "@/lib/rateLimit";

// Configure VAPID credentials lazily inside the handler so env vars are
// always read at runtime, not at module-evaluation / build time.
function configureVapid() {
  const email = process.env.VAPID_EMAIL;
  const pub   = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv  = process.env.VAPID_PRIVATE_KEY;
  if (!email || !pub || !priv) return false;
  webpush.setVapidDetails(email, pub, priv);
  return true;
}

// Service-role client (bypasses RLS so we can read all followers/subscriptions)
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing Supabase service-role config");
  return createSupabaseClient(url, serviceKey);
}


export async function POST(req: NextRequest) {
  // Auth: operator's Bearer JWT
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify the token and get the user
  const supabase = await createServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let truck_id: string;
  let truck_name: string | undefined;
  let custom_message: string | undefined;
  try {
    const body = await req.json();
    truck_id = body.truck_id;
    truck_name = typeof body.truck_name === "string" ? body.truck_name.slice(0, 100) : undefined;
    custom_message = typeof body.message === "string" && body.message.trim() ? body.message.trim() : undefined;
    if (!truck_id) throw new Error("Missing truck_id");
    if (custom_message && custom_message.length > 200) throw new Error("Message must be 200 characters or fewer");
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Invalid body" }, { status: 400 });
  }

  // Verify the operator owns this truck (DB check — not user-editable metadata)
  const db = getServiceClient();
  const { data: truck } = await db
    .from("trucks")
    .select("id, name, locations(address)")
    .eq("id", truck_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!truck) {
    return NextResponse.json({ error: "Forbidden — you do not own this truck" }, { status: 403 });
  }

  // Server-side rate limit: 3 broadcasts per operator per 5 minutes, enforced
  // in the DB so the limit holds across all serverless instances.
  if (await isRateLimited(`notify-followers:${user.id}`, 3, 5 * 60_000)) {
    return NextResponse.json({ error: "Too many broadcasts. Please wait before sending another." }, { status: 429 });
  }

  // Substitute template variables in the custom message
  if (custom_message) {
    const locationAddress = (truck as any).locations?.[0]?.address ?? "";
    const resolvedName = truck_name ?? (truck as any).name ?? "";
    custom_message = custom_message
      .replace(/\{location\}/gi, locationAddress)
      .replace(/\{truck_name\}/gi, resolvedName);
  }

  // Delegate to the internal notification logic using the private key
  const internalRes = await fetch(
    new URL("/api/notifications", req.url).toString(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": process.env.INTERNAL_NOTIFY_KEY ?? "",
      },
      body: JSON.stringify({ truck_id, truck_name, message: custom_message }),
    }
  );

  const data = await internalRes.json().catch(() => ({}));

  if (!internalRes.ok) {
    return NextResponse.json({ error: data?.error ?? "Notification failed" }, { status: internalRes.status });
  }

  return NextResponse.json(data);
}
