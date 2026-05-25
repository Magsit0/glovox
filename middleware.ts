import { auth } from "@/lib/auth";
import { canAccessPath, getUserPermissions } from "@/lib/permissions";
import { matchDashboardKey } from "@/lib/dashboards-catalog";
import { logDashboardAccess } from "@/lib/dashboard-access-service";
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

    // Logging centralizado: cualquier path que matchee un entry de
    // DASHBOARDS_CATALOG queda registrado automáticamente, sin necesidad
    // de tocar el page.tsx del dashboard.
    //
    // IMPORTANTE: skipeamos las requests de prefetch. Next.js prefetchea
    // los `<Link>` automáticamente (al renderizar la home, por ejemplo)
    // y eso genera GETs a cada dashboard sin que el usuario realmente
    // los abra. Sin este filtro, un superadmin con acceso a todo
    // tendría una "visita" a cada dashboard cada vez que carga la home.
    //
    // Fire-and-forget: no bloqueamos la response. El dedupe de 5 min en
    // logDashboardAccess evita duplicados por refresh / filtros / etc.
    const userId = req.auth?.user?.userId;
    const isPrefetch =
      req.headers.get("next-router-prefetch") === "1" ||
      req.headers.get("purpose") === "prefetch" ||
      req.headers.get("sec-purpose")?.includes("prefetch") === true;
    if (userId && !isPrefetch) {
      const dashboardKey = matchDashboardKey(pathname);
      if (dashboardKey) {
        void logDashboardAccess(userId, dashboardKey, pathname);
      }
    }
  }
});

export const config = {
  // Middleware necesita Node.js runtime para escribir a Postgres
  // (postgres-js no es compatible con Edge).
  runtime: "nodejs",
  // Keep api/auth excluded from matcher so NextAuth handles OAuth callbacks natively.
  // Other /api/ routes are excluded inside the callback above.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.webp|.*\\.ico).*)"],
};
