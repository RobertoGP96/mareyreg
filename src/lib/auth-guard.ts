import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(roles: string[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new Error("No tienes permisos para realizar esta accion");
  }
  return session;
}

export async function requireModule(moduleId: string) {
  const session = await requireAuth();
  if (session.user.role === "admin") return session;
  if (!session.user.modules?.includes(moduleId)) {
    redirect("/");
  }
  return session;
}
