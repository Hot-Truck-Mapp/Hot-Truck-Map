/**
 * Sanitize a `?redirect=` query param down to a same-origin destination.
 *
 * Used after login (email/password and Google OAuth) to send the user back
 * to the page they came from instead of always landing on "/".
 *
 * A naive `raw.startsWith("/") && !raw.startsWith("//")` check is NOT
 * sufficient: browsers implement the WHATWG URL spec, which treats a
 * backslash the same as a forward slash for "special" schemes (http/https).
 * That means a value like "/\evil.com" starts with a single "/" (passing a
 * naive check) but still resolves to "https://evil.com" when handed to
 * `window.location.assign()` or `new URL()`:
 *
 *   new URL("/\\evil.com", "https://hottruckmap.com").href
 *   // => "https://evil.com/"
 *
 * Resolving against the real origin and comparing `.origin` closes that gap
 * (and any other WHATWG-parsing quirk) in one place instead of trying to
 * blocklist individual characters.
 */
export function safeRedirect(raw: string | null | undefined, origin: string): string {
  if (!raw) return "/";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return "/";
    return url.pathname + url.search + url.hash;
  } catch {
    return "/";
  }
}
