/**
 * Access helpers for Server Components, Server Actions, and Route Handlers.
 *
 * `requireSession` → throws/redirects unauthenticated callers.
 * `requireSuperadmin` → throws on non-superadmin (admin UI + API).
 *
 * The proxy is the first line of defense; these helpers are defense in depth
 * for code paths that bypass the matcher (route groups, layouts, API routes).
 */
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, type Country, type Role } from "@/db/schema";
import { auth } from "@/lib/auth";
import { withNeonRetry } from "@/lib/neon-retry";

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

/**
 * ¿`email` es HOY superadmin activo? Lectura fresca de la base: el rol de la
 * sesión puede tener hasta 5 min (revalidación en lib/auth.ts), y las acciones
 * de admin pueden dar superadmin, así que un degradado no debe tener ni esa
 * ventana. Si la base falla, lanza (la acción no se ejecuta).
 */
export async function esSuperadminVigente(email: string): Promise<boolean> {
  if (!email) return false;
  const [u] = await withNeonRetry(() =>
    db
      .select({ role: users.role })
      .from(users)
      .where(and(eq(users.email, email), isNull(users.revokedAt)))
      .limit(1),
  );
  return u?.role === "superadmin";
}

export async function requireSuperadmin(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.role !== "superadmin" || !(await esSuperadminVigente(ctx.email))) {
    redirect("/?unauthorized=1");
  }
  return ctx;
}
