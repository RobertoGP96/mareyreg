import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { authConfig } from "./auth.config";

const googleClientId = process.env.AUTH_GOOGLE_ID || process.env.GOOGLE_CLIENT_ID;
const googleClientSecret =
  process.env.AUTH_GOOGLE_SECRET || process.env.GOOGLE_CLIENT_SECRET;

export const isGoogleAuthEnabled = Boolean(googleClientId && googleClientSecret);

const providers = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      const user = await db.user.findUnique({
        where: { email: credentials.email as string },
        include: { modulePermissions: true },
      });

      if (!user) return null;

      const passwordMatch = await bcrypt.compare(
        credentials.password as string,
        user.passwordHash
      );

      if (!passwordMatch) return null;

      return {
        id: String(user.userId),
        email: user.email,
        name: user.fullName,
        role: user.role,
        modules: user.modulePermissions.map((p) => p.moduleId),
      };
    },
  }),
];

if (isGoogleAuthEnabled) {
  providers.push(
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: { prompt: "select_account" },
      },
    }) as unknown as (typeof providers)[number]
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email;
        if (!email) return false;
        const existing = await db.user.findUnique({ where: { email } });
        if (!existing) {
          // Sólo permitir login Google con cuentas pre-creadas en el sistema
          return "/login?error=NoUser";
        }
        return true;
      }
      return true;
    },
  },
});
