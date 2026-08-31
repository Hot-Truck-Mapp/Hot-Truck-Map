/**
 * Single source of truth for who counts as a Hot Truck Map admin.
 *
 * This module is deliberately dependency-free so it can be imported from
 * both middleware (edge runtime) and route handlers. Server-only helpers
 * live in lib/admin-server.ts.
 *
 * Defaults to the platform owner's address. Set the ADMIN_EMAILS env var
 * (comma-separated) to change or extend it without a code change — useful if
 * the owner address ever moves, or to temporarily grant a second operator.
 *
 * Deliberately never imported by client components: the browser must not be
 * the one deciding who is an admin. The /admin page asks the server instead
 * (a 403 from /api/admin/data is what renders the "access denied" card), so
 * there is no public mirror of this list to keep in sync.
 */
function parseList(raw: string | undefined, fallback: string): string[] {
  return (raw ?? fallback)
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

const DEFAULT_ADMIN_EMAIL = "info@hottruckmap.com";

export const ADMIN_EMAILS: string[] = parseList(
  process.env.ADMIN_EMAILS,
  DEFAULT_ADMIN_EMAIL
);

/** Case-insensitive: Supabase stores the address as typed at signup. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
