import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getUserPermissions, type DashboardPermissions } from "@/lib/permissions";

const allowedDomain = process.env.ALLOWED_DOMAIN ?? "";
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      permissions: DashboardPermissions;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ user }) {
      const email = user.email ?? "";
      const domainOk = allowedDomain && email.endsWith(`@${allowedDomain}`);
      const emailOk = allowedEmails.includes(email);
      return domainOk || emailOk;
    },

    /**
     * The jwt callback runs on every request (including in middleware).
     * JWT extends Record<string, unknown> so we can store any field directly.
     * We compute permissions from token.email so they are always fresh.
     */
    jwt({ token }) {
      const email = (token.email as string | undefined) ?? "";
      if (email) {
        token.permissions = getUserPermissions(email);
      }
      return token;
    },

    /**
     * The session callback runs when auth() is called from Server Components.
     * We read permissions from the token (already computed in jwt callback).
     */
    session({ session, token }) {
      session.user.permissions =
        (token.permissions as DashboardPermissions | undefined) ?? [];
      return session;
    },
  },
});
