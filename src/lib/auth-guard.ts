import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) redirect("/");
  return session;
}

export async function requireModule(moduleId: string) {
  const session = await requireAuth();
  if (session.user.role === "admin") return session;
  if (!session.user.modules?.includes(moduleId)) redirect("/");
  return session;
}
