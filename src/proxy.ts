import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PROTECTED_PREFIXES = ["/dashboard", "/evaluations"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // This is a fast, edge-safe cookie presence check only — every server
  // action and page still re-validates the real session and organization
  // membership server-side before touching any data.
  const hasSessionCookie = getSessionCookie(request);

  if (PROTECTED_PREFIXES.some((p) => pathname.startsWith(p)) && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_PAGES.includes(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/evaluations/:path*", "/login", "/signup", "/forgot-password", "/reset-password"],
};
