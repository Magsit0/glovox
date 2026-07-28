import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUserIdentity } from "@/lib/permissions-service";
import type { Country, Role } from "@/db/schema";
import type { DashboardPermissions } from "@/lib/permissions";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      permissions: DashboardPermissions;
      role: Role;
      country: Country | null;
      userId: string | null;
    };
  }
}

/**
 * Detecta el caso benigno de `JWTSessionError`: el browser mandó una cookie de
 * sesión que no se puede descifrar — cifrada con otro AUTH_SECRET (secreto
 * rotado, .env nuevo, cookie sobreviviente de otro entorno) o simplemente
 * corrupta. No es un fallo de la app: Auth.js descarta la sesión y manda el
 * Set-Cookie que la borra en la misma response, así que se autocorrige en un
 * request. Sin este filtro cada cookie huérfana imprime un stack trace de 25
 * líneas en el log de dev.
 *
 * Ojo: el mismo `JWTSessionError` envuelve además los errores lanzados dentro
 * de los callbacks jwt/session (p.ej. si se cae la query a Postgres). Por eso
 * matcheamos la causa concreta del fallo de decode y no el tipo entero — un
 * error real de DB tiene que seguir apareciendo completo.
 */
function isUndecryptableSessionCookie(error: Error): boolean {
  if ((error as { type?: string }).type !== "JWTSessionError") return false;
  const cause = (error.cause as { err?: unknown } | undefined)?.err;
  if (!(cause instanceof Error)) return false;
  // Mensajes de @auth/core: secreto que no matchea, o payload vacío.
  if (
    cause.message === "no matching decryption secret" ||
    cause.message === "Invalid JWT"
  ) {
    return true;
  }
  // Errores de jose al parsear/descifrar el JWE (cookie malformada o alterada).
  const code = (cause as { code?: string }).code ?? "";
  return code.startsWith("ERR_JWE_") || code.startsWith("ERR_JWT_");
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  logger: {
    error(error) {
      if (isUndecryptableSessionCookie(error)) {
        console.warn(
          "[auth] cookie de sesión ilegible descartada y borrada (probablemente cifrada con otro AUTH_SECRET). El próximo login la reemplaza.",
        );
        return;
      }
      console.error(error);
    },
  },
  callbacks: {
    async signIn({ user }) {
      const identity = await getUserIdentity(user.email ?? "");
      return !!identity;
    },

    /**
     * The JWT callback runs on every auth() call — including the one in
     * proxy.ts, which fires for basically every navigation.
     *
     * Strategy: fetch identity from DB only on sign-in. All subsequent calls
     * return the existing token untouched, so no per-request DB round trip.
     * If a superadmin changes permissions, the user must sign out and back
     * in (or the JWT expiry window elapses) for changes to take effect.
     *
     * Pass trigger="update" from a Server Action to force a refresh without
     * a full re-login (future admin UI work).
     */
    async jwt({ token, trigger }) {
      const email = (token.email as string | undefined) ?? "";
      if (!email) return token;

      // Only fetch from DB at sign-in, sign-up, or an explicit update call.
      // On all other invocations (proxy checks, Server Component auth() calls)
      // just return the token as-is.
      const shouldRefresh =
        trigger === "signIn" ||
        trigger === "signUp" ||
        trigger === "update" ||
        !("permissions" in token); // first-ever token, missing our fields

      if (!shouldRefresh) return token;

      const identity = await getUserIdentity(email);
      if (identity) {
        token.permissions = identity.permissions;
        token.role = identity.role;
        token.country = identity.country;
        token.userId = identity.id;
      } else {
        token.permissions = [];
        token.role = "user";
        token.country = null;
        token.userId = null;
      }
      return token;
    },

    session({ session, token }) {
      session.user.permissions =
        (token.permissions as DashboardPermissions | undefined) ?? [];
      session.user.role = (token.role as Role | undefined) ?? "user";
      session.user.country =
        (token.country as Country | null | undefined) ?? null;
      session.user.userId =
        (token.userId as string | null | undefined) ?? null;
      return session;
    },
  },
});
