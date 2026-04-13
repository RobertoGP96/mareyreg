import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      userId: number;
      email: string;
      fullName: string;
      role: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: number;
    role: string;
    fullName: string;
  }
}
