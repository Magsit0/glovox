import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { dashboardForPath, type Dashboard } from "@/lib/access";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname, origin } = req.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", origin));
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", origin));
  }

  if (isLoggedIn) {
    const required = dashboardForPath(pathname);
    if (required) {
      const allowed = (req.auth?.user?.dashboards ?? []) as Dashboard[];
      if (!allowed.includes(required)) {
        return NextResponse.redirect(new URL("/403", origin));
      }
    }
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
