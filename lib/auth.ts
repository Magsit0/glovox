import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedDomain = process.env.ALLOWED_DOMAIN ?? "";
const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

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
  },
});
