import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { dashboardsForEmail, type Dashboard } from "@/lib/access";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      dashboards: Dashboard[];
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
      return dashboardsForEmail(user.email).length > 0;
    },
    jwt({ token }) {
      (token as { dashboards?: Dashboard[] }).dashboards = dashboardsForEmail(token.email);
      return token;
    },
    session({ session, token }) {
      session.user.dashboards =
        (token as { dashboards?: Dashboard[] }).dashboards ?? [];
      return session;
    },
  },
});
