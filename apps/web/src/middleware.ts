import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicRoutes = ["/login", "/forgot-password", "/install", "/docs"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/" || pathname === "/install.sh" || pathname.startsWith("/install.sh")) return NextResponse.next();

  const isPublic =
    publicRoutes.some((route) => pathname === route || pathname.startsWith(route)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/static/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    pathname === "/manifest.json" ||
    pathname === "/icon-192.png" ||
    pathname === "/icon-512.png";

  if (isPublic) return NextResponse.next();

  const token = request.cookies.get("flowmind_token")?.value;
  const session = request.cookies.get("flowmind_session")?.value;

  if (!token && !session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|favicon.svg|manifest.json|icon-192.png|icon-512.png).*)"],
};
