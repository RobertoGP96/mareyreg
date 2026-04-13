import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [], // Providers are added in auth.ts (server-only)
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const publicPaths = ["/login", "/register"];
      const isPublic = publicPaths.some((p) => pathname.startsWith(p));

      if (isPublic) return true;
      if (!isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
        token.role = (user as { role: string }).role;
        token.fullName = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as number;
        session.user.role = token.role as string;
        session.user.fullName = token.fullName as string;
      }
      return session;
    },
  },
};
