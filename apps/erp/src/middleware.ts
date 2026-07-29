import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|manifest\\.webmanifest|manifest\\.json|robots\\.txt|sitemap\\.xml|icon|apple-icon|manifest-icon-192|manifest-icon-512|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|ttf|woff|woff2|webmanifest|json|txt|xml)$).*)",
  ],
};
