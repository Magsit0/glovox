/**
 * Access helpers for Server Components, Server Actions, and Route Handlers.
 *
 * `requireSession` → throws/redirects unauthenticated callers.
 * `requireSuperadmin` → throws on non-superadmin (admin UI + API).
 *
 * Middleware is the first line of defense; these helpers are defense in depth
 * for code paths that bypass the matcher (route groups, layouts, API routes).
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Country, Role } from "@/db/schema";

export type SessionContext = {
  email: string;
  role: Role;
  country: Country | null;
  userId: string | null;
};

export async function requireSession(): Promise<SessionContext> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!session?.user || !email) {
    redirect("/login");
  }
  return {
    email,
    role: session.user.role ?? "user",
    country: session.user.country ?? null,
    userId: session.user.userId ?? null,
  };
}

export async function requireSuperadmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role !== "superadmin") {
    redirect("/?unauthorized=1");
  }
  return ctx;
}
