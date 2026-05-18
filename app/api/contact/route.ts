import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// In-memory rate limit — max 3 submissions per IP per hour
// Resets on cold start; acceptable for serverless deployments.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (rateLimitMap.get(ip) ?? []).filter((t) => t > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  // Schedule cleanup to avoid unbounded map growth on long-running instances
  if (timestamps.length === 1) {
    setTimeout(() => {
      const remaining = (rateLimitMap.get(ip) ?? []).filter(
        (t) => t > Date.now() - RATE_LIMIT_WINDOW_MS
      );
      if (remaining.length === 0) rateLimitMap.delete(ip);
      else rateLimitMap.set(ip, remaining);
    }, RATE_LIMIT_WINDOW_MS);
  }
  return false;
}

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_SUBJECTS = [
  "General Question",
  "List My Truck",
  "Report an Issue",
  "Partnership / Press",
  "Other",
] as const;

export async function POST(req: NextRequest) {
  try {
    // Resolve client IP
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many submissions. Please wait an hour and try again." },
        { status: 429 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { name, email, subject, message } = body as Record<string, unknown>;

    // Validate name
    if (typeof name !== "string" || name.trim().length === 0 || name.trim().length > 200) {
      return NextResponse.json(
        { error: "Name is required and must be 200 characters or fewer." },
        { status: 400 }
      );
    }

    // Validate email
    if (
      typeof email !== "string" ||
      email.trim().length === 0 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      email.trim().length > 320
    ) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    // Validate subject
    if (!VALID_SUBJECTS.includes(subject as (typeof VALID_SUBJECTS)[number])) {
      return NextResponse.json(
        { error: "Please select a valid subject." },
        { status: 400 }
      );
    }

    // Validate message
    if (
      typeof message !== "string" ||
      message.trim().length === 0 ||
      message.trim().length > 1000
    ) {
      return NextResponse.json(
        { error: "Message is required and must be 1000 characters or fewer." },
        { status: 400 }
      );
    }

    const supabase = getAdminClient();

    const { error: insertError } = await supabase.from("contact_submissions").insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject as string,
      message: message.trim(),
    });

    if (insertError) {
      console.error("contact_submissions insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save your message. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
