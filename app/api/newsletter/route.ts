import { ISSUES } from "@/lib/newsletter";

// Feeds the mobile app's Newsletter screen, so a new issue added to
// lib/newsletter.ts reaches the app on the next web deploy — no app release.
// ISSUES is static content, so the response is built once at build time.
export const dynamic = "force-static";

export function GET() {
  return Response.json({ issues: ISSUES });
}
