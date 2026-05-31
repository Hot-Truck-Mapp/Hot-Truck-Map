import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Owner emails allowed to call this endpoint (server-side check)
const OWNER_EMAILS = ["hottruckmap@gmail.com"];

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing service role config");
  return createSupabaseClient(url, serviceKey);
}

export async function POST(req: NextRequest) {
  try {
    // Verify the caller is authenticated as an owner
    const supabase = await createServerClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user || !OWNER_EMAILS.includes((user.email ?? "").toLowerCase())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { featured_truck_id, featured_message } = body;

    if (typeof featured_truck_id !== "string" && featured_truck_id !== null) {
      return NextResponse.json({ error: "Invalid featured_truck_id" }, { status: 400 });
    }
    if (typeof featured_message !== "string" && featured_message !== null) {
      return NextResponse.json({ error: "Invalid featured_message" }, { status: 400 });
    }
    if (typeof featured_message === "string" && featured_message.length > 500) {
      return NextResponse.json({ error: "featured_message must be 500 characters or fewer" }, { status: 400 });
    }

    const db = getServiceClient();

    // Validate featured_truck_id points to a real truck before storing
    if (featured_truck_id) {
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!UUID_RE.test(featured_truck_id)) {
        return NextResponse.json({ error: "Invalid featured_truck_id format" }, { status: 400 });
      }
      const { data: truck } = await db.from("trucks").select("id").eq("id", featured_truck_id).maybeSingle();
      if (!truck) {
        return NextResponse.json({ error: "Featured truck not found" }, { status: 404 });
      }
    }

    const upserts = [
      { key: "featured_truck_id", value: featured_truck_id ?? "", updated_at: new Date().toISOString() },
      { key: "featured_message", value: featured_message ?? "", updated_at: new Date().toISOString() },
    ];
    const { error } = await db.from("site_settings").upsert(upserts, { onConflict: "key" });
    if (error) return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
