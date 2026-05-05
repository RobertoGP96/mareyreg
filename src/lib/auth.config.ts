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
      // /api/contracts/upload recibe callbacks server-to-server desde Vercel Blob
      // (onUploadCompleted) sin cookies. La autenticación se valida dentro del
      // handler (onBeforeGenerateToken) y handleUpload verifica la firma del
      // callback internamente, así que el middleware NO debe bloquearlo.
      const isPublicApi = pathname === "/api/contracts/upload";
      const isPublic = publicPaths.some((p) => pathname.startsWith(p)) || isPublicApi;

      if (isPublic) return true;
      if (!isLoggedIn) return false;
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id);
        token.role = (user as { role: string }).role;
        token.fullName = user.name;
        token.modules = (user as { modules: string[] }).modules ?? [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.userId = token.userId as number;
        session.user.role = token.role as string;
        session.user.fullName = token.fullName as string;
        session.user.modules = token.modules as string[];
      }
      return session;
    },
  },
};
