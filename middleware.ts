import { auth } from "@/lib/auth";
import { canAccessPath, getUserPermissions } from "@/lib/permissions";
import { NextResponse } from "next/server";

/** Paths always accessible to any logged-in user. */
const PUBLIC_PATHS = ["/", "/login"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  // /admin/* is gated on role; api/admin guards itself in handlers.
  if (isLoggedIn && pathname.startsWith("/admin")) {
    if (req.auth?.user?.role !== "superadmin") {
      const homeUrl = new URL("/", req.nextUrl.origin);
      homeUrl.searchParams.set("unauthorized", "1");
      return NextResponse.redirect(homeUrl);
    }
    return NextResponse.next();
  }

  // API routes and public paths skip dashboard permission checks.
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // Enforce dashboard-level permissions on page routes only.
  if (isLoggedIn) {
    const email = req.auth?.user?.email ?? "";
    const permissions =
      req.auth?.user?.permissions ?? getUserPermissions(email);

    if (!canAccessPath(permissions, pathname)) {
      const homeUrl = new URL("/", req.nextUrl.origin);
      homeUrl.searchParams.set("unauthorized", "1");
      return NextResponse.redirect(homeUrl);
    }
  }
});

export const config = {
  // Keep api/auth excluded from matcher so NextAuth handles OAuth callbacks natively.
  // Other /api/ routes are excluded inside the callback above.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.ico).*)"],
};
