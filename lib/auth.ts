import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getDbIdentity, getUserIdentity } from "@/lib/permissions-service";
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

/** Cada cuánto se relee de la base la identidad de una sesión abierta. */
const REVALIDAR_MS = 5 * 60 * 1000;
/** Si la base falla al revalidar, el próximo intento va en 1 min (no en cada request). */
const REINTENTO_MS = 60 * 1000;
/** Tope de la consulta de revalidación: con Neon colgado no se bloquea la página. */
const REVALIDAR_TIMEOUT_MS = 2500;

function conTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout ${ms} ms`)), ms);
  });
  return Promise.race([p, limite]).finally(() => clearTimeout(timer));
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
     * proxy.ts, which fires for basically every navigation, page, API route
     * and Server Action POST.
     *
     * Identity (role, permissions, country, userId) is loaded at sign-in and
     * RE-VALIDATED against the DB every REVALIDAR_MS. Auth.js re-issues the
     * cookie with a fresh 30-day expiry on every request, so without this a
     * revoked user, a removed grant or a demoted superadmin kept their access
     * for as long as they visited once a month (fixed 2026-11-04).
     *  - DB says the user is gone or revoked → return null: Auth.js deletes
     *    the session cookie and the proxy sends them to /login.
     *  - DB fails or takes > REVALIDAR_TIMEOUT_MS → keep the token unchanged
     *    and retry in REINTENTO_MS (one attempt, not on every request). Never
     *    throw here: Auth.js treats a throw as a broken session and logs the
     *    user out, so a Neon blip would log out everyone.
     * Admin actions additionally re-read the role on each call
     * (requireSuperadmin in lib/access.ts), because they can grant superadmin.
     */
    async jwt({ token, trigger }) {
      const email = (token.email as string | undefined) ?? "";
      if (!email) return token;

      const initial =
        trigger === "signIn" ||
        trigger === "signUp" ||
        trigger === "update" ||
        !("permissions" in token); // first-ever token, missing our fields

      if (initial) {
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
        token.checkedAt = Date.now();
        return token;
      }

      const checkedAt = typeof token.checkedAt === "number" ? token.checkedAt : 0;
      if (Date.now() - checkedAt < REVALIDAR_MS) return token;

      let identity: Awaited<ReturnType<typeof getDbIdentity>>;
      try {
        identity = await conTimeout(getDbIdentity(email), REVALIDAR_TIMEOUT_MS);
      } catch (err) {
        const causa = err instanceof Error ? ((err.cause as Error | undefined)?.message ?? err.message) : String(err);
        console.error(`[auth] no se pudo revalidar la sesión de ${email}; reintento en 1 min: ${causa.split("\n")[0].slice(0, 200)}`);
        token.checkedAt = Date.now() - REVALIDAR_MS + REINTENTO_MS;
        return token;
      }
      if (!identity) return null;
      token.permissions = identity.permissions;
      token.role = identity.role;
      token.country = identity.country;
      token.userId = identity.id;
      token.checkedAt = Date.now();
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
