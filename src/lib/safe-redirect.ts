/**
 * Only allows same-origin, path-absolute redirect targets ("/dashboard"), rejecting protocol-relative
 * ("//evil.com"), backslash tricks ("/\evil.com") and absolute URLs, to prevent open redirects.
 */
export function safeRedirectPath(target: string | null | undefined, fallback = "/dashboard"): string {
  if (!target || !target.startsWith("/") || target.startsWith("//") || target.startsWith("/\\")) {
    return fallback;
  }
  return target;
}
