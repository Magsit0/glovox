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

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const identity = await getUserIdentity(user.email ?? "");
      return !!identity;
    },

    /**
     * The JWT callback runs in Edge Runtime (middleware and auth() calls).
     * Postgres-js requires Node.js `net`, which is unavailable in Edge.
     *
     * Strategy: fetch identity from DB only on sign-in (OAuth callback runs
     * in Node.js). All subsequent calls return the existing token untouched.
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
      // On all other invocations (middleware checks, Server Component auth()
      // calls) just return the token as-is to avoid touching Node.js APIs
      // that are unavailable in the Edge Runtime.
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
